import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import type { CheckoutStarted, GymProfile, MyMembership, PackageView } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { durationLabel, newIdempotencyKey, rwf } from '../../lib/format';
import { EASE_DIVE } from '../motion/Reveal';
import { Icon } from '../ui/Icon';

/**
 * Confirm-and-pay sheet for one package.
 * One Idempotency-Key per opening: double clicks and retries reuse the same payment.
 */
export function CheckoutSheet({ gym, pkg, existing, onClose }: { gym: GymProfile; pkg: PackageView | null; existing: MyMembership | null; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const keyRef = useRef<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (pkg) {
      keyRef.current = newIdempotencyKey();
      setError('');
      setBusy(false);
    }
  }, [pkg]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const renewal = existing?.status === 'ACTIVE';
  const online = gym.diveCheckoutEnabled;

  const pay = async () => {
    if (!pkg) return;
    setBusy(true);
    setError('');
    try {
      if (online) {
        const r = await api<CheckoutStarted>('/me/memberships/checkout', { method: 'POST', body: { packageId: pkg.id }, headers: { 'Idempotency-Key': keyRef.current } });
        window.location.assign(r.redirectUrl); // Stripe-hosted checkout
      } else {
        const r = await api<{ membership: MyMembership }>('/me/memberships/request', { method: 'POST', body: { packageId: pkg.id } });
        navigate(`/app/cards/${r.membership.id}`);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {pkg && (
        <motion.div className="fixed inset-0 z-[1100] flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !busy && onClose()} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            className="relative w-full max-w-[520px] rounded-t-[30px] border border-line-2 bg-ink p-6 sm:rounded-[30px] sm:p-8"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE_DIVE }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow mb-2">{renewal ? 'Renew membership' : 'Join'} · {gym.name}</div>
                <h2 id="checkout-title" className="disp m-0 text-[40px]">{pkg.name}</h2>
              </div>
              <button type="button" onClick={onClose} disabled={busy} className="grid h-10 w-10 flex-none place-items-center rounded-full border border-line-2 text-text" aria-label="Close">
                <Icon name="close" size={18} />
              </button>
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-line bg-surface p-5 text-[15px]">
              <div className="flex justify-between gap-4"><dt className="text-muted">Gym</dt><dd className="m-0 font-semibold">{gym.name} · {gym.neighbourhood}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Length</dt><dd className="m-0 font-semibold">{durationLabel(pkg.durationDays)}</dd></div>
              {renewal && existing?.endsAt && (
                <div className="flex justify-between gap-4"><dt className="text-muted">Adds to current card</dt><dd className="m-0 font-semibold">{existing.number}</dd></div>
              )}
              <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3"><dt className="text-muted">Total</dt><dd className="disp m-0 text-[34px] text-gold">{rwf(pkg.priceRwf)}</dd></div>
            </dl>

            {online ? (
              <div className="mt-5 flex flex-col gap-2 text-sm text-muted">
                <div className="flex items-center gap-2.5 rounded-xl border border-gold-line bg-gold-deep px-4 py-3 text-chalk">
                  <Icon name="shield" size={16} className="flex-none text-gold" />
                  You’ll pay by card on Stripe’s secure page. Your card activates as soon as Stripe confirms the payment to DIVE-IN.
                </div>
                <div className="flex items-center gap-2 px-1 text-[13px] text-faint"><Icon name="clock" size={14} /> Mobile Money is coming soon.</div>
              </div>
            ) : (
              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-chalk">
                <Icon name="pin" size={16} className="mt-0.5 flex-none text-gold" />
                {gym.name} collects payment at the front desk. We’ll reserve your membership; reception activates it when you pay.
              </div>
            )}

            {error && <p className="mt-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">{error}</p>}

            {!user ? (
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Link to="/login" state={{ from: `${location.pathname}?package=${pkg.id}` }} className="btn btn-gold w-full">Log in to continue</Link>
                <Link to={`/register?role=MEMBER`} state={{ from: `${location.pathname}?package=${pkg.id}` }} className="btn btn-ghost w-full">Create free account</Link>
              </div>
            ) : user.role !== 'MEMBER' ? (
              <p className="mt-6 text-sm text-warning">Memberships are bought with a member account. You’re signed in as {user.role.toLowerCase().replace('_', ' ')}.</p>
            ) : (
              <button type="button" onClick={pay} disabled={busy} className="btn btn-gold mt-6 !h-[58px] w-full">
                {busy ? (online ? 'Opening secure checkout…' : 'Reserving…') : online ? `Pay ${rwf(pkg.priceRwf)}` : 'Reserve and pay at reception'}
                {!busy && <Icon name="arrowRight" size={16} strokeWidth={2.4} />}
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
