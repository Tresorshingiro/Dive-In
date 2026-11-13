import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { decryptSecret, encryptSecret, newTotpSecret, otpauthUrl, verifyTotp } from '../../lib/totp';
import type { Prisma, Role } from '@prisma/client';
import type { AuthUser, LoginInput, RegisterInput } from '@dive/shared';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { HttpError, conflict, forbidden, unauthorized } from '../../lib/errors';
import { uniqueGymSlug } from '../../lib/slug';
import { hashRefreshToken, newRefreshToken, refreshExpiry, signAccessToken } from '../../lib/tokens';

interface ClientInfo {
  ip?: string | null;
  userAgent?: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

/** A real bcrypt hash so failed logins for unknown emails take the same time. */
const DUMMY_HASH = bcrypt.hashSync('dive-timing-equaliser', 10);

/** Rotation grace window: a just-replaced token reused within this window (two tabs racing) is
 *  rejected without revoking the family. Older reuse is treated as theft. */
const REUSE_GRACE_MS = 30_000;

export async function toAuthUser(userId: string): Promise<AuthUser> {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      mustChangePassword: true,
      staffOf: { select: { gymId: true } },
      ownedGyms: { select: { id: true }, orderBy: { createdAt: 'asc' }, take: 1 },
    },
  });
  const gymId = u.role === 'GYM_OWNER' ? (u.ownedGyms[0]?.id ?? null) : u.role === 'RECEPTIONIST' ? (u.staffOf?.gymId ?? null) : null;
  return { id: u.id, email: u.email, fullName: u.fullName, phone: u.phone, role: u.role, gymId, mustChangePassword: u.mustChangePassword };
}

/** Changes the password, clears the temporary-password flag and signs out every other session. */
export async function changePassword(userId: string, currentPassword: string, newPassword: string, client: ClientInfo) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'BAD_REQUEST', 'Current password is incorrect', { currentPassword: 'Current password is incorrect' });
  }
  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } });
    await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit({ actorId: userId, actorRole: user.role, action: 'auth.password_changed', entity: 'user', entityId: userId, ip: client.ip }, tx);
    const { tokens } = await issueTokens(user, client, tx);
    return tokens;
  });
}

async function issueTokens(
  user: { id: string; role: Role },
  client: ClientInfo,
  db: Prisma.TransactionClient | typeof prisma = prisma,
  familyId: string = crypto.randomUUID(),
) {
  const refreshToken = newRefreshToken();
  const row = await db.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      familyId,
      expiresAt: refreshExpiry(),
      ip: client.ip ?? null,
      userAgent: client.userAgent?.slice(0, 300) ?? null,
    },
  });
  return { tokens: { accessToken: signAccessToken({ sub: user.id, role: user.role }), refreshToken }, rowId: row.id };
}

export async function register(input: RegisterInput, client: ClientInfo) {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw conflict('An account with this email already exists', { email: 'Email already registered' });

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: input.email, phone: input.phone, fullName: input.fullName, passwordHash, role: input.role },
    });

    if (input.role === 'GYM_OWNER') {
      // The gym stays PENDING until a DIVE-IN admin approves it; the free trial starts on approval.
      const gym = await tx.gym.create({
        data: {
          ownerId: user.id,
          name: input.gymName!,
          slug: await uniqueGymSlug(input.gymName!, tx),
          neighbourhood: input.neighbourhood!,
          phone: input.phone,
          email: input.email,
        },
      });
      await audit({ actorId: user.id, actorRole: 'GYM_OWNER', action: 'gym.apply', entity: 'gym', entityId: gym.id, gymId: gym.id, ip: client.ip }, tx);
    }
    if (input.role === 'TRAINER') {
      await tx.trainer.create({ data: { userId: user.id, specialties: input.specialties ?? [] } });
    }

    await audit({ actorId: user.id, actorRole: user.role, action: 'auth.register', entity: 'user', entityId: user.id, ip: client.ip }, tx);
    const { tokens } = await issueTokens(user, client, tx);
    return { userId: user.id, tokens };
  });
}

export async function login(input: LoginInput, client: ClientInfo, opts: { adminOnly?: boolean } = {}) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    if (user) await audit({ actorId: user.id, actorRole: user.role, action: 'auth.login_failed', entity: 'user', entityId: user.id, ip: client.ip });
    throw unauthorized('Email or password is incorrect');
  }
  if (user.status !== 'ACTIVE') throw forbidden('This account is suspended. Contact DIVE-IN support.');
  if (opts.adminOnly && user.role !== 'ADMIN') throw forbidden('This login is for DIVE-IN administrators only');
  if (!opts.adminOnly && user.role === 'ADMIN') throw forbidden('Administrators sign in at /admin/login');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ actorId: user.id, actorRole: user.role, action: 'auth.login', entity: 'user', entityId: user.id, ip: client.ip });
  const { tokens } = await issueTokens(user, client);
  return { userId: user.id, tokens };
}

/** Rotates the refresh token. Reusing an old token revokes every token in its family. */
export async function refresh(presented: string | undefined, client: ClientInfo) {
  if (!presented) throw unauthorized('Session expired');
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(presented) },
    include: { user: { select: { id: true, role: true, status: true } } },
  });
  if (!row) throw unauthorized('Session expired');

  if (row.revokedAt) {
    const raced = row.replacedBy && Date.now() - row.revokedAt.getTime() < REUSE_GRACE_MS;
    if (!raced) {
      await prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      await audit({ actorId: row.userId, action: 'auth.refresh_reuse_detected', entity: 'user', entityId: row.userId, ip: client.ip });
    }
    throw unauthorized('Session expired');
  }
  if (row.expiresAt < new Date() || row.user.status !== 'ACTIVE') throw unauthorized('Session expired');

  return prisma.$transaction(async (tx) => {
    // Conditional update: only one concurrent refresh can win the rotation.
    const claimed = await tx.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (claimed.count === 0) throw unauthorized('Session expired');
    const { tokens, rowId } = await issueTokens(row.user, client, tx, row.familyId);
    await tx.refreshToken.update({ where: { id: row.id }, data: { replacedBy: rowId } });
    return { userId: row.userId, tokens };
  });
}

// ───────────────────────── admin two-factor login ─────────────────────────

/** Step 1: password. Never issues session tokens for an admin — only a 5-minute MFA ticket. */
export async function adminPasswordStep(input: LoginInput, client: ClientInfo) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    if (user) await audit({ actorId: user.id, actorRole: user.role, action: 'auth.login_failed', entity: 'user', entityId: user.id, ip: client.ip });
    throw unauthorized('Email or password is incorrect');
  }
  if (user.status !== 'ACTIVE') throw forbidden('This account is suspended');
  if (user.role !== 'ADMIN') throw forbidden('This login is for DIVE-IN administrators only');
  const ticket = jwt.sign({ sub: user.id }, env.JWT_ACCESS_SECRET, { expiresIn: '5m', issuer: 'dive', audience: 'dive-mfa' });
  return { ticket, mfa: user.totpEnabledAt ? ('verify' as const) : ('setup' as const) };
}

export function readMfaTicket(ticket: string | undefined) {
  if (!ticket) throw unauthorized('Sign in with your password first');
  try {
    const p = jwt.verify(ticket, env.JWT_ACCESS_SECRET, { issuer: 'dive', audience: 'dive-mfa' }) as jwt.JwtPayload;
    return String(p.sub);
  } catch {
    throw unauthorized('Sign-in step expired. Enter your password again.');
  }
}

/** First login: create a secret for the authenticator app (only while 2FA isn't confirmed yet). */
export async function adminMfaSetup(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.totpEnabledAt) throw forbidden('Two-factor sign-in is already set up');
  const secret = newTotpSecret();
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: encryptSecret(secret), totpLastStep: null } });
  const url = otpauthUrl(secret, user.email);
  return { secret, otpauthUrl: url, qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#0E0E0E', light: '#F3F1EC' } }) };
}

/** Step 2: the 6-digit code. Confirms setup on first use, then issues the real session. */
export async function adminMfaVerify(userId: string, code: string, client: ClientInfo) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.totpSecret) throw unauthorized('Set up your authenticator app first');
  const step = verifyTotp(decryptSecret(user.totpSecret), code, user.totpLastStep);
  if (step === null) {
    await audit({ actorId: user.id, actorRole: user.role, action: 'auth.mfa_failed', entity: 'user', entityId: user.id, ip: client.ip });
    throw new HttpError(400, 'BAD_REQUEST', 'That code is not valid. Check your app and try again.', { code: 'Invalid or already used code' });
  }
  const firstTime = !user.totpEnabledAt;
  await prisma.user.update({ where: { id: userId }, data: { totpLastStep: step, lastLoginAt: new Date(), ...(firstTime ? { totpEnabledAt: new Date() } : {}) } });
  await audit({ actorId: user.id, actorRole: user.role, action: firstTime ? 'auth.mfa_enabled' : 'auth.login', entity: 'user', entityId: user.id, ip: client.ip, after: { mfa: true } });
  const { tokens } = await issueTokens(user, client);
  return { userId, tokens };
}

export async function logout(presented: string | undefined, actor?: { id: string; role: Role }, ip?: string | null) {
  if (presented) {
    await prisma.refreshToken.updateMany({ where: { tokenHash: hashRefreshToken(presented), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  if (actor) await audit({ actorId: actor.id, actorRole: actor.role, action: 'auth.logout', entity: 'user', entityId: actor.id, ip });
}
