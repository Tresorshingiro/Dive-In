import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { CheckoutStarted, MyMembership } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Reveal } from '../../components/motion/Reveal';
import { Icon } from '../../components/ui/Icon';
import { StatusPill } from '../../components/ui/StatusPill';
import { MemberCard } from './MemberCard';
import { daysLeft, longDate, newIdempotencyKey, rwf } from '../../lib/format';

export function CardsList() {
  useDocumentTitle('My cards');
  const { data, loading } = useFetch<{ memberships: MyMembership[] }>('/me/memberships');
  const list = data?.memberships ?? [];
  return (
    <>
      <div className="eyebrow mb-4">Digital membership cards</div>
      <h1 className="disp m-0 text-[52px] sm:text-[72px]">My cards</h1>
      {loading && !data && <div className="mt-10 h-[280px] max-w-[520px] animate-pulse rounded-[22px] bg-surface" />}
      {data && list.length === 0 && (
        <p className="lead mt-6">
          No memberships yet. <Link to="/gyms" className="text-gold">Find a gym</Link> to get your first card.
        </p>
      )}
      <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
        {list.map((m, i) => (
          <Reveal key={m.id} delay={Math.min(i, 3) * 0.08}>
            <Link to={`/app/cards/${m.id}`} className="block no-underline" aria-label={`${m.gym.name} card`}>
              <MemberCard m={m} flippable={false} />
            </Link>
          </Reveal>
        ))}
      </div>
    </>
  );
}

export function CardPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useFetch<{ membership: MyMembership }>(`/me/memberships/${id}`);
  const m = data?.membership;
  useDocumentTitle(m ? `${m.gym.name} card` : 'Card');
  const [busy, setBusy] = useState<'pay' | 'cancel' | null>(null);
  const [err, setErr] = useState('');

  if (loading && !m) return <div className="h-[300px] max-w-[520px] animate-pulse rounded-[22px] bg-surface" />;
  if (error || !m) return <p className="text-error">{error?.message ?? 'Card not found'}</p>;

  const payNow = async () => {
    setBusy('pay');
    setErr('');
    try {
      if (m.lastPayment?.checkoutUrl) return window.location.assign(m.lastPayment.checkoutUrl);
      const r = await api<CheckoutStarted>('/me/memberships/checkout', { method: 'POST', body: { packageId: m.package.id }, headers: { 'Idempotency-Key': newIdempotencyKey() } });
      window.location.assign(r.redirectUrl);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not start payment');
      setBusy(null);
    }
  };
  const cancel = async () => {
    if (!confirm('Cancel this membership request? You can start again any time.')) return;
    setBusy('cancel');
    try {
      await api(`/me/memberships/${m.id}/cancel`, { method: 'POST' });
      navigate('/app/cards');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not cancel');
      setBusy(null);
      reload();
    }
  };

  const left = daysLeft(m.endsAt);

  return (
    <>
      <Link to="/app/cards" className="mb-6 inline-flex items-center gap-2 text-sm text-muted no-underline hover:text-text">
        <Icon name="arrowRight" size={14} className="rotate-180" /> My cards
      </Link>
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Reveal className="w-full max-w-[520px]">
          <MemberCard m={m} />
          <p className="mt-4 text-center text-xs tracking-[.06em] text-faint">TAP THE CARD TO SEE WHAT RECEPTION SEES</p>
        </Reveal>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={m.status} />
            {m.status === 'ACTIVE' && left !== null && left <= 7 && <span className="text-sm text-warning">Expires in {left} day{left === 1 ? '' : 's'}</span>}
          </div>
          <h1 className="disp mt-4 mb-0 text-[48px] sm:text-[64px]">{m.gym.name}</h1>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-[15px]">
            <div><dt className="text-xs font-bold tracking-[.12em] text-faint">MEMBERSHIP NO.</dt><dd className="m-0 mt-1 font-semibold">{m.number}</dd></div>
            <div><dt className="text-xs font-bold tracking-[.12em] text-faint">PLAN</dt><dd className="m-0 mt-1 font-semibold">{m.package.name}</dd></div>
            <div><dt className="text-xs font-bold tracking-[.12em] text-faint">STARTED</dt><dd className="m-0 mt-1 font-semibold">{longDate(m.startsAt)}</dd></div>
            <div><dt className="text-xs font-bold tracking-[.12em] text-faint">VALID UNTIL</dt><dd className="m-0 mt-1 font-semibold">{m.status === 'AWAITING_PAYMENT' ? 'After payment' : longDate(m.endsAt)}</dd></div>
          </dl>

          {err && <p className="mt-6 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">{err}</p>}

          {m.status === 'AWAITING_PAYMENT' && m.gym.diveCheckoutEnabled && (
            <div className="mt-8 rounded-[22px] border border-gold-line bg-gold-deep p-6">
              <div className="font-bold">Waiting for payment</div>
              <p className="mt-1 mb-5 text-sm text-chalk">
                {m.lastPayment?.status === 'PENDING' ? 'Your checkout is still open. Finish paying to activate the card.' : 'Pay to activate your card. It goes live once the payment provider confirms it.'}
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn btn-gold" disabled={!!busy} onClick={payNow}>{busy === 'pay' ? 'Opening checkout…' : `Pay ${rwf(m.priceRwf)}`}</button>
                <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={cancel}>Cancel request</button>
              </div>
            </div>
          )}
          {m.status === 'AWAITING_PAYMENT' && !m.gym.diveCheckoutEnabled && (
            <div className="mt-8 rounded-[22px] border border-gold-line bg-gold-deep p-6">
              <div className="font-bold">Pay at {m.gym.name} reception</div>
              <p className="mt-1 mb-5 text-sm text-chalk">Give reception your name or membership number <strong className="text-text">{m.number}</strong> and pay {rwf(m.priceRwf)}. They’ll activate this card on the spot.</p>
              <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={cancel}>Cancel request</button>
            </div>
          )}
          {(m.status === 'ACTIVE' || m.status === 'EXPIRED') && (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={`/gyms/${m.gym.slug}`} className="btn btn-gold">{m.status === 'ACTIVE' ? 'Renew or change plan' : 'Rejoin'}</Link>
              <Link to="/app/payments" className="btn btn-ghost">Payment history</Link>
            </div>
          )}

          <div className="mt-10 rounded-[22px] border border-line bg-surface p-6 text-sm text-muted">
            <div className="mb-2 flex items-center gap-2 font-bold text-text"><Icon name="shield" size={16} className="text-gold" /> How reception checks you in</div>
            Reception looks up your <strong className="text-chalk">live record</strong> by your name or membership number. The card has no QR code, and a screenshot is never accepted: if your membership expires or isn’t paid, the desk sees it immediately.
          </div>
        </div>
      </div>
    </>
  );
}
