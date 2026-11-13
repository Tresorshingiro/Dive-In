import { ROLE_HOME, type Role } from '@dive/shared';

/**
 * Where to go after login/register. A `from` path is honoured only if it's a same-site path
 * inside this role's area (members may also return to a gym page to finish checkout).
 */
export function afterAuthPath(role: Role, from?: string | null) {
  const home = ROLE_HOME[role];
  if (!from || !from.startsWith('/') || from.startsWith('//')) return home;
  if (from.startsWith(home)) return from;
  if (role === 'MEMBER' && (from.startsWith('/gyms/') || from === '/gyms')) return from;
  return home;
}
