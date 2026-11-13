const TZ = 'Africa/Kigali';

export const rwf = (n: number) => `RWF ${n.toLocaleString('en-US')}`;

export const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: TZ }) : '—';

export const longDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }) : '—';

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ });

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return longDate(iso);
}

/** "30 days" → "1 month" etc., for package durations. */
export function durationLabel(days: number) {
  if (days === 1) return '1 day';
  if (days === 7) return '1 week';
  if (days >= 28 && days <= 31) return '1 month';
  if (days === 90) return '3 months';
  if (days === 180) return '6 months';
  if (days === 365) return '1 year';
  return `${days} days`;
}

export function daysLeft(endsAt: string | null) {
  if (!endsAt) return null;
  return Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000);
}

export const WEEKDAYS: Array<[string, string]> = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
];

export const newIdempotencyKey = () => `dive-${crypto.randomUUID()}`;
