/** Kigali is UTC+2 all year (no daylight saving). */
const OFFSET_MS = 2 * 60 * 60 * 1000;

/** Start of the current Kigali calendar day, as a UTC Date. */
export function kigaliDayStart(d = new Date()): Date {
  const local = new Date(d.getTime() + OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - OFFSET_MS);
}

/** Start of the Kigali calendar month `monthsAgo` months back, as a UTC Date. */
export function kigaliMonthStart(monthsAgo = 0, d = new Date()): Date {
  const local = new Date(d.getTime() + OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - monthsAgo, 1) - OFFSET_MS);
}

export const DAY_MS = 24 * 60 * 60 * 1000;
