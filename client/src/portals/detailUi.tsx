import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { ActivityItem } from '@dive/shared';
import { Icon } from '../components/ui/Icon';
import { dateTime, timeAgo } from '../lib/format';

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="mb-6 inline-flex items-center gap-2 text-sm text-muted no-underline hover:text-text">
      <Icon name="arrowRight" size={14} className="rotate-180" /> {children}
    </Link>
  );
}

export function Section({ title, children, actions, className = '' }: { title: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`card p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="disp m-0 text-[24px]">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Label/value grid. Empty values show a dash. */
export function Fields({ items, cols = 2 }: { items: Array<[string, ReactNode]>; cols?: 2 | 3 }) {
  return (
    <dl className={`m-0 grid grid-cols-1 gap-x-6 gap-y-4 text-sm ${cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs font-bold tracking-[.12em] text-faint uppercase">{k}</dt>
          <dd className="m-0 mt-1 break-words font-semibold text-text">{v === null || v === undefined || v === '' ? <span className="font-normal text-faint">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pills({ items, empty = 'None' }: { items: string[]; empty?: string }) {
  if (!items.length) return <span className="text-sm text-faint">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => <span key={t} className="rounded-full border border-line bg-field px-3 py-1 text-[13px] text-chalk">{t}</span>)}
    </div>
  );
}

const TONE: Record<string, string> = {
  PENDING: 'bg-warning/15 text-warning', PENDING_PAYMENT: 'bg-warning/15 text-warning', AWAITING_PAYMENT: 'bg-warning/15 text-warning',
  APPROVED: 'bg-success/15 text-success', VERIFIED: 'bg-success/15 text-success', ACTIVE: 'bg-success/15 text-success', PAID: 'bg-success/15 text-success', CONFIRMED: 'bg-success/15 text-success', ALLOWED: 'bg-success/15 text-success',
  REJECTED: 'bg-error/15 text-error', SUSPENDED: 'bg-error/15 text-error', FAILED: 'bg-error/15 text-error', DENIED: 'bg-error/15 text-error', CANCELLED: 'bg-error/15 text-error',
};
export function Tag({ s }: { s: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONE[s] ?? 'bg-field text-muted'}`}>{s.replace(/_/g, ' ')}</span>;
}

/** Audit trail rows: "Approved the gym · DIVE-IN Admin · 2 h ago". */
export function Activity({ items }: { items: ActivityItem[] }) {
  if (!items.length) return <p className="m-0 text-sm text-faint">Nothing logged yet.</p>;
  return (
    <ul className="m-0 list-none divide-y divide-line-soft p-0">
      {items.map((a) => (
        <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 text-sm">
          <code className="text-[13px] text-gold">{a.action}</code>
          <span className="flex-1 text-chalk">{a.actorName ?? 'System'}{a.actorRole ? ` · ${a.actorRole.toLowerCase().replace('_', ' ')}` : ''}</span>
          <span className="text-xs text-faint" title={dateTime(a.createdAt)}>{timeAgo(a.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

export function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-ink px-4 py-3">
      <div className="text-[11px] font-bold tracking-[.12em] text-faint uppercase">{label}</div>
      <div className="disp mt-1 text-[26px]">{value}</div>
    </div>
  );
}
