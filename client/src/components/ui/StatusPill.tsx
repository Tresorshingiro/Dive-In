import type { MembershipStatus } from '@dive/shared';

const STYLES: Record<MembershipStatus, { bg: string; fg: string; label: string }> = {
  ACTIVE: { bg: 'rgba(76,201,122,.14)', fg: '#6FDB97', label: 'ACTIVE' },
  AWAITING_PAYMENT: { bg: 'rgba(232,179,60,.12)', fg: '#F0C35C', label: 'AWAITING PAYMENT' },
  EXPIRED: { bg: 'rgba(255,107,107,.12)', fg: '#FF8A8A', label: 'EXPIRED' },
  CANCELLED: { bg: 'rgba(168,163,154,.12)', fg: '#A8A39A', label: 'CANCELLED' },
};

export function StatusPill({ status, size = 'md' }: { status: MembershipStatus; size?: 'sm' | 'md' | 'lg' }) {
  const s = STYLES[status];
  const dims = size === 'sm' ? 'h-[26px] px-2.5 text-[11px] gap-1.5' : size === 'lg' ? 'h-[30px] px-3 text-xs gap-1.5' : 'h-8 px-3.5 text-xs gap-2';
  return (
    <span className={`inline-flex items-center rounded-full font-bold tracking-[.08em] ${dims}`} style={{ background: s.bg, color: s.fg }}>
      <span className="rounded-full" style={{ width: size === 'lg' ? 8 : 7, height: size === 'lg' ? 8 : 7, background: s.fg }} />
      {s.label}
    </span>
  );
}
