import { useState } from 'react';
import { useParams } from 'react-router';
import { api, ApiError } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { Logo } from '../../components/ui/Logo';

/** Stand-in for a provider's hosted page when PAYMENT_PROVIDER=mock (offline dev and tests). */
export default function MockPay() {
  const { id = '' } = useParams();
  const { data, error } = useFetch<{ id: string; status: string; amount: string }>(`/payments/mock/${id}`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const finish = async (outcome: 'success' | 'fail') => {
    setBusy(true);
    try {
      const r = await api<{ returnUrl: string }>(`/payments/mock/${id}/complete`, { method: 'POST', body: { outcome } });
      window.location.assign(r.returnUrl);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed');
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#f6f5f2] p-5 text-[#111]">
      <div className="w-full max-w-[420px] rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="rounded-lg bg-[#111] px-2 py-1"><Logo compact /></div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">TEST PROVIDER</span>
        </div>
        {error ? (
          <p className="text-red-600">{error.message}</p>
        ) : (
          <>
            <div className="text-sm text-gray-500">Amount due</div>
            <div className="mt-1 text-4xl font-bold">{data?.amount ?? '…'}</div>
            <p className="mt-4 text-sm text-gray-500">This page imitates a payment provider. The result is sent to DIVE-IN as a signed webhook, just like a real one.</p>
            {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
            <div className="mt-6 grid gap-3">
              <button type="button" disabled={busy || data?.status !== 'PENDING'} onClick={() => finish('success')} className="h-12 rounded-full bg-[#111] font-semibold text-white disabled:opacity-50">Pay successfully</button>
              <button type="button" disabled={busy || data?.status !== 'PENDING'} onClick={() => finish('fail')} className="h-12 rounded-full border border-gray-300 font-semibold disabled:opacity-50">Decline payment</button>
            </div>
            {data && data.status !== 'PENDING' && <p className="mt-4 text-center text-sm text-gray-500">This payment is already {data.status.toLowerCase()}.</p>}
          </>
        )}
      </div>
    </div>
  );
}
