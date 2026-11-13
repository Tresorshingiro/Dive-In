import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { CheckInOutcome, CheckInView, ReceptionResult } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { EASE_DIVE } from '../../components/motion/Reveal';
import { Icon } from '../../components/ui/Icon';
import { StatusPill } from '../../components/ui/StatusPill';
import { longDate } from '../../lib/format';
import { useGym } from './GymLayout';
import { ErrorNote } from '../ui';

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' });

export default function Reception() {
  useDocumentTitle('Reception');
  const { gym } = useGym();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ReceptionResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const today = useFetch<{ checkIns: CheckInView[] }>('/gym/reception/today');

  // refresh today's list every 30 s (other desks may be checking people in)
  useEffect(() => {
    const t = setInterval(today.reload, 30_000);
    return () => clearInterval(t);
  }, [today.reload]);

  const runSearch = async (term: string) => {
    if (term.trim().length < 2) return setResults(null);
    setSearching(true);
    setError('');
    try {
      const r = await api<{ results: ReceptionResult[] }>(`/gym/reception/search?q=${encodeURIComponent(term.trim())}`);
      setResults(r.results);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => void runSearch(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const checkIn = async (r: ReceptionResult) => {
    setBusy(r.membershipId);
    try {
      const out = await api<CheckInOutcome>('/gym/reception/check-in', { method: 'POST', body: { membershipId: r.membershipId } });
      const ok = out.checkIn.result === 'ALLOWED';
      setToast({
        ok,
        text: ok
          ? out.duplicate
            ? `${out.checkIn.memberName} was already checked in at ${time(out.checkIn.createdAt)}`
            : `${out.checkIn.memberName} checked in`
          : `Entry refused for ${out.checkIn.memberName}: ${out.checkIn.reason}`,
      });
      today.reload();
      await runSearch(q); // re-read the live record
      // ready for the next person
      setTimeout(() => {
        setQ('');
        setResults(null);
        input.current?.focus();
      }, 1400);
    } catch (e) {
      setToast({ ok: false, text: e instanceof ApiError ? e.message : 'Check-in failed' });
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const list = today.data?.checkIns ?? [];
  const inToday = list.filter((c) => c.result === 'ALLOWED').length;

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        <div className="eyebrow mb-3">Reception · {gym.name}</div>
        <h1 className="disp m-0 text-[44px] sm:text-[60px]">Who’s at the desk?</h1>
        <p className="mt-3 mb-7 text-[15px] text-muted">Search by name or membership number. You’re seeing the live record — never accept a screenshot of a card.</p>

        <label className="flex h-[68px] items-center gap-3 rounded-[22px] border border-line-2 bg-field px-5 focus-within:border-gold">
          <Icon name="search" size={22} strokeWidth={2} className="flex-none text-dim" />
          <span className="sr-only">Member name or membership number</span>
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Samuel, or DV-0000-0010"
            className="min-w-0 flex-1 border-0 bg-transparent text-lg font-medium text-text outline-none placeholder:text-[#6b675f]"
            autoComplete="off"
            spellCheck={false}
          />
          {searching && <span className="h-5 w-5 flex-none animate-spin rounded-full border-2 border-line-3 border-t-gold" aria-hidden />}
          {q && !searching && (
            <button type="button" className="text-sm text-muted hover:text-text" onClick={() => { setQ(''); input.current?.focus(); }}>Clear</button>
          )}
        </label>

        <div className="mt-5"><ErrorNote message={error} /></div>

        <div className="mt-2 flex flex-col gap-4" aria-live="polite">
          {results?.length === 0 && <p className="rounded-[22px] border border-dashed border-line-2 p-8 text-center text-muted">No member of {gym.name} matches “{q}”.</p>}
          <AnimatePresence initial={false}>
            {results?.map((r) => (
              <motion.article
                key={r.membershipId}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE_DIVE }}
                className={`rounded-[24px] border p-5 sm:p-6 ${r.entryAllowed ? 'border-success/40 bg-[rgba(76,201,122,.06)]' : 'border-line bg-surface'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-2xl font-bold">{r.memberName}</div>
                    <div className="mt-1 text-sm text-muted">{r.number} · {r.packageName}</div>
                  </div>
                  <StatusPill status={r.status} />
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  <div><dt className="text-xs font-bold tracking-[.12em] text-faint">PAYMENT</dt><dd className={`m-0 mt-1 font-semibold ${r.paymentVerified ? 'text-success' : 'text-warning'}`}>{r.paymentVerified ? 'Verified' : 'Not verified'}</dd></div>
                  <div><dt className="text-xs font-bold tracking-[.12em] text-faint">VALID UNTIL</dt><dd className="m-0 mt-1 font-semibold">{r.status === 'AWAITING_PAYMENT' ? '—' : longDate(r.endsAt)}</dd></div>
                  <div><dt className="text-xs font-bold tracking-[.12em] text-faint">LAST VISIT</dt><dd className="m-0 mt-1 font-semibold">{r.lastCheckInAt ? (r.checkedInToday ? `Today ${time(r.lastCheckInAt)}` : longDate(r.lastCheckInAt)) : 'First visit'}</dd></div>
                </dl>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                  {r.entryAllowed ? (
                    <span className="flex items-center gap-2 text-[15px] font-semibold text-success"><Icon name="check" size={18} strokeWidth={2.6} /> Entry allowed</span>
                  ) : (
                    <span className="flex items-center gap-2 text-[15px] font-semibold text-error"><Icon name="close" size={18} strokeWidth={2.6} /> {r.reason}</span>
                  )}
                  {r.entryAllowed ? (
                    <button type="button" className="btn btn-gold !h-12" disabled={!!busy} onClick={() => checkIn(r)}>
                      {busy === r.membershipId ? 'Recording…' : r.checkedInToday ? 'Check in again' : 'Record check-in'}
                    </button>
                  ) : (
                    <button type="button" className="btn btn-ghost !h-12" disabled={!!busy} onClick={() => checkIn(r)} title="Logs the refused attempt">
                      {busy === r.membershipId ? 'Logging…' : 'Log refused entry'}
                    </button>
                  )}
                </div>
                {!r.entryAllowed && r.status === 'AWAITING_PAYMENT' && <p className="mt-3 mb-0 text-[13px] text-muted">Pay-at-gym members: the owner records the payment in the gym portal, then the card activates.</p>}
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <aside>
        <div className="card sticky top-[96px] p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="disp m-0 text-[28px]">Today</h2>
            <span className="text-sm text-muted"><strong className="text-gold">{inToday}</strong> checked in</span>
          </div>
          <ul className="m-0 flex max-h-[60vh] list-none flex-col gap-1 overflow-y-auto p-0">
            {list.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
                <span className={`h-2 w-2 flex-none rounded-full ${c.result === 'ALLOWED' ? 'bg-success' : 'bg-error'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{c.memberName}</span>
                  <span className="block truncate text-xs text-faint">{c.result === 'ALLOWED' ? c.number : `Refused · ${c.reason}`}</span>
                </span>
                <span className="text-xs tabular-nums text-muted">{time(c.createdAt)}</span>
              </li>
            ))}
            {today.data && list.length === 0 && <li className="py-6 text-center text-sm text-muted">No check-ins yet today.</li>}
          </ul>
        </div>
      </aside>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            className={`fixed inset-x-4 bottom-6 z-[1300] mx-auto flex w-fit max-w-[560px] items-center gap-3 rounded-[18px] px-5 py-4 font-semibold shadow-[0_24px_50px_-20px_rgba(0,0,0,.8)] ${toast.ok ? 'bg-text text-[#111]' : 'bg-error text-[#2a0909]'}`}
            initial={{ opacity: 0, y: 20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          >
            <span className={`grid h-9 w-9 flex-none place-items-center rounded-xl ${toast.ok ? 'bg-gold text-gold-ink' : 'bg-[#2a0909] text-error'}`}>
              <Icon name={toast.ok ? 'check' : 'close'} size={18} strokeWidth={2.6} />
            </span>
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
