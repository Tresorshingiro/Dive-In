import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { GymSubscriptionView, PaymentView } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { longDate, newIdempotencyKey, rwf } from '../../lib/format';
import { ErrorNote, PageHead, Skeleton } from '../ui';
import { useGym } from './GymLayout';

export default function Subscription() {
  useDocumentTitle('Partner plan');
  const { gym } = useGym();
  const [params, setParams] = useSearchParams();
  const returned = params.get('payment');
  const { data, reload } = useFetch<{ subscription: GymSubscriptionView }>('/gym/subscription');
  const [plan, setPlan] = useState('MONTHLY');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const key = useRef(newIdempotencyKey());

  // Back from checkout: ask the server (which asks the provider) until it's settled.
  useEffect(() => {
    if (!returned) return;
    let stop = false;
    let n = 0;
    const tick = async () => {
      try {
        const r = await api<{ payment: PaymentView }>(`/payments/${returned}`);
        if (stop) return;
        if (r.payment.status === 'PAID') { setNotice('Payment verified — your partner plan is extended.'); reload(); setParams({}, { replace: true }); return; }
        if (r.payment.status !== 'PENDING' || params.get('cancelled')) { setNotice(params.get('cancelled') ? 'Checkout cancelled. Nothing was charged.' : 'The payment did not go through.'); setParams({}, { replace: true }); return; }
      } catch { /* retry */ }
      if (++n < 20 && !stop) setTimeout(tick, 2000);
      else if (!stop) setNotice('Still waiting for the provider to confirm. Refresh in a minute.');
    };
    setNotice('Verifying payment with the provider…');
    void tick();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returned]);

  if (!data) return <Skeleton h={400} />;
  const s = data.subscription;
  const chosen = s.plans.find((p) => p.id === plan);

  const pay = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ redirectUrl: string }>('/gym/subscription/checkout', { method: 'POST', body: { plan }, headers: { 'Idempotency-Key': key.current } });
      window.location.assign(r.redirectUrl);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not start checkout');
      key.current = newIdempotencyKey();
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead eyebrow="DIVE-IN partner plan" title="Partner plan">Your gym’s subscription to DIVE-IN: profile, packages, members, reception and reports. Prices are proposals during the pilot.</PageHead>
      {notice && <div className="mb-6 rounded-2xl border border-gold-line bg-gold-deep px-5 py-4 text-sm text-chalk" role="status">{notice}</div>}

      <div className="card mb-6 p-6">
        {s.current ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold tracking-[.12em] text-faint">CURRENT PLAN</div>
              <div className="disp mt-2 text-[40px]">{s.current.plan === 'TRIAL' ? 'Free trial' : s.current.plan.toLowerCase()}</div>
              <div className="mt-1 text-sm text-muted">Paid up until {longDate(s.current.endsAt)} · {s.current.daysLeft} days left</div>
            </div>
            {s.current.daysLeft <= 10 && <span className="rounded-full bg-warning/15 px-3 py-1.5 text-xs font-bold text-warning">RENEW SOON</span>}
          </div>
        ) : (
          <div className="text-sm text-chalk">{gym.status === 'APPROVED' ? 'No active plan. Choose one below to stay listed.' : 'Your free trial starts when DIVE-IN approves your gym.'}</div>
        )}
      </div>

      {gym.status === 'APPROVED' && (
        <section className="card p-6">
          <h2 className="disp m-0 mb-4 text-[28px]">Extend your plan</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="radiogroup" aria-label="Plan">
            {s.plans.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={plan === p.id} onClick={() => setPlan(p.id)} className={`rounded-[20px] border p-4 text-left transition-colors ${plan === p.id ? 'border-gold bg-gold-deep' : 'border-line bg-surface hover:border-[#5a5a5a]'}`}>
                <div className="text-sm font-bold">{p.label}</div>
                <div className="disp mt-2 text-[26px] text-gold">{rwf(p.priceRwf)}</div>
                <div className="text-xs text-muted">{p.months} month{p.months > 1 ? 's' : ''}{p.months > 1 ? ` · ${rwf(Math.round(p.priceRwf / p.months))}/mo` : ''}</div>
              </button>
            ))}
          </div>
          <div className="mt-4"><ErrorNote message={err} /></div>
          <button type="button" className="btn btn-gold mt-4" disabled={busy || !chosen} onClick={pay}>{busy ? 'Opening checkout…' : `Pay ${chosen ? rwf(chosen.priceRwf) : ''} by card`}</button>
          <p className="mt-3 mb-0 text-xs text-faint">The new period starts when your current one ends, so paying early never loses days.</p>
        </section>
      )}

      {s.history.length > 0 && (
        <section className="mt-8">
          <h2 className="disp mb-4 text-[28px]">History</h2>
          <div className="card divide-y divide-line-soft">
            {s.history.map((h) => (
              <div key={h.id} className="flex justify-between px-5 py-3 text-sm">
                <span>{h.plan === 'TRIAL' ? 'Free trial' : h.plan.toLowerCase()} · {longDate(h.startsAt)} → {longDate(h.endsAt)}</span>
                <span className="font-semibold tabular-nums">{h.priceRwf ? rwf(h.priceRwf) : 'Free'}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
