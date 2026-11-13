import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { GymMemberRow, GymPackageRow } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { StatusPill } from '../../components/ui/StatusPill';
import { Icon } from '../../components/ui/Icon';
import { dateTime, durationLabel, longDate, newIdempotencyKey, rwf } from '../../lib/format';
import { Empty, ErrorNote, Modal, PageHead, Skeleton } from '../ui';

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'EXPIRING', label: 'Expiring soon' },
  { id: 'AWAITING_PAYMENT', label: 'Awaiting payment' },
  { id: 'EXPIRED', label: 'Expired' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

interface Detail {
  member: GymMemberRow;
  payments: { id: string; status: string; method: string; amountRwf: number; gymShareRwf: number; commissionRwf: number; paidAt: string | null; createdAt: string }[];
  checkIns: { id: string; result: 'ALLOWED' | 'DENIED'; reason: string | null; staffName: string; createdAt: string }[];
}

function MemberPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, reload, error } = useFetch<Detail>(`/gym/members/${id}`);
  const pkgs = useFetch<{ packages: GymPackageRow[] }>('/gym/packages');
  const [pkgId, setPkgId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<'view' | 'pay' | 'cancel'>('view');
  const key = useRef(newIdempotencyKey());
  const m = data?.member;

  useEffect(() => {
    if (m && !pkgId) setPkgId(m.packageId);
  }, [m, pkgId]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      setMode('view');
      key.current = newIdempotencyKey();
      reload();
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };
  const chosen = pkgs.data?.packages.find((p) => p.id === pkgId);

  return (
    <Modal open onClose={onClose} title={m?.memberName ?? 'Member'} wide>
      {error && <ErrorNote message={error.message} />}
      {!m ? <Skeleton h={300} /> : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={m.status} />
            <span className="text-sm text-muted">{m.number}</span>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-xs font-bold tracking-[.12em] text-faint">PACKAGE</dt><dd className="m-0 mt-1 font-semibold">{m.packageName}</dd></div>
            <div><dt className="text-xs font-bold tracking-[.12em] text-faint">VALID UNTIL</dt><dd className="m-0 mt-1 font-semibold">{m.status === 'AWAITING_PAYMENT' ? '—' : longDate(m.endsAt)}</dd></div>
            <div><dt className="text-xs font-bold tracking-[.12em] text-faint">LAST VISIT</dt><dd className="m-0 mt-1 font-semibold">{m.lastCheckInAt ? longDate(m.lastCheckInAt) : '—'}</dd></div>
            <div><dt className="text-xs font-bold tracking-[.12em] text-faint">EMAIL</dt><dd className="m-0 mt-1 break-all font-semibold">{m.email}</dd></div>
            <div><dt className="text-xs font-bold tracking-[.12em] text-faint">PHONE</dt><dd className="m-0 mt-1 font-semibold">{m.phone ? <a href={`tel:${m.phone}`} className="text-text">{m.phone}</a> : '—'}</dd></div>
            <div><dt className="text-xs font-bold tracking-[.12em] text-faint">JOINED</dt><dd className="m-0 mt-1 font-semibold">{longDate(m.createdAt)}</dd></div>
          </dl>

          <div className="mt-6"><ErrorNote message={err} /></div>

          {mode === 'view' && m.status !== 'CANCELLED' && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" className="btn btn-gold !h-11" onClick={() => setMode('pay')}>
                {m.status === 'AWAITING_PAYMENT' ? 'Record payment at desk' : m.status === 'ACTIVE' ? 'Record renewal at desk' : 'Record payment to reactivate'}
              </button>
              <button type="button" className="btn btn-ghost !h-11" onClick={() => setMode('cancel')}>Cancel membership</button>
            </div>
          )}

          {mode === 'pay' && (
            <div className="mt-4 rounded-2xl border border-gold-line bg-gold-deep p-5">
              <div className="font-bold">Record money received at the front desk</div>
              <p className="mt-1 mb-4 text-sm text-chalk">Only do this after the member has actually paid you. It activates or extends their card immediately and is logged under your name.</p>
              <label className="field-label" htmlFor="pay-pkg">Package paid for</label>
              <select id="pay-pkg" className="field" value={pkgId} onChange={(e) => setPkgId(e.target.value)}>
                {pkgs.data?.packages.filter((p) => p.active || p.id === m.packageId).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {durationLabel(p.durationDays)} · {rwf(p.priceRwf)}</option>
                ))}
              </select>
              <label className="field-label mt-4" htmlFor="pay-note">Note <span className="font-normal text-faint">(optional, e.g. cash / MoMo ref)</span></label>
              <input id="pay-note" className="field" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" className="btn btn-gold !h-11" disabled={busy || !chosen} onClick={() => act(() => api(`/gym/members/${m.membershipId}/payments`, { method: 'POST', body: { packageId: pkgId, note: note || undefined }, headers: { 'Idempotency-Key': key.current } }))}>
                  {busy ? 'Saving…' : `Confirm ${chosen ? rwf(chosen.priceRwf) : ''} received`}
                </button>
                <button type="button" className="btn btn-ghost !h-11" onClick={() => setMode('view')}>Back</button>
              </div>
            </div>
          )}

          {mode === 'cancel' && (
            <div className="mt-4 rounded-2xl border border-error/30 bg-error/10 p-5">
              <div className="font-bold">Cancel this membership?</div>
              <p className="mt-1 mb-4 text-sm text-chalk">Reception will refuse entry straight away and the member is notified. Refunds, if any, are handled by you.</p>
              <label className="field-label" htmlFor="cancel-reason">Reason shown to the member <span className="font-normal text-faint">(optional)</span></label>
              <input id="cancel-reason" className="field" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" className="btn !h-11 bg-error text-[#2a0909]" disabled={busy} onClick={() => act(() => api(`/gym/members/${m.membershipId}/cancel`, { method: 'POST', body: { reason: note || undefined } }))}>
                  {busy ? 'Cancelling…' : 'Cancel membership'}
                </button>
                <button type="button" className="btn btn-ghost !h-11" onClick={() => setMode('view')}>Keep it</button>
              </div>
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <section>
              <h3 className="mb-3 text-sm font-bold tracking-[.12em] text-faint">PAYMENTS</h3>
              <ul className="m-0 list-none divide-y divide-line-soft p-0 text-sm">
                {data.payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 py-2.5">
                    <span>
                      <span className="block font-semibold">{rwf(p.amountRwf)}</span>
                      <span className="block text-xs text-muted">{p.method === 'PAID_AT_GYM' ? 'At desk' : p.method === 'CARD' ? 'Card via DIVE-IN' : 'MoMo via DIVE-IN'} · {dateTime(p.paidAt ?? p.createdAt)}</span>
                    </span>
                    <span className={`self-center rounded-full px-2.5 py-1 text-xs font-bold ${p.status === 'PAID' ? 'bg-success/15 text-success' : 'bg-field text-muted'}`}>{p.status.toLowerCase()}</span>
                  </li>
                ))}
                {data.payments.length === 0 && <li className="py-4 text-muted">No payments yet.</li>}
              </ul>
            </section>
            <section>
              <h3 className="mb-3 text-sm font-bold tracking-[.12em] text-faint">CHECK-INS</h3>
              <ul className="m-0 list-none divide-y divide-line-soft p-0 text-sm">
                {data.checkIns.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <span className={`h-2 w-2 flex-none rounded-full ${c.result === 'ALLOWED' ? 'bg-success' : 'bg-error'}`} />
                    <span className="flex-1">{dateTime(c.createdAt)}<span className="block text-xs text-muted">{c.result === 'ALLOWED' ? c.staffName : c.reason}</span></span>
                  </li>
                ))}
                {data.checkIns.length === 0 && <li className="py-4 text-muted">No visits yet.</li>}
              </ul>
            </section>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function Members() {
  useDocumentTitle('Members');
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const open = params.get('open');
  const page = Number(params.get('page') ?? 1);
  const [q, setQ] = useState(params.get('q') ?? '');

  useEffect(() => {
    const t = setTimeout(() => setParams((p) => { q ? p.set('q', q) : p.delete('q'); p.delete('page'); return p; }, { replace: true }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const qs = new URLSearchParams({ page: String(page) });
  if (status) qs.set('status', status);
  if (params.get('q')) qs.set('q', params.get('q')!);
  const { data, loading, reload } = useFetch<{ rows: GymMemberRow[]; total: number; pageSize: number }>(`/gym/members?${qs}`);
  const set = (k: string, v: string | null) => setParams((p) => { v ? p.set(k, v) : p.delete(k); if (k !== 'open') p.delete('page'); return p; });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHead eyebrow="Members" title="Members">{data ? `${data.total} membership${data.total === 1 ? '' : 's'}` : ' '}</PageHead>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex h-12 flex-1 items-center gap-2.5 rounded-2xl border border-line bg-field px-4">
          <Icon name="search" size={18} className="text-dim" />
          <span className="sr-only">Search members</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone or membership number" className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-text outline-none placeholder:text-[#6b675f]" />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className="chip !h-10 !px-4 !text-[13px]" aria-pressed={status === f.id} onClick={() => set('status', f.id || null)}>{f.label}</button>
          ))}
        </div>
      </div>

      {loading && !data ? <Skeleton h={400} /> : data && data.rows.length === 0 ? <Empty>No memberships match.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs tracking-[.1em] text-faint">
                <th className="px-5 py-3.5 font-bold">MEMBER</th>
                <th className="px-3 py-3.5 font-bold">NUMBER</th>
                <th className="px-3 py-3.5 font-bold">PACKAGE</th>
                <th className="px-3 py-3.5 font-bold">VALID UNTIL</th>
                <th className="px-3 py-3.5 font-bold">LAST VISIT</th>
                <th className="px-5 py-3.5 font-bold">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((m) => (
                <tr key={m.membershipId} className="cursor-pointer border-b border-line-soft hover:bg-surface-2" onClick={() => set('open', m.membershipId)}>
                  <td className="px-5 py-3.5">
                    <button type="button" className="text-left font-semibold text-text hover:text-gold" onClick={(e) => { e.stopPropagation(); set('open', m.membershipId); }}>{m.memberName}</button>
                    <div className="text-xs text-muted">{m.phone ?? m.email}</div>
                  </td>
                  <td className="px-3 py-3.5 tabular-nums text-chalk">{m.number}</td>
                  <td className="px-3 py-3.5 text-chalk">{m.packageName}</td>
                  <td className="px-3 py-3.5 text-chalk">{m.status === 'AWAITING_PAYMENT' ? '—' : longDate(m.endsAt)}</td>
                  <td className="px-3 py-3.5 text-chalk">{m.lastCheckInAt ? longDate(m.lastCheckInAt) : '—'}</td>
                  <td className="px-5 py-3.5"><StatusPill status={m.status} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-5 flex items-center justify-end gap-3 text-sm">
          <button type="button" className="btn btn-ghost !h-10" disabled={page <= 1} onClick={() => setParams((p) => { p.set('page', String(page - 1)); return p; })}>Previous</button>
          <span className="text-muted">Page {page} of {pages}</span>
          <button type="button" className="btn btn-ghost !h-10" disabled={page >= pages} onClick={() => setParams((p) => { p.set('page', String(page + 1)); return p; })}>Next</button>
        </div>
      )}

      {open && <MemberPanel id={open} onClose={() => set('open', null)} onChanged={reload} />}
    </>
  );
}
