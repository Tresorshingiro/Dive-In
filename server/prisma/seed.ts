/**
 * Dev seed. WIPES ALL DATA, then creates sample Kigali gyms, trainers, packages,
 * demo accounts for every role, and a few memberships for testing reception.
 * Run:  npm run db:seed   (refuses to run with NODE_ENV=production)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, type Role } from '@prisma/client';
import { CONFIG_KEYS } from '@dive/shared';
import { CONFIG_DEFAULTS } from '../src/lib/configDefaults';

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysFromNow = (d: number) => new Date(now.getTime() + d * DAY);

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed in production.');
  process.exit(1);
}
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'DiveDemo2026';

const HOURS = {
  mon: '05:30-22:00', tue: '05:30-22:00', wed: '05:30-22:00', thu: '05:30-22:00',
  fri: '05:30-22:00', sat: '07:00-20:00', sun: '08:00-14:00',
};

const GYMS = [
  {
    key: 'iron', name: 'Iron House', neighbourhood: 'Kacyiru', address: 'KG 7 Ave, Kacyiru', lat: -1.9437, lng: 30.0794,
    tags: ['Strength', 'Cardio'], amenities: ['Free weights', 'Cardio deck', 'Showers', 'Parking'],
    description: 'A serious strength floor in the heart of Kacyiru: racks, platforms and a full cardio deck.',
    photos: ['gym-1', 'gym-7', 'gym-11'], checkout: true, commission: true, owner: 'Didier Kamanzi',
    packages: [['Day pass', 1, 5000], ['Monthly', 30, 60000], ['3 months', 90, 165000], ['Annual', 365, 600000]],
  },
  {
    key: 'pulse', name: 'Pulse Studio', neighbourhood: 'Kimihurura', address: 'KG 9 Ave, Kimihurura', lat: -1.953, lng: 30.0905,
    tags: ['HIIT', 'Classes'], amenities: ['Group classes', 'Spin room', 'Lockers'],
    description: 'High-energy group classes every hour: HIIT, spin and circuits with small class sizes.',
    photos: ['gym-9', 'gym-3'], checkout: true, commission: false, owner: 'Ange Uwera',
    packages: [['Drop-in class', 1, 6000], ['Monthly unlimited', 30, 65000], ['3 months', 90, 180000]],
  },
  {
    key: 'summit', name: 'Summit Strength', neighbourhood: 'Remera', address: 'KN 5 Rd, Remera', lat: -1.9575, lng: 30.1127,
    tags: ['Powerlifting'], amenities: ['Competition racks', 'Calibrated plates', 'Chalk allowed'],
    description: 'Powerlifting and barbell sport near Amahoro Stadium. Coaching for all levels.',
    photos: ['gym-6', 'gym-7', 'gym-2'], checkout: false, commission: false, owner: 'Fabrice Gatete',
    packages: [['Monthly', 30, 50000], ['3 months', 90, 140000], ['6 months', 180, 270000]],
  },
  {
    key: 'hilltop', name: 'Hilltop Fitness', neighbourhood: 'Nyarutarama', address: 'KG 13 Ave, Nyarutarama', lat: -1.9363, lng: 30.1036,
    tags: ['Pool', 'Sauna'], amenities: ['25m pool', 'Sauna', 'Steam room', 'Café', 'Parking'],
    description: 'A full club with pool, sauna and a quiet gym floor overlooking the valley.',
    photos: ['gym-5', 'gym-4'], checkout: true, commission: true, owner: 'Clarisse Mutesi',
    packages: [['Day pass', 1, 10000], ['Monthly', 30, 80000], ['3 months', 90, 220000], ['Annual', 365, 800000]],
  },
  {
    key: 'core', name: 'Core Lab', neighbourhood: 'Kicukiro', address: 'KK 15 Rd, Kicukiro', lat: -1.9721, lng: 30.1035,
    tags: ['Boxing', 'Mobility'], amenities: ['Boxing ring', 'Heavy bags', 'Mobility studio'],
    description: 'Boxing, conditioning and mobility. Beginners welcome every evening.',
    photos: ['gym-8', 'gym-3'], checkout: true, commission: false, owner: 'Yves Nshimiyimana',
    packages: [['Monthly', 30, 55000], ['3 months', 90, 150000]],
  },
  {
    key: 'motion', name: 'Motion Club', neighbourhood: 'Gisozi', address: 'KG 14 Ave, Gisozi', lat: -1.9247, lng: 30.0607,
    tags: ['Yoga', 'Pilates'], amenities: ['Yoga studio', 'Reformers', 'Mats provided'],
    description: 'Yoga, Pilates and recovery in a calm studio above Gisozi.',
    photos: ['gym-10', 'gym-2'], checkout: false, commission: false, owner: 'Esther Mukeshimana',
    packages: [['Monthly', 30, 45000], ['10-class pack', 60, 30000], ['3 months', 90, 120000]],
  },
] as const;

const TRAINERS = [
  { name: 'Eric Niyonzima', email: 'trainer@demo.dive.rw', headline: 'Strength coach · 8 years', specialties: ['Strength', 'Hypertrophy'], gyms: ['iron'], fee: 15000, photo: 'coach-1', years: 8 },
  { name: 'Aline Mukamana', email: 'aline@demo.dive.rw', headline: 'HIIT and conditioning', specialties: ['HIIT', 'Fat loss'], gyms: ['pulse'], fee: 12000, photo: 'coach-2', years: 5 },
  { name: 'Jean-Paul Habimana', email: 'jeanpaul@demo.dive.rw', headline: 'Boxing coach, ex-national team', specialties: ['Boxing', 'Conditioning'], gyms: ['core'], fee: 15000, photo: 'coach-3', years: 10 },
  { name: 'Patrick Mugisha', email: 'patrick@demo.dive.rw', headline: 'Powerlifting · meet prep', specialties: ['Powerlifting'], gyms: ['summit'], fee: 18000, photo: 'coach-4', years: 7 },
  { name: 'Grace Uwimana', email: 'grace@demo.dive.rw', headline: 'Mobility and yoga', specialties: ['Mobility', 'Yoga'], gyms: ['motion'], fee: 10000, photo: null, years: 6 },
  { name: 'Diane Ingabire', email: 'diane@demo.dive.rw', headline: 'Swim technique for adults', specialties: ['Swimming'], gyms: ['hilltop'], fee: 20000, photo: null, years: 9 },
  { name: 'Olivier Nkurunziza', email: 'olivier@demo.dive.rw', headline: 'Weight loss and nutrition habits', specialties: ['Weight loss', 'Nutrition'], gyms: ['iron', 'pulse'], fee: 12000, photo: 'coach-5', years: 4 },
  { name: 'Claudine Umutoni', email: 'claudine@demo.dive.rw', headline: 'Pilates and core', specialties: ['Pilates', 'Core'], gyms: ['motion'], fee: 12000, photo: null, years: 5 },
] as const;

async function wipe() {
  // child tables first
  await prisma.$transaction([
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.checkIn.deleteMany(),
    prisma.paymentEvent.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.coachAccessPass.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.package.deleteMany(),
    prisma.availabilityException.deleteMany(),
    prisma.trainerAvailability.deleteMany(),
    prisma.trainerGym.deleteMany(),
    prisma.trainer.deleteMany(),
    prisma.gymStaff.deleteMany(),
    prisma.gymPhoto.deleteMany(),
    prisma.gymSubscription.deleteMany(),
    prisma.gym.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.contactMessage.deleteMany(),
    prisma.platformConfig.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function main() {
  console.log('Seeding DIVE-IN…');
  await wipe();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const mkUser = (email: string, fullName: string, role: Role, phone?: string) =>
    prisma.user.create({ data: { email, fullName, role, passwordHash, phone: phone ?? null } });

  // ── platform config
  for (const [key, value] of Object.entries(CONFIG_DEFAULTS)) {
    await prisma.platformConfig.create({ data: { key, value: value as object } });
  }
  await prisma.platformConfig.update({ where: { key: CONFIG_KEYS.coachPass }, data: { description: 'Coach Access Pass price and length. Proposal, not final.' } });

  // ── admin
  const admin = await mkUser('admin@demo.dive.rw', 'DIVE-IN Admin', 'ADMIN', '+250788000001');

  // ── gyms + owners + packages + trial subscriptions
  const gymIds: Record<string, string> = {};
  const packageIds: Record<string, string[]> = {};
  for (const [i, g] of GYMS.entries()) {
    const ownerEmail = i === 0 ? 'owner@demo.dive.rw' : `owner.${g.key}@demo.dive.rw`;
    const owner = await mkUser(ownerEmail, g.owner, 'GYM_OWNER', `+25078800010${i}`);
    const gym = await prisma.gym.create({
      data: {
        ownerId: owner.id,
        name: g.name,
        slug: g.name.toLowerCase().replace(/\s+/g, '-'),
        description: g.description,
        neighbourhood: g.neighbourhood,
        address: g.address,
        lat: g.lat,
        lng: g.lng,
        phone: owner.phone,
        email: ownerEmail,
        openingHours: HOURS,
        tags: [...g.tags],
        amenities: [...g.amenities],
        status: 'APPROVED',
        approvedAt: daysFromNow(-20),
        diveCheckoutEnabled: g.checkout,
        commissionOptIn: g.commission,
        photos: { create: g.photos.map((p, i) => ({ url: `/images/${p}.webp`, caption: i === 0 ? `${g.name} gym floor` : null, sortOrder: i })) },
        subscriptions: { create: { plan: 'TRIAL', priceRwf: 0, startsAt: daysFromNow(-20), endsAt: daysFromNow(10) } },
      },
    });
    gymIds[g.key] = gym.id;
    packageIds[g.key] = [];
    for (const [j, [name, durationDays, priceRwf]] of g.packages.entries()) {
      const p = await prisma.package.create({
        data: { gymId: gym.id, name, durationDays, priceRwf, sortOrder: j, perks: durationDays >= 30 ? ['Full gym access', 'Locker'] : ['Single visit'] },
      });
      packageIds[g.key].push(p.id);
    }
  }

  // A pending application for the admin to review (Phase 6)
  const pendingOwner = await mkUser('owner.pending@demo.dive.rw', 'Innocent Rukundo', 'GYM_OWNER', '+250788000199');
  await prisma.gym.create({
    data: {
      ownerId: pendingOwner.id, name: 'Kibagabaga Body Works', slug: 'kibagabaga-body-works', neighbourhood: 'Kibagabaga',
      address: 'KG 400 St, Kibagabaga', lat: -1.9318, lng: 30.1172, tags: ['CrossFit'], status: 'PENDING',
      photos: { create: [{ url: '/images/gym-2.webp', caption: 'Kibagabaga Body Works floor', sortOrder: 0 }] },
      description: 'Functional fitness box opening soon.',
    },
  });

  // ── receptionists (Iron House + Pulse Studio, to test cross-gym isolation)
  const rec1 = await mkUser('reception@demo.dive.rw', 'Josiane Iradukunda', 'RECEPTIONIST', '+250788000201');
  await prisma.gymStaff.create({ data: { gymId: gymIds.iron, userId: rec1.id } });
  const rec2 = await mkUser('reception.pulse@demo.dive.rw', 'Kevin Manzi', 'RECEPTIONIST', '+250788000202');
  await prisma.gymStaff.create({ data: { gymId: gymIds.pulse, userId: rec2.id } });

  // ── trainers
  for (const [i, t] of TRAINERS.entries()) {
    const u = await mkUser(t.email, t.name, 'TRAINER', `+25078800030${i}`);
    const trainer = await prisma.trainer.create({
      data: {
        userId: u.id,
        headline: t.headline,
        bio: `${t.name.split(' ')[0]} has coached in Kigali for ${t.years} years, focused on ${t.specialties.join(' and ').toLowerCase()}.`,
        photoUrl: t.photo ? `/images/${t.photo}.webp` : null,
        specialties: [...t.specialties],
        yearsExperience: t.years,
        languages: ['Kinyarwanda', 'English'],
        sessionFeeRwf: t.fee,
        verificationStatus: 'VERIFIED',
        verifiedAt: daysFromNow(-15),
        gyms: { create: t.gyms.map((k) => ({ gymId: gymIds[k] })) },
        availability: {
          create: [
            { weekday: 1, startTime: '06:00', endTime: '08:00', gymId: gymIds[t.gyms[0]] },
            { weekday: 3, startTime: '06:00', endTime: '08:00', gymId: gymIds[t.gyms[0]] },
            { weekday: 5, startTime: '17:00', endTime: '20:00', gymId: gymIds[t.gyms[0]] },
            { weekday: 6, startTime: '08:00', endTime: '11:00', gymId: gymIds[t.gyms[0]] },
          ],
        },
      },
    });
    void trainer;
  }
  const pendingTrainer = await mkUser('trainer.pending@demo.dive.rw', 'Samuel Ndayisaba', 'TRAINER', '+250788000399');
  await prisma.trainer.create({ data: { userId: pendingTrainer.id, headline: 'Calisthenics', specialties: ['Calisthenics'], photoUrl: '/images/coach-6.webp' } });

  // ── members + memberships (active / expired / awaiting payment)
  const member = await mkUser('member@demo.dive.rw', 'Samuel Habineza', 'MEMBER', '+250788000401');
  const sarah = await mkUser('sarah@demo.dive.rw', 'Sarah Uwase', 'MEMBER', '+250788000402');
  const kalisa = await mkUser('kalisa@demo.dive.rw', 'Kalisa Mugenzi', 'MEMBER', '+250788000403');

  async function paidMembership(memberId: string, gymKey: string, pkgIndex: number, startedDaysAgo: number) {
    const pkg = await prisma.package.findUniqueOrThrow({ where: { id: packageIds[gymKey][pkgIndex] } });
    const gym = GYMS.find((g) => g.key === gymKey)!;
    const startsAt = daysFromNow(-startedDaysAgo);
    const endsAt = new Date(startsAt.getTime() + pkg.durationDays * DAY);
    const expired = endsAt < now;
    const m = await prisma.membership.create({
      data: {
        memberId, gymId: gymIds[gymKey], packageId: pkg.id, priceRwf: pkg.priceRwf,
        status: expired ? 'EXPIRED' : 'ACTIVE', startsAt, endsAt, activatedAt: startsAt,
      },
    });
    const commission = gym.checkout && gym.commission ? Math.round(pkg.priceRwf * 0.05) : 0;
    await prisma.payment.create({
      data: {
        userId: memberId, purpose: 'MEMBERSHIP', targetId: m.id, amountRwf: pkg.priceRwf,
        commissionRwf: commission, payeeShareRwf: pkg.priceRwf - commission,
        method: gym.checkout ? 'MOMO' : 'PAID_AT_GYM', provider: gym.checkout ? 'mock' : 'gym',
        providerRef: gym.checkout ? `MOCK-SEED-${m.number}` : null,
        status: 'PAID', idempotencyKey: `seed-${m.id}`, paidAt: startsAt, verifiedAt: startsAt,
      },
    });
    return m;
  }

  await paidMembership(member.id, 'iron', 1, 10); // active monthly at Iron House
  await paidMembership(sarah.id, 'iron', 2, 30); // active 3 months at Iron House
  await paidMembership(kalisa.id, 'iron', 1, 45); // expired at Iron House
  await paidMembership(sarah.id, 'pulse', 1, 5); // active at Pulse (other gym)
  // awaiting payment at Iron House
  const pkg = await prisma.package.findUniqueOrThrow({ where: { id: packageIds.iron[1] } });
  await prisma.membership.create({
    data: { memberId: kalisa.id, gymId: gymIds.iron, packageId: pkg.id, priceRwf: pkg.priceRwf, status: 'AWAITING_PAYMENT' },
  });

  // ── more Iron House members + 30 days of check-ins + 6 months of payments (for reports)
  const FIRST = ['Alice', 'Jean', 'Grace', 'Eric', 'Divine', 'Patrick', 'Ange', 'Olivier', 'Nadine', 'Yves', 'Clarisse', 'Emmanuel', 'Josiane', 'Fabrice'];
  const LAST = ['Uwimana', 'Habimana', 'Mukamana', 'Niyonzima', 'Ishimwe', 'Mugisha', 'Uwase', 'Nshuti', 'Ingabire', 'Kayitesi', 'Ndayisaba', 'Rukundo', 'Iradukunda', 'Manzi'];
  let rnd = 7;
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const staffId = rec1.id;
  for (let i = 0; i < 14; i++) {
    const u = await mkUser(`m${i + 1}@demo.dive.rw`, `${FIRST[i]} ${LAST[(i * 5) % LAST.length]}`, 'MEMBER', `+2507880005${String(i).padStart(2, '0')}`);
    const pkgIndex = i % 3 === 0 ? 2 : 1; // 3 months or monthly
    const startedDaysAgo = Math.floor(rand() * 150) + 2;
    const m = await paidMembership(u.id, 'iron', pkgIndex, startedDaysAgo);
    // a second, older paid period for some members → revenue across months
    if (i % 2 === 0) {
      const pkgOld = await prisma.package.findUniqueOrThrow({ where: { id: packageIds.iron[1] } });
      const at = daysFromNow(-startedDaysAgo - 30);
      await prisma.payment.create({
        data: {
          userId: u.id, purpose: 'MEMBERSHIP', targetId: m.id, amountRwf: pkgOld.priceRwf, commissionRwf: Math.round(pkgOld.priceRwf * 0.05),
          payeeShareRwf: pkgOld.priceRwf - Math.round(pkgOld.priceRwf * 0.05), method: 'MOMO', provider: 'mock', providerRef: `MOCK-SEED-OLD-${m.number}`,
          status: 'PAID', idempotencyKey: `seed-old-${m.id}`, paidAt: at, verifiedAt: at, createdAt: at,
        },
      });
    }
    // check-ins while active, within the last 30 days
    const end = m.endsAt!.getTime();
    for (let d = 29; d >= 0; d--) {
      const day = daysFromNow(-d);
      if (day.getTime() > end || day.getTime() < m.startsAt!.getTime() || rand() > 0.42) continue;
      const at = new Date(day.getTime() - (day.getTime() % DAY) + (4 + Math.floor(rand() * 14)) * 3600 * 1000); // 06:00–20:00 Kigali
      await prisma.checkIn.create({ data: { membershipId: m.id, gymId: gymIds.iron, staffId, result: 'ALLOWED', createdAt: at } });
    }
  }
  // a denied attempt for the expired member (shows up in reception history)
  const expiredM = await prisma.membership.findFirstOrThrow({ where: { memberId: kalisa.id, gymId: gymIds.iron, status: 'EXPIRED' } });
  await prisma.checkIn.create({ data: { membershipId: expiredM.id, gymId: gymIds.iron, staffId, result: 'DENIED', reason: 'Membership expired', createdAt: daysFromNow(-1) } });

  // ── coaching demo: Sarah has a Coach Access Pass, a paid session with Eric, and a short thread
  const eric = await prisma.trainer.findFirstOrThrow({ where: { user: { email: 'trainer@demo.dive.rw' } }, include: { user: true } });
  const passPayAt = daysFromNow(-3);
  const passPayment = await prisma.payment.create({
    data: {
      userId: sarah.id, purpose: 'COACH_PASS', targetId: '00000000-0000-4000-8000-000000000001', amountRwf: 5000, method: 'CARD', provider: 'mock',
      providerRef: 'MOCK-SEED-PASS', status: 'PAID', idempotencyKey: 'seed-pass', paidAt: passPayAt, verifiedAt: passPayAt, createdAt: passPayAt,
      meta: { days: 30, fingerprint: 'coach-pass' },
    },
  });
  await prisma.coachAccessPass.create({ data: { id: passPayment.targetId, userId: sarah.id, paymentId: passPayment.id, priceRwf: 5000, startsAt: passPayAt, endsAt: new Date(passPayAt.getTime() + 30 * DAY) } });
  // next Saturday 08:00 Kigali (Eric is available Sat 08:00–11:00)
  const sat = new Date(now);
  sat.setUTCDate(sat.getUTCDate() + ((6 - sat.getUTCDay() + 7) % 7 || 7));
  const sessionStart = new Date(Date.UTC(sat.getUTCFullYear(), sat.getUTCMonth(), sat.getUTCDate(), 6, 0)); // 08:00 Kigali
  const booking = await prisma.booking.create({
    data: { memberId: sarah.id, trainerId: eric.id, gymId: gymIds.iron, startsAt: sessionStart, endsAt: new Date(sessionStart.getTime() + 60 * 60_000), feeRwf: eric.sessionFeeRwf!, status: 'CONFIRMED', note: 'First session — squat technique' },
  });
  await prisma.payment.create({
    data: {
      userId: sarah.id, purpose: 'SESSION', targetId: booking.id, amountRwf: eric.sessionFeeRwf!, payeeShareRwf: eric.sessionFeeRwf!, method: 'CARD', provider: 'mock',
      providerRef: 'MOCK-SEED-SESSION', status: 'PAID', idempotencyKey: 'seed-session', paidAt: daysFromNow(-2), verifiedAt: daysFromNow(-2),
      meta: { trainerId: eric.id, startsAt: sessionStart.toISOString(), fingerprint: `session:${eric.id}:${sessionStart.toISOString()}` },
    },
  });
  const convo = await prisma.conversation.create({ data: { memberId: sarah.id, trainerId: eric.id, lastMessageAt: daysFromNow(-2) } });
  await prisma.message.createMany({
    data: [
      { conversationId: convo.id, senderId: sarah.id, body: 'Hi Eric! I booked Saturday. Should I bring anything?', createdAt: daysFromNow(-2), readAt: daysFromNow(-2) },
      { conversationId: convo.id, senderId: eric.userId, body: 'Great — just water and flat shoes. We’ll start with a movement check.', createdAt: new Date(daysFromNow(-2).getTime() + 3600_000) },
    ],
  });

  await prisma.notification.create({
    data: { userId: member.id, type: 'membership.activated', title: 'Your Iron House card is active', link: '/app/cards' },
  });
  await prisma.auditLog.create({ data: { actorId: admin.id, actorRole: 'ADMIN', action: 'seed.run', entity: 'system' } });

  const counts = {
    users: await prisma.user.count(),
    gyms: await prisma.gym.count(),
    packages: await prisma.package.count(),
    trainers: await prisma.trainer.count(),
    memberships: await prisma.membership.count(),
  };
  console.log('Done:', counts);
  console.log(`\nDemo logins (password: ${DEMO_PASSWORD})`);
  console.table([
    { role: 'Member', email: 'member@demo.dive.rw' },
    { role: 'Gym owner (Iron House)', email: 'owner@demo.dive.rw' },
    { role: 'Receptionist (Iron House)', email: 'reception@demo.dive.rw' },
    { role: 'Receptionist (Pulse Studio)', email: 'reception.pulse@demo.dive.rw' },
    { role: 'Trainer', email: 'trainer@demo.dive.rw' },
    { role: 'Admin (/admin/login)', email: 'admin@demo.dive.rw' },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
