import { useState } from 'react';
import { Link } from 'react-router';
import type { BookingView, CoachPassStatus } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Messages } from '../../components/Messages';
import { Photo } from '../../components/ui/Photo';
import { longDate, rwf } from '../../lib/format';

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' });
const STATUS: Record<BookingView['status'], { label: string; cls: string }> = {
  CONFIRMED: { label: 'Confirmed', cls: 'bg-success/15 text-success' },
  PENDING_PAYMENT: { label: 'Awaiting payment', cls: 'bg-warning/15 text-warning' },
  COMPLETED: { label: 'Completed', cls: 'bg-field text-chalk' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-error/15 text-error' },
  EXPIRED: { label: 'Expired', cls: 'bg-field text-muted' },
};

export function BookingStatus({ s }: { s: BookingView['status'] }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS[s].cls}`}>{STATUS[s].label}</span>;
}

export default function Coaching() {
  useDocumentTitle('Coaching');
  const pass = useFetch<{ pass: CoachPassStatus }>('/me/coach-pass');
  const { data, reload } = useFetch<{ bookings: BookingView[] }>('/me/bookings');
  const [err, setErr] = useState('');
  const now = Date.now();
  const list = data?.bookings ?? [];
  const upcoming = list.filter((b) => new Date(b.endsAt).getTime() > now && (b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT')).reverse();
  const past = list.filter((b) => !upcoming.includes(b));
  const p = pass.data?.pass;

  const cancel = async (b: BookingView) => {
    const paid = b.status === 'CONFIRMED';
    if (!confirm(paid ? 'Cancel this paid session? DIVE-IN refunds you if it is more than 24 hours away.' : 'Cancel this booking?')) return;
    setErr('');
    try {
      await api(`/me/bookings/${b.id}/cancel`, { method: 'POST', body: {} });
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not cancel');
    }
  };

  return (
    <>
      <div className="eyebrow mb-4">Coaching</div>
      <h1 className="disp m-0 text-[52px] sm:text-[72px]">Coaching</h1>

      <div className={`mt-8 flex flex-wrap items-center justify-between gap-5 rounded-[24px] border p-6 ${p?.active ? 'border-success/30 bg-[rgba(76,201,122,.06)]' : 'border-gold-line bg-gold-deep'}`}>
        <div>
          <div className="font-bold">Coach Access Pass</div>
          <div className="mt-1 text-sm text-chalk">
            {p?.active ? `Active until ${longDate(p.endsAt)}. Browse coaches, message them and book sessions.` : `Unlock full coach profiles, availability, messaging and booking — ${p ? rwf(p.priceRwf) : ''} for ${p?.days ?? 30} days.`}
          </div>
        </div>
        <Link to="/coaches" className="btn btn-gold !h-11">{p?.active ? 'Find a coach' : 'Get the pass'}</Link>
      </div>

      {err && <p className="mt-5 text-sm text-error" role="alert">{err}</p>}

      <h2 className="disp mt-12 mb-4 text-[32px]">Upcoming sessions</h2>
      <div className="flex flex-col gap-3">
        {upcoming.map((b) => (
          <div key={b.id} className="card flex flex-wrap items-center gap-4 p-4">
            <Photo src={b.trainer.photoUrl} alt="" className="h-14 w-14 flex-none rounded-2xl" />
            <div className="min-w-0 flex-1">
              <div className="font-bold">{b.trainer.fullName}</div>
              <div className="text-sm text-muted">{when(b.startsAt)}{b.gym ? ` · ${b.gym.name}` : ''} · {rwf(b.feeRwf)}</div>
            </div>
            <BookingStatus s={b.status} />
            {b.status === 'PENDING_PAYMENT' && b.payment?.checkoutUrl && <a href={b.payment.checkoutUrl} className="btn btn-gold !h-10 !px-4 !text-[13px]">Pay now</a>}
            <button type="button" className="btn btn-ghost !h-10 !px-4 !text-[13px]" onClick={() => cancel(b)}>Cancel</button>
          </div>
        ))}
        {data && upcoming.length === 0 && <p className="m-0 text-muted">No upcoming sessions. <Link to="/coaches" className="text-gold">Book a coach</Link>.</p>}
      </div>

      {past.length > 0 && (
        <>
          <h2 className="disp mt-12 mb-4 text-[32px]">History</h2>
          <div className="card divide-y divide-line-soft">
            {past.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm">
                <span><strong>{b.trainer.fullName}</strong> <span className="text-muted">· {when(b.startsAt)}{b.cancelReason ? ` · ${b.cancelReason}` : ''}</span></span>
                <BookingStatus s={b.status} />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function MemberMessages() {
  useDocumentTitle('Messages');
  return (
    <>
      <div className="eyebrow mb-4">Messages</div>
      <h1 className="disp m-0 mb-8 text-[52px] sm:text-[72px]">Messages</h1>
      <Messages emptyHint="Message a coach from their profile to start a conversation." />
    </>
  );
}
