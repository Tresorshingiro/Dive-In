import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { PaymentView } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Icon } from '../../components/ui/Icon';
import { rwf } from '../../lib/format';

/**
 * Where Stripe sends the member back. Arriving here proves nothing: we poll our own API,
 * which asks Stripe server-to-server, and only show success once the payment is PAID.
 */
export default function CheckoutReturn() {
  useDocumentTitle('Payment');
  const [params] = useSearchParams();
  const id = params.get('payment') ?? '';
  const cancelled = params.get('cancelled') === '1';
  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [error, setError] = useState('');
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!id) return;
    let stop = false;
    let tries = 0;
    const tick = async () => {
      try {
        const r = await api<{ payment: PaymentView }>(`/me/payments/${encodeURIComponent(id)}`);
        if (stop) return;
        setPayment(r.payment);
        if (r.payment.status !== 'PENDING' || cancelled) return;
      } catch (e) {
        if (stop) return;
        setError(e instanceof ApiError ? e.message : 'Could not check the payment');
        return;
      }
      if (++tries >= 20) return setTimedOut(true); // ~40 s
      setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [id, cancelled]);

  const state = error ? 'error' : !payment ? 'checking' : payment.status === 'PAID' ? 'paid' : payment.status === 'PENDING' ? (cancelled ? 'cancelled' : timedOut ? 'slow' : 'checking') : 'failed';

  return (
    <div className="mx-auto max-w-[560px] py-10 text-center">
      <AnimatePresence mode="wait">
        <motion.div key={state} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }}>
          {state === 'checking' && (
            <>
              <span className="mx-auto block h-16 w-16 animate-spin rounded-full border-[3px] border-line-3 border-t-gold" aria-hidden />
              <h1 className="disp mt-8 mb-3 text-[44px]">Verifying payment…</h1>
              <p className="text-muted">We’re confirming with the payment provider. This usually takes a few seconds — please keep this page open.</p>
            </>
          )}
          {state === 'paid' && payment && (
            <>
              <motion.span className="mx-auto grid h-20 w-20 place-items-center rounded-[24px] bg-gold text-gold-ink" initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
                <Icon name="check" size={36} strokeWidth={2.6} />
              </motion.span>
              <h1 className="disp mt-8 mb-3 text-[52px]">You’re in.</h1>
              <p className="text-muted">
                {rwf(payment.amountRwf)} verified for {payment.description}.{' '}
                {payment.purpose === 'MEMBERSHIP' ? 'Your card is active.' : payment.purpose === 'COACH_PASS' ? 'Every coach profile is now unlocked.' : payment.purpose === 'SESSION' ? 'Your session is confirmed and the coach has been notified.' : ''}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {payment.membershipId && <Link to={`/app/cards/${payment.membershipId}`} className="btn btn-gold">View my card</Link>}
                {payment.purpose === 'COACH_PASS' && <Link to="/coaches" className="btn btn-gold">Browse coaches</Link>}
                {payment.purpose === 'SESSION' && <Link to="/app/coaching" className="btn btn-gold">My sessions</Link>}
                <Link to="/app" className="btn btn-ghost">Go to my DIVE-IN</Link>
              </div>
            </>
          )}
          {state === 'cancelled' && (
            <>
              <h1 className="disp mb-3 text-[48px]">Payment not finished</h1>
              <p className="text-muted">You left the checkout before paying. Nothing was charged.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {payment?.checkoutUrl && <a href={payment.checkoutUrl} className="btn btn-gold">Return to checkout</a>}
                {payment?.membershipId && <Link to={`/app/cards/${payment.membershipId}`} className="btn btn-ghost">View membership</Link>}
                {payment?.purpose === 'SESSION' && <Link to="/app/coaching" className="btn btn-ghost">My sessions</Link>}
              </div>
            </>
          )}
          {state === 'failed' && payment && (
            <>
              <h1 className="disp mb-3 text-[48px]">Payment didn’t go through</h1>
              <p className="text-muted">{payment.failureReason ?? 'The payment was not completed.'} You can try again from your membership.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {payment.membershipId && <Link to={`/app/cards/${payment.membershipId}`} className="btn btn-gold">Try again</Link>}
                {payment.purpose === 'COACH_PASS' && <Link to="/coaches" className="btn btn-gold">Try again</Link>}
                {payment.purpose === 'SESSION' && <Link to="/app/coaching" className="btn btn-gold">My sessions</Link>}
              </div>
            </>
          )}
          {state === 'slow' && (
            <>
              <h1 className="disp mb-3 text-[44px]">Still confirming</h1>
              <p className="text-muted">The provider hasn’t confirmed this payment yet. We’ll notify you as soon as it does — you don’t need to pay again.</p>
              <Link to="/app" className="btn btn-gold mt-8">Go to my DIVE-IN</Link>
            </>
          )}
          {state === 'error' && (
            <>
              <h1 className="disp mb-3 text-[44px]">Couldn’t check payment</h1>
              <p className="text-error">{error}</p>
              <Link to="/app/payments" className="btn btn-ghost mt-8">Payment history</Link>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
