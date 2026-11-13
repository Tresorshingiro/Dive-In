import { useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import type { BookingStarted, CoachPassStatus, CoachProfile, PublicConfig, TrainerSummary } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Reveal } from '../../components/motion/Reveal';
import { Icon } from '../../components/ui/Icon';
import { Photo } from '../../components/ui/Photo';
import { longDate, newIdempotencyKey, rwf } from '../../lib/format';
import { NotFound } from './Placeholder';

const kTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' });
const kDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** Buy-the-pass button that works for logged-out visitors too. */
function PassButton({ label = 'Get Coach Access Pass', from }: { label?: string; from: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const key = useRef(newIdempotencyKey());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!user) return <Link to="/login" state={{ from }} className="btn btn-gold">Log in to unlock</Link>;
  if (user.role !== 'MEMBER') return <span className="text-sm text-muted">Coach booking is for member accounts.</span>;
  return (
    <span className="flex flex-col items-start gap-2">
      <button
        type="button"
        className="btn btn-gold"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr('');
          try {
            const r = await api<{ redirectUrl: string }>('/me/coach-pass/checkout', { method: 'POST', headers: { 'Idempotency-Key': key.current } });
            window.location.assign(r.redirectUrl);
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : 'Could not start checkout');
            setBusy(false);
            if (e instanceof ApiError && e.status === 401) navigate('/login', { state: { from } });
          }
        }}
      >
        {busy ? 'Opening checkout…' : label}
      </button>
      {err && <span className="text-sm text-error">{err}</span>}
    </span>
  );
}

export default function CoachesPage() {
  useDocumentTitle('Coaches');
  const { data } = useFetch<{ trainers: TrainerSummary[] }>('/trainers?limit=50');
  const cfg = useFetch<PublicConfig>('/config');
  const { user } = useAuth();
  const pass = useFetch<{ pass: CoachPassStatus }>(user?.role === 'MEMBER' ? '/me/coach-pass' : null);
  const [q, setQ] = useState('');
  const [spec, setSpec] = useState('All');
  const list = data?.trainers ?? [];
  const specs = useMemo(() => ['All', ...[...new Set(list.flatMap((t) => t.specialties))].sort()], [list]);
  const shown = list.filter((t) => (spec === 'All' || t.specialties.includes(spec)) && (!q || [t.fullName, t.headline ?? '', ...t.specialties, ...t.gyms.map((g) => g.name)].some((s) => s.toLowerCase().includes(q.toLowerCase()))));
  const c = cfg.data?.coachPass ?? { priceRwf: 5000, days: 30 };

  return (
    <section className="pt-10 pb-20 lg:pt-14">
      <div className="wrap">
        <div className="eyebrow mb-4">Coaches</div>
        <h1 className="disp m-0 text-[48px] sm:text-[64px] lg:text-[88px]">Train with <span className="text-gold">someone who knows.</span></h1>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-6 rounded-[28px] border border-gold-line bg-gold-deep px-6 py-6 sm:px-8">
          <div>
            <div className="disp text-[30px]">Coach Access Pass</div>
            {pass.data?.pass.active ? (
              <div className="mt-1 text-[15px] text-success">Active until {longDate(pass.data.pass.endsAt)} — profiles, availability, messaging and booking unlocked.</div>
            ) : (
              <div className="mt-1 text-[15px] text-soft">{rwf(c.priceRwf)} for {c.days} days unlocks full profiles, availability, messaging and booking. Session fees are paid separately.</div>
            )}
          </div>
          {!pass.data?.pass.active && <PassButton from="/coaches" />}
        </div>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex h-12 flex-1 items-center gap-2.5 rounded-2xl border border-line bg-field px-4">
            <Icon name="search" size={18} className="text-dim" />
            <span className="sr-only">Search coaches</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, specialty or gym" className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-text outline-none placeholder:text-[#6b675f]" />
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Specialty">
            {specs.map((s) => <button key={s} type="button" className="chip !h-10 !px-4 !text-[13px]" aria-pressed={spec === s} onClick={() => setSpec(s)}>{s}</button>)}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((t, i) => (
            <Reveal key={t.id} delay={Math.min(i, 3) * 0.06} lift className="h-full">
              <Link to={`/coaches/${t.id}`} className="card hover-gold block h-full overflow-hidden text-text no-underline">
                <Photo src={t.photoUrl} alt={t.fullName} caption="Photo · coach" className="h-[260px] !rounded-none !border-0">
                  <span className="absolute top-3.5 left-3.5 rounded-full bg-[rgba(14,14,14,.8)] px-3 py-1.5 text-[11px] font-bold tracking-[.1em] text-gold uppercase">{t.specialties[0] ?? 'Coach'}</span>
                </Photo>
                <div className="p-5">
                  <div className="text-lg font-bold">{t.fullName}</div>
                  <div className="mt-1 text-[13px] text-muted">{t.gyms[0] ? `${t.gyms[0].name} · ${t.gyms[0].neighbourhood}` : (t.headline ?? 'Independent coach')}</div>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5 text-[13px]">
                    <span className="text-chalk">{t.headline}</span>
                    {!pass.data?.pass.active && <span className="flex items-center gap-1 font-semibold text-gold"><Icon name="lock" size={13} /> Pass</span>}
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        {data && shown.length === 0 && <p className="mt-8 text-muted">No coaches match.</p>}
      </div>
    </section>
  );
}

export function CoachProfilePage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading } = useFetch<{ coach: CoachProfile }>(`/coaches/${id}`);
  const coach = data?.coach;
  useDocumentTitle(coach?.fullName ?? 'Coach');
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [msgSent, setMsgSent] = useState(false);
  const key = useRef(newIdempotencyKey());

  if (loading && !coach) return <div className="min-h-[70vh]" />;
  if (error?.status === 404) return <NotFound />;
  if (!coach) return <p className="wrap py-28 text-error">{error?.message ?? 'Could not load coach'}</p>;
  const selectedDay = coach.slots?.find((d) => d.date === (day ?? coach.slots?.[0]?.date));

  const book = async () => {
    if (!time) return;
    setBusy(true);
    setErr('');
    try {
      const r = await api<BookingStarted>('/me/bookings', { method: 'POST', body: { trainerId: coach.id, startsAt: time, note: note || undefined }, headers: { 'Idempotency-Key': key.current } });
      window.location.assign(r.redirectUrl);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not book');
      key.current = newIdempotencyKey();
      setBusy(false);
    }
  };
  const message = async () => {
    if (!msg.trim()) return;
    try {
      const r = await api<{ conversationId: string }>('/messages', { method: 'POST', body: { trainerId: coach.id, body: msg.trim() } });
      setMsgSent(true);
      navigate(`/app/messages?c=${r.conversationId}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not send');
    }
  };

  return (
    <section className="pt-6 pb-20">
      <div className="wrap">
        <Link to="/coaches" className="mb-6 inline-flex items-center gap-2 text-sm text-muted no-underline hover:text-text"><Icon name="arrowRight" size={14} className="rotate-180" /> All coaches</Link>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div>
            <Photo src={coach.photoUrl} alt={coach.fullName} caption="Photo · coach" eager className="aspect-[4/5] rounded-[28px]" />
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              {coach.specialties.map((s) => <span key={s} className="rounded-full bg-gold-deep px-3 py-1.5 text-xs font-bold tracking-[.1em] text-gold uppercase">{s}</span>)}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(76,201,122,.12)] px-3 py-1.5 text-xs font-bold text-success"><Icon name="check" size={13} strokeWidth={2.6} /> VERIFIED BY DIVE-IN</span>
            </div>
            <h1 className="disp mt-4 mb-2 text-[52px] sm:text-[72px]">{coach.fullName}</h1>
            <p className="lead m-0">{coach.headline}</p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-chalk">
              {coach.yearsExperience !== null && <span>{coach.yearsExperience} years coaching</span>}
              {coach.gyms.map((g) => <Link key={g.id} to={`/gyms/${g.slug}`} className="text-gold no-underline">{g.name} · {g.neighbourhood}</Link>)}
            </div>

            {!coach.unlocked ? (
              <div className="mt-8 rounded-[24px] border border-gold-line bg-gold-deep p-6">
                <div className="flex items-center gap-2 font-bold"><Icon name="lock" size={16} className="text-gold" /> Full profile, availability, messaging and booking are locked</div>
                <p className="mt-2 mb-5 text-sm text-chalk">A Coach Access Pass unlocks every coach on DIVE-IN. The session itself is booked and paid separately.</p>
                <PassButton from={location.pathname} />
              </div>
            ) : (
              <>
                {coach.bio && <p className="mt-8 mb-0 text-[16px] leading-relaxed text-soft">{coach.bio}</p>}
                <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  <div><dt className="text-xs font-bold tracking-[.12em] text-faint">SESSION</dt><dd className="m-0 mt-1 font-semibold">{coach.sessionMinutes} min · {coach.sessionFeeRwf ? rwf(coach.sessionFeeRwf) : 'fee not set'}</dd></div>
                  {!!coach.languages?.length && <div><dt className="text-xs font-bold tracking-[.12em] text-faint">LANGUAGES</dt><dd className="m-0 mt-1 font-semibold">{coach.languages.join(', ')}</dd></div>}
                  {!!coach.certifications?.length && <div><dt className="text-xs font-bold tracking-[.12em] text-faint">CERTIFICATIONS</dt><dd className="m-0 mt-1 font-semibold">{coach.certifications.join(', ')}</dd></div>}
                </dl>

                <div className="card mt-8 p-6">
                  <h2 className="disp m-0 mb-4 text-[30px]">Book a session</h2>
                  {!coach.slots?.length ? (
                    <p className="m-0 text-muted">No open times in the next two weeks. Send {coach.fullName.split(' ')[0]} a message.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Day">
                        {coach.slots.map((d) => (
                          <button key={d.date} type="button" role="tab" aria-selected={selectedDay?.date === d.date} className="chip !h-10 shrink-0 !px-4 !text-[13px]" aria-pressed={selectedDay?.date === d.date} onClick={() => { setDay(d.date); setTime(null); }}>
                            {kDay(d.date)}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Time (Kigali)">
                        {selectedDay?.times.map((t) => (
                          <button key={t} type="button" role="radio" aria-checked={time === t} className="tab !h-10 border border-line-2" aria-pressed={time === t} onClick={() => setTime(t)}>{kTime(t)}</button>
                        ))}
                      </div>
                      <label className="field-label mt-5" htmlFor="bk-note">Note for the coach <span className="font-normal text-faint">(optional)</span></label>
                      <input id="bk-note" className="field" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Goals, injuries, anything useful" />
                      {err && <p className="mt-3 text-sm text-error" role="alert">{err}</p>}
                      <button type="button" className="btn btn-gold mt-5 w-full sm:w-auto" disabled={!time || busy} onClick={book}>
                        {busy ? 'Opening checkout…' : time ? `Book ${kDay(selectedDay!.date)} ${kTime(time)} · Pay ${rwf(coach.sessionFeeRwf ?? 0)}` : 'Pick a time'}
                      </button>
                      <p className="mt-3 mb-0 text-xs text-faint">The time is held for you while you pay. Times shown in Kigali time.</p>
                    </>
                  )}
                </div>

                {user?.role === 'MEMBER' && (
                  <div className="card mt-5 p-6">
                    <h2 className="disp m-0 mb-4 text-[26px]">Message {coach.fullName.split(' ')[0]}</h2>
                    <div className="flex gap-2">
                      <input className="field flex-1" value={msg} maxLength={2000} onChange={(e) => setMsg(e.target.value)} placeholder="Ask about goals, schedule, location…" aria-label="Message" />
                      <button type="button" className="btn btn-ghost" disabled={!msg.trim() || msgSent} onClick={message}>Send</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
