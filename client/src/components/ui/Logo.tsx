import { Link } from 'react-router';

/** DIVE-IN badge + wordmark. */
export function Logo({ compact = false, to = '/' }: { compact?: boolean; to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 text-text no-underline" aria-label="DIVE-IN Fitness Hub — home">
      <img src="/images/logo.webp" alt="" width={38} height={38} className="h-[38px] w-[38px] rounded-full ring-1 ring-gold/40" />
      <span className="disp text-[26px] tracking-[.02em]">Dive-In</span>
      {!compact && (
        <span className="ml-0.5 hidden text-[11px] font-semibold uppercase tracking-[.16em] text-dim lg:inline">Fitness Hub</span>
      )}
    </Link>
  );
}
