import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { fieldErrors, trainerProfileSchema, type BookingView, type TrainerOverview, type TrainerSelf } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Messages } from '../../components/Messages';
import { Icon } from '../../components/ui/Icon';
import { Photo } from '../../components/ui/Photo';
import { rwf } from '../../lib/format';
import { Empty, ErrorNote, Flash, PageHead, Skeleton, Stat } from '../ui';
import { BookingStatus } from '../member/Coaching';

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' });

function VerificationBanner({ status }: { status: TrainerOverview['verificationStatus'] }) {
  if (status === 'VERIFIED') return null;
  return (
    <div className={`mb-8 flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm ${status === 'PENDING' ? 'border-gold-line bg-gold-deep text-chalk' : 'border-error/30 bg-error/10 text-chalk'}`}>
      <Icon name="shield" size={18} className="mt-0.5 flex-none text-gold" />
      {status === 'PENDING' ? (
        <span><strong className="text-text">Verification in progress.</strong> Complete your profile and availability now — DIVE-IN reviews it, and members can find and book you once you’re verified.</span>
      ) : (
        <span><strong className="text-text">Your profile wasn’t verified.</strong> Check your notifications for details, update your profile, and contact DIVE-IN support.</span>
      )}
    </div>
  );
}

function SessionRow({ b, onChanged }: { b: BookingView; onChanged?: () => void }) {
  const [err, setErr] = useState('');
  const started = new Date(b.startsAt).getTime() < Date.now();
  const act = async (what: 'complete' | 'cancel') => {
    let reason: string | undefined;
    if (what === 'cancel') {
      const r = prompt(`Cancel the session with ${b.member.fullName}? They'll be refunded. Reason (shown to them):`);
      if (r === null) return;
      reason = r || undefined;
    }
    try {
      await api(`/trainer/sessions/${b.id}/${what}`, { method: 'POST', body: what === 'cancel' ? { reason } : undefined });
      onChanged?.();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed');
    }
  };
  return (
    <div className="card flex flex-wrap items-center gap-4 p-4">
      <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-field font-bold text-gold">{b.member.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
      <div className="min-w-0 flex-1">
        <div className="font-bold">{b.member.fullName}</div>
        <div className="text-sm text-muted">{when(b.startsAt)}{b.gym ? ` · ${b.gym.name}` : ''} · {rwf(b.feeRwf)}{b.member.phone ? ` · ${b.member.phone}` : ''}</div>
        {b.note && <div className="mt-1 text-sm text-chalk">“{b.note}”</div>}
        {err && <div className="mt-1 text-sm text-error">{err}</div>}
      </div>
      <BookingStatus s={b.status} />
      {onChanged && b.status === 'CONFIRMED' && (started ? (
        <button type="button" className="btn btn-gold !h-10 !px-4 !text-[13px]" onClick={() => act('complete')}>Mark done</button>
      ) : (
        <button type="button" className="btn btn-ghost !h-10 !px-4 !text-[13px]" onClick={() => act('cancel')}>Cancel</button>
      ))}
    </div>
  );
}

export function TrainerHome() {
  useDocumentTitle('Trainer workspace');
  const { data } = useFetch<{ overview: TrainerOverview }>('/trainer/overview');
  const o = data?.overview;
  if (!o) return <Skeleton h={300} />;
  return (
    <>
      <VerificationBanner status={o.verificationStatus} />
      <PageHead eyebrow="Trainer workspace" title="Your coaching">Sessions, availability and messages in one place.</PageHead>
      {!o.profileComplete && (
        <div className="mb-6 rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-chalk">
          Finish your profile so members can book you: missing <strong className="text-text">{o.missing.join(', ')}</strong>.{' '}
          <Link to={o.missing.includes('availability') && o.missing.length === 1 ? '/trainer/availability' : '/trainer/profile'} className="text-gold">Complete it</Link>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Upcoming sessions" value={o.upcoming.length} />
        <Stat label="Sessions this month" value={o.sessionsThisMonth} />
        <Stat label="Earned this month" value={rwf(o.earnedThisMonthRwf)} tone="gold" hint="Session fees paid through DIVE-IN" />
        <Stat label="Unread messages" value={o.unreadMessages} tone={o.unreadMessages ? 'warn' : undefined} hint={<Link to="/trainer/messages" className="text-gold no-underline">Open inbox</Link>} />
      </div>
      <h2 className="disp mt-10 mb-4 text-[30px]">Next up</h2>
      <div className="flex flex-col gap-3">
        {o.upcoming.map((b) => <SessionRow key={b.id} b={b} />)}
        {o.upcoming.length === 0 && <Empty>No upcoming sessions yet. Make sure your availability is set.</Empty>}
      </div>
    </>
  );
}

export function TrainerSessions() {
  useDocumentTitle('Sessions');
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const { data, reload } = useFetch<{ sessions: BookingView[] }>(`/trainer/sessions?scope=${scope}`);
  return (
    <>
      <PageHead eyebrow="Sessions" title="Sessions" actions={
        <div className="flex gap-1 rounded-full border border-line bg-field p-1">
          {(['upcoming', 'past'] as const).map((s) => <button key={s} type="button" className="tab !h-9" aria-pressed={scope === s} onClick={() => setScope(s)}>{s === 'upcoming' ? 'Upcoming' : 'Past'}</button>)}
        </div>
      }>Only paid, confirmed bookings appear here. Cancelling refunds the member.</PageHead>
      {!data ? <Skeleton h={240} /> : data.sessions.length === 0 ? <Empty>No {scope} sessions.</Empty> : (
        <div className="flex flex-col gap-3">{data.sessions.map((b) => <SessionRow key={b.id} b={b} onChanged={reload} />)}</div>
      )}
    </>
  );
}

const DAYS = [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 0]] as const;
interface Slot { weekday: number; startTime: string; endTime: string; gymId: string | null }

export function TrainerAvailability() {
  useDocumentTitle('Availability');
  const { data, setData } = useFetch<{ sessionMinutes: number; slots: Slot[]; exceptions: { id: string; date: string; note: string | null }[] }>('/trainer/availability');
  const me = useFetch<{ trainer: TrainerSelf }>('/trainer/me');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [off, setOff] = useState('');
  useEffect(() => { if (data && !slots) setSlots(data.slots.map(({ weekday, startTime, endTime, gymId }) => ({ weekday, startTime, endTime, gymId }))); }, [data, slots]);
  useEffect(() => { if (saved) { const t = setTimeout(() => setSaved(false), 2500); return () => clearTimeout(t); } }, [saved]);
  if (!data || !slots) return <Skeleton h={400} />;
  const gyms = me.data?.trainer.gyms ?? [];

  const update = (i: number, patch: Partial<Slot>) => setSlots(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await api<typeof data>('/trainer/availability', { method: 'PUT', body: { slots } });
      setData(r);
      setSaved(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead eyebrow="Availability" title="Availability" actions={<><Flash show={saved} /><button type="button" className="btn btn-gold !h-11" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save weekly hours'}</button></>}>
        Weekly windows in Kigali time. Members can book {data.sessionMinutes}-minute sessions inside them, up to two weeks ahead and at least 2 hours in advance.
      </PageHead>
      <div className="mb-4"><ErrorNote message={err} /></div>
      <div className="card divide-y divide-line-soft">
        {DAYS.map(([label, wd]) => {
          const rows = slots.map((s, i) => ({ s, i })).filter(({ s }) => s.weekday === wd);
          return (
            <div key={wd} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
              <div className="w-16 pt-2.5 font-bold">{label}</div>
              <div className="flex flex-1 flex-col gap-2">
                {rows.length === 0 && <span className="pt-2.5 text-sm text-faint">Not available</span>}
                {rows.map(({ s, i }) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input type="time" className="field !h-10 !w-[130px]" value={s.startTime} onChange={(e) => update(i, { startTime: e.target.value })} aria-label={`${label} start`} />
                    <span className="text-muted">to</span>
                    <input type="time" className="field !h-10 !w-[130px]" value={s.endTime} onChange={(e) => update(i, { endTime: e.target.value })} aria-label={`${label} end`} />
                    {gyms.length > 0 && (
                      <select className="field !h-10 !w-auto" value={s.gymId ?? ''} onChange={(e) => update(i, { gymId: e.target.value || null })} aria-label="Location">
                        <option value="">Any location</option>
                        {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    )}
                    <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-field hover:text-text" aria-label="Remove window" onClick={() => setSlots(slots.filter((_, j) => j !== i))}><Icon name="close" size={15} /></button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-ghost !h-10 !px-4 !text-[13px]" onClick={() => setSlots([...slots, { weekday: wd, startTime: '06:00', endTime: '08:00', gymId: null }])}><Icon name="plus" size={14} /> Add</button>
            </div>
          );
        })}
      </div>

      <h2 className="disp mt-10 mb-4 text-[30px]">Days off</h2>
      <div className="card p-5">
        <div className="flex flex-wrap gap-2">
          <input type="date" className="field !h-11 !w-auto" value={off} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setOff(e.target.value)} aria-label="Day off" />
          <button type="button" className="btn btn-ghost !h-11" disabled={!off} onClick={async () => { try { setData(await api('/trainer/days-off', { method: 'POST', body: { date: off } })); setOff(''); } catch (e) { setErr(e instanceof ApiError ? e.message : 'Failed'); } }}>Block this day</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.exceptions.map((x) => (
            <span key={x.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-field py-1.5 pr-1.5 pl-3.5 text-sm">
              {new Date(`${x.date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
              <button type="button" className="grid h-6 w-6 place-items-center rounded-full hover:bg-line" aria-label="Remove" onClick={async () => setData(await api(`/trainer/days-off/${x.id}`, { method: 'DELETE' }))}><Icon name="close" size={12} /></button>
            </span>
          ))}
          {data.exceptions.length === 0 && <span className="text-sm text-faint">No days off planned.</span>}
        </div>
      </div>
    </>
  );
}

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export function TrainerProfile() {
  useDocumentTitle('Profile');
  const { data, setData } = useFetch<{ trainer: TrainerSelf }>('/trainer/me');
  const [f, setF] = useState<Record<string, string> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const t = data?.trainer;
  useEffect(() => {
    if (t && !f) setF({ headline: t.headline ?? '', bio: t.bio ?? '', specialties: t.specialties.join(', '), certifications: t.certifications.join(', '), languages: t.languages.join(', '), yearsExperience: t.yearsExperience?.toString() ?? '', sessionFeeRwf: t.sessionFeeRwf?.toString() ?? '', sessionMinutes: String(t.sessionMinutes) });
  }, [t, f]);
  useEffect(() => { if (saved) { const x = setTimeout(() => setSaved(false), 2500); return () => clearTimeout(x); } }, [saved]);
  if (!t || !f) return <Skeleton h={500} />;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const body = { headline: f.headline, bio: f.bio, specialties: list(f.specialties), certifications: list(f.certifications), languages: list(f.languages), yearsExperience: f.yearsExperience === '' ? null : f.yearsExperience, sessionFeeRwf: f.sessionFeeRwf.replace(/[,\s]/g, ''), sessionMinutes: f.sessionMinutes };
    const parsed = trainerProfileSchema.safeParse(body);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    try {
      setData(await api('/trainer/profile', { method: 'PUT', body: parsed.data }));
      setSaved(true);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };
  const upload = async (fl: File) => {
    setErr('');
    try {
      const r = await api<{ photoUrl: string }>('/trainer/photo', { method: 'POST', body: fl });
      setData({ trainer: { ...t, photoUrl: r.photoUrl } });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Upload failed');
    }
  };
  const field = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="field-label" htmlFor={`tp-${k}`}>{label}</label>
      <input id={`tp-${k}`} className="field" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} aria-invalid={!!errors[k]} {...props} />
      {errors[k] && <p className="field-error">{errors[k]}</p>}
    </div>
  );

  return (
    <form onSubmit={save} noValidate>
      <VerificationBanner status={t.verificationStatus} />
      <PageHead eyebrow="Profile" title="Your profile" actions={<><Flash show={saved} /><Link to={`/coaches/${t.id}`} className="btn btn-ghost !h-11" target="_blank">View public page</Link><button type="submit" className="btn btn-gold !h-11" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
        Headline, specialties and photo are public. Bio, credentials, fee and availability are shown to members with a Coach Access Pass.
      </PageHead>
      <div className="mb-4"><ErrorNote message={err} /></div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="card p-5">
          <Photo src={t.photoUrl} alt={t.fullName} caption="Add a photo" className="aspect-[4/5] rounded-2xl" />
          <button type="button" className="btn btn-ghost mt-4 w-full !h-11" onClick={() => file.current?.click()}>Upload photo</button>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const fl = e.target.files?.[0]; if (fl) void upload(fl); e.target.value = ''; }} />
          <p className="mt-3 mb-0 text-xs text-faint">A clear, well-lit portrait works best. Location data is removed.</p>
          {t.gyms.length > 0 && <div className="mt-5 text-sm text-muted">Linked gyms: <span className="text-chalk">{t.gyms.map((g) => g.name).join(', ')}</span></div>}
        </div>
        <div className="card flex flex-col gap-4 p-6">
          {field('headline', 'Headline', { placeholder: 'Strength coach · 8 years' })}
          <div>
            <label className="field-label" htmlFor="tp-bio">Bio</label>
            <textarea id="tp-bio" className="field" maxLength={1500} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="Your approach, who you help, results." />
          </div>
          {field('specialties', 'Specialties (comma separated)', { placeholder: 'Strength, Mobility' })}
          {field('certifications', 'Certifications (comma separated)', { placeholder: 'NASM CPT, First Aid' })}
          {field('languages', 'Languages (comma separated)', { placeholder: 'Kinyarwanda, English, French' })}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {field('yearsExperience', 'Years coaching', { inputMode: 'numeric' })}
            {field('sessionFeeRwf', 'Session fee (RWF)', { inputMode: 'numeric' })}
            <div>
              <label className="field-label" htmlFor="tp-min">Session length</label>
              <select id="tp-min" className="field" value={f.sessionMinutes} onChange={(e) => setF({ ...f, sessionMinutes: e.target.value })}>
                {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

export function TrainerMessages() {
  useDocumentTitle('Messages');
  return (
    <>
      <PageHead eyebrow="Messages" title="Messages">Members with a Coach Access Pass can message you. Reply here.</PageHead>
      <Messages emptyHint="No messages yet. Members reach out from your profile." />
    </>
  );
}
