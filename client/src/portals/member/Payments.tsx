import { Link } from 'react-router';
import type { NotificationView, PaymentView } from '@dive/shared';
import { api } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { dateTime, rwf, timeAgo } from '../../lib/format';

const STATUS: Record<PaymentView['status'], { label: string; cls: string }> = {
  PAID: { label: 'Paid', cls: 'bg-success/15 text-success' },
  PENDING: { label: 'Pending', cls: 'bg-warning/15 text-warning' },
  FAILED: { label: 'Failed', cls: 'bg-error/15 text-error' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-field text-muted' },
  REFUNDED: { label: 'Refunded', cls: 'bg-field text-muted' },
};

const METHOD: Record<PaymentView['method'], string> = { CARD: 'Card', MOMO: 'Mobile Money', PAID_AT_GYM: 'Paid at gym' };

export function Payments() {
  useDocumentTitle('Payments');
  const { data, loading } = useFetch<{ payments: PaymentView[] }>('/me/payments');
  const list = data?.payments ?? [];
  return (
    <>
      <div className="eyebrow mb-4">History</div>
      <h1 className="disp m-0 text-[52px] sm:text-[72px]">Payments</h1>
      <p className="lead mt-3">A payment shows as paid only after the payment provider confirms it to DIVE-IN.</p>
      <div className="card mt-8 overflow-hidden">
        {loading && !data && <div className="h-40 animate-pulse" />}
        {data && list.length === 0 && <p className="m-0 p-8 text-center text-muted">No payments yet.</p>}
        <ul className="m-0 list-none divide-y divide-line-soft p-0">
          {list.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <Link to={`/app/payments/${p.id}`} className="font-semibold text-text hover:text-gold">{p.description}</Link>
                <div className="mt-1 text-[13px] text-muted">
                  {dateTime(p.paidAt ?? p.createdAt)} · {METHOD[p.method]}
                  {p.failureReason && p.status !== 'PAID' && <> · {p.failureReason}</>}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {p.checkoutUrl && <a href={p.checkoutUrl} className="text-sm font-semibold text-gold no-underline">Finish paying</a>}
                {p.membershipId && p.status === 'PAID' && <Link to={`/app/cards/${p.membershipId}`} className="text-sm text-gold no-underline">Card</Link>}
                <span className="font-semibold tabular-nums">{rwf(p.amountRwf)}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function Notifications() {
  useDocumentTitle('Notifications');
  const { data, reload } = useFetch<{ notifications: NotificationView[]; unread: number }>('/me/notifications');
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-4">Updates</div>
          <h1 className="disp m-0 text-[52px] sm:text-[72px]">Notifications</h1>
        </div>
        {!!data?.unread && (
          <button type="button" className="btn btn-ghost !h-11" onClick={async () => { await api('/me/notifications/read', { method: 'POST', body: {} }); reload(); }}>
            Mark all read
          </button>
        )}
      </div>
      <div className="card mt-8 divide-y divide-line-soft">
        {(data?.notifications ?? []).map((n) => (
          <div key={n.id} className="flex gap-3 px-5 py-4 sm:px-6">
            <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${n.readAt ? 'bg-line-3' : 'bg-gold'}`} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{n.title}</div>
              {n.body && <div className="mt-0.5 text-sm text-muted">{n.body}</div>}
              {n.link && <Link to={n.link} className="mt-1 inline-block text-sm text-gold no-underline">Open →</Link>}
            </div>
            <span className="text-xs whitespace-nowrap text-faint">{timeAgo(n.createdAt)}</span>
          </div>
        ))}
        {data && data.notifications.length === 0 && <p className="m-0 p-8 text-center text-muted">Nothing yet.</p>}
      </div>
    </>
  );
}
