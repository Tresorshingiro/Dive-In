import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { GymStaffDetail, GymTrainerDetail, Receipt, SessionDetail } from '@dive/shared';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Photo } from '../components/ui/Photo';
import { Icon } from '../components/ui/Icon';
import { dateTime, longDate, rwf, timeAgo } from '../lib/format';
import { ErrorNote, Skeleton } from './ui';
import { BackLink, Fields, MiniStat, Pills, Section, Tag, WEEKDAY_NAMES } from './detailUi';

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' });

// ───────────────────────── gym owner: linked trainer ─────────────────────────

export function GymTrainerPage() {
  const { id = '' } = useParams();
  const { data, error } = useFetch<{ trainer: GymTrainerDetail }>(`/gym/trainers/${id}`);
  const t = data?.trainer;
  useDocumentTitle(t?.fullName ?? 'Trainer');
  if (error) return <p className="text-error">{error.message}</p>;
  if (!t) return <Skeleton h={500} />;
  return (
    <>
      <BackLink to="/gym/trainers">Trainers</BackLink>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Photo src={t.photoUrl} alt={t.fullName} caption="No photo yet" className="aspect-[4/5] rounded-[24px]" />
          <Section title="Contact">
            <Fields cols={2} items={[
              ['Email', <a key="e" href={`mailto:${t.email}`} className="text-text">{t.email}</a>],
              ['Phone', t.phone ? <a key="p" href={`tel:${t.phone}`} className="text-text">{t.phone}</a> : null],
              ['Linked since', longDate(t.linkedAt)],
              ['Verification', <Tag key="v" s={t.verificationStatus} />],
            ]} />
          </Section>
        </div>
        <div className="flex flex-col gap-6">
          <div>
            <div className="eyebrow mb-3">Trainer at your gym</div>
            <h1 className="disp m-0 text-[44px] sm:text-[60px]">{t.fullName}</h1>
            <p className="lead mt-2 mb-0">{t.headline ?? 'No headline yet'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat label="Upcoming here" value={t.sessionsHere.upcoming} />
            <MiniStat label="Done here" value={t.sessionsHere.completed} />
            <MiniStat label="Session fee" value={t.sessionFeeRwf ? rwf(t.sessionFeeRwf) : '—'} />
            <MiniStat label="Length" value={`${t.sessionMinutes}m`} />
          </div>
          <Section title="Profile">
            <p className="mt-0 mb-5 text-[15px] leading-relaxed text-soft">{t.bio ?? <span className="text-faint">No bio yet.</span>}</p>
            <Fields cols={3} items={[['Experience', t.yearsExperience !== null ? `${t.yearsExperience} years` : null], ['Languages', t.languages.join(', ')], ['Certifications', t.certifications.join(', ')]]} />
            <div className="mt-5 text-xs font-bold tracking-[.12em] text-faint">SPECIALTIES</div>
            <div className="mt-2"><Pills items={t.specialties} /></div>
          </Section>
          <Section title="When they coach here">
            <ul className="m-0 list-none p-0 text-sm">
              {t.availabilityHere.map((a, i) => <li key={i} className="flex justify-between gap-3 py-1.5"><span className="text-muted">{WEEKDAY_NAMES[a.weekday]}</span><span>{a.startTime}–{a.endTime}</span></li>)}
              {t.availabilityHere.length === 0 && <li className="text-faint">No hours set for this gym yet.</li>}
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}

// ───────────────────────── gym owner: staff member ─────────────────────────

export function GymStaffPage() {
  const { id = '' } = useParams();
  const { data, error } = useFetch<{ staff: GymStaffDetail }>(`/gym/staff/${id}`);
  const s = data?.staff;
  useDocumentTitle(s?.fullName ?? 'Staff');
  if (error) return <p className="text-error">{error.message}</p>;
  if (!s) return <Skeleton h={400} />;
  return (
    <>
      <BackLink to="/gym/staff">Staff</BackLink>
      <div className="mb-8">
        <div className="eyebrow mb-3">Reception staff</div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="disp m-0 text-[44px] sm:text-[60px]">{s.fullName}</h1>
          <Tag s={s.active ? 'ACTIVE' : 'SUSPENDED'} />
        </div>
      </div>
      <div className="mb-6 grid grid-cols-3 gap-3">
        <MiniStat label="Let in today" value={s.stats.checkInsToday} />
        <MiniStat label="Let in, 30 days" value={s.stats.checkIns30d} />
        <MiniStat label="Refused, 30 days" value={s.stats.refused30d} />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Section title="Account">
          <Fields cols={2} items={[
            ['Email', s.email],
            ['Phone', s.phone ? <a key="p" href={`tel:${s.phone}`} className="text-text">{s.phone}</a> : null],
            ['Added', longDate(s.createdAt)],
            ['Last login', s.lastLoginAt ? dateTime(s.lastLoginAt) : 'Never'],
            ['Password', s.mustChangePassword ? 'Temporary (first login pending)' : 'Set by them'],
          ]} />
          <p className="mt-5 mb-0 text-[13px] text-muted">Reset the password or deactivate this account from the <Link to="/gym/staff" className="text-gold">Staff</Link> list.</p>
        </Section>
        <Section title="Check-ins they recorded">
          <ul className="m-0 list-none divide-y divide-line-soft p-0 text-sm">
            {s.recentCheckIns.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className={`h-2 w-2 flex-none rounded-full ${c.result === 'ALLOWED' ? 'bg-success' : 'bg-error'}`} />
                <span className="min-w-0 flex-1"><span className="font-semibold">{c.memberName}</span> <span className="text-muted">· {c.number}{c.reason ? ` · ${c.reason}` : ''}</span></span>
                <span className="text-xs text-faint" title={dateTime(c.createdAt)}>{timeAgo(c.createdAt)}</span>
              </li>
            ))}
            {s.recentCheckIns.length === 0 && <li className="py-2 text-faint">No check-ins recorded yet.</li>}
          </ul>
        </Section>
      </div>
    </>
  );
}

// ───────────────────────── session (trainer + member) ─────────────────────────

export function SessionPage({ as }: { as: 'trainer' | 'member' }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const path = as === 'trainer' ? `/trainer/sessions/${id}` : `/me/bookings/${id}`;
  const { data, error, reload } = useFetch<{ session: SessionDetail }>(path);
  const s = data?.session;
  useDocumentTitle('Session');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (error) return <p className="text-error">{error.message}</p>;
  if (!s) return <Skeleton h={400} />;

  const started = new Date(s.startsAt).getTime() < Date.now();
  const other = as === 'trainer' ? s.member : s.trainer;
  const back = as === 'trainer' ? '/trainer/sessions' : '/app/coaching';

  const act = async (what: 'complete' | 'cancel') => {
    let reason: string | undefined;
    if (what === 'cancel') {
      const msg = as === 'trainer'
        ? `Cancel the session with ${s.member.fullName}? They'll be refunded. Reason (shown to them):`
        : s.status === 'CONFIRMED' ? 'Cancel this paid session? DIVE-IN refunds you if it is more than 24 hours away. Reason (optional):' : 'Cancel this booking? Reason (optional):';
      const r = prompt(msg);
      if (r === null) return;
      reason = r || undefined;
    }
    setBusy(true);
    setErr('');
    try {
      const url = as === 'trainer' ? `/trainer/sessions/${s.id}/${what}` : `/me/bookings/${s.id}/cancel`;
      await api(url, { method: 'POST', body: what === 'cancel' ? { reason } : undefined });
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <BackLink to={back}>{as === 'trainer' ? 'Sessions' : 'Coaching'}</BackLink>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-3">Coaching session</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="disp m-0 text-[36px] sm:text-[52px]">{when(s.startsAt)}</h1>
            <Tag s={s.status} />
          </div>
          <div className="mt-2 text-[15px] text-muted">{time(s.startsAt)}–{time(s.endsAt)} Kigali time · {rwf(s.feeRwf)}</div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {s.conversationId && <Link to={`${as === 'trainer' ? '/trainer' : '/app'}/messages?c=${s.conversationId}`} className="btn btn-ghost !h-11"><Icon name="mail" size={15} /> Message</Link>}
          {as === 'member' && s.status === 'PENDING_PAYMENT' && s.payment?.checkoutUrl && <a href={s.payment.checkoutUrl} className="btn btn-gold !h-11">Pay {rwf(s.feeRwf)}</a>}
          {as === 'trainer' && s.status === 'CONFIRMED' && started && <button type="button" disabled={busy} className="btn btn-gold !h-11" onClick={() => act('complete')}>Mark done</button>}
          {((as === 'trainer' && s.status === 'CONFIRMED' && !started) || (as === 'member' && (s.status === 'PENDING_PAYMENT' || (s.status === 'CONFIRMED' && !started)))) && (
            <button type="button" disabled={busy} className="btn btn-ghost !h-11" onClick={() => act('cancel')}>Cancel</button>
          )}
        </div>
      </div>
      <div className="mb-4"><ErrorNote message={err} /></div>
      {s.cancelReason && <div className="mb-6 rounded-2xl border border-line bg-surface px-5 py-3 text-sm text-chalk">Cancelled: {s.cancelReason}</div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title={as === 'trainer' ? 'Member' : 'Coach'}>
          <div className="flex items-center gap-4">
            {as === 'member' ? <Photo src={s.trainer.photoUrl} alt="" className="h-16 w-16 flex-none rounded-2xl" /> : <span className="grid h-16 w-16 flex-none place-items-center rounded-2xl bg-field text-lg font-bold text-gold">{s.member.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>}
            <div>
              <div className="text-lg font-bold">{other.fullName}</div>
              {as === 'member' && s.trainer.headline && <div className="text-sm text-muted">{s.trainer.headline}</div>}
            </div>
          </div>
          <div className="mt-5">
            <Fields items={as === 'trainer'
              ? [['Phone', s.member.phone ? <a key="p" href={`tel:${s.member.phone}`} className="text-text">{s.member.phone}</a> : null], ['Email', s.member.email]]
              : [['Phone', s.trainer.phone ? <a key="p" href={`tel:${s.trainer.phone}`} className="text-text">{s.trainer.phone}</a> : 'Shown once the session is confirmed'], ['Profile', <Link key="c" to={`/coaches/${s.trainer.id}`} className="text-gold">View coach →</Link>]]} />
          </div>
          {s.note && <div className="mt-5 rounded-2xl border border-line bg-ink px-4 py-3 text-sm text-chalk">“{s.note}”</div>}
        </Section>
        <Section title="Where & payment">
          <Fields items={[
            ['Location', s.gym ? <Link key="g" to={`/gyms/${s.gym.slug}`} className="text-gold">{s.gym.name} · {s.gym.neighbourhood}</Link> : 'To be agreed with the coach'],
            ['Address', s.gym?.address],
            ['Fee', rwf(s.feeRwf)],
            ['Payment', s.payment ? <Tag key="ps" s={s.payment.status} /> : 'None'],
            ['Paid on', s.payment?.paidAt ? dateTime(s.payment.paidAt) : null],
            ['Booked', dateTime(s.createdAt)],
          ]} />
          {as === 'member' && s.payment && (s.payment.status === 'PAID' || s.payment.status === 'REFUNDED') && <Link to={`/app/payments/${s.payment.id}`} className="mt-4 inline-block text-sm text-gold">View receipt →</Link>}
        </Section>
        {as === 'trainer' && (
          <Section title={`Earlier sessions with ${s.member.fullName.split(' ')[0]}`}>
            <ul className="m-0 list-none divide-y divide-line-soft p-0 text-sm">
              {s.history.map((h) => <li key={h.id} className="flex items-center justify-between gap-3 py-2"><Link to={`/trainer/sessions/${h.id}`} className="text-text">{dateTime(h.startsAt)}</Link><Tag s={h.status} /></li>)}
              {s.history.length === 0 && <li className="py-1 text-faint">First session together.</li>}
            </ul>
          </Section>
        )}
      </div>
      {as === 'member' && s.status === 'CANCELLED' && <button type="button" className="btn btn-gold mt-6" onClick={() => navigate(`/coaches/${s.trainer.id}`)}>Book another time</button>}
    </>
  );
}

// ───────────────────────── member: receipt ─────────────────────────

const METHOD: Record<string, string> = { CARD: 'Card', MOMO: 'Mobile Money', PAID_AT_GYM: 'Paid at the gym' };

export function ReceiptPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { data, error } = useFetch<{ receipt: Receipt }>(`/me/receipts/${id}`);
  const r = data?.receipt;
  useDocumentTitle('Receipt');
  if (error) return <p className="text-error">{error.message}</p>;
  if (!r) return <Skeleton h={400} />;
  const paid = r.status === 'PAID' || r.status === 'REFUNDED';
  return (
    <>
      <BackLink to="/app/payments">Payments</BackLink>
      <div className="mx-auto max-w-[560px]">
        <div className="card overflow-hidden p-0 print:border-0">
          <div className="flex items-center justify-between border-b border-line bg-gold-deep px-6 py-5">
            <div>
              <div className="disp text-[28px] text-gold">Dive-In</div>
              <div className="text-xs tracking-[.16em] text-muted">{paid ? 'PAYMENT RECEIPT' : 'PAYMENT'}</div>
            </div>
            <Tag s={r.status} />
          </div>
          <div className="px-6 py-6">
            <div className="text-sm text-muted">{r.description}</div>
            <div className="disp mt-1 text-[48px]">{rwf(r.amountRwf)}</div>
            {r.failureReason && <p className="mt-2 mb-0 text-sm text-warning">{r.failureReason}</p>}
            <div className="mt-6 border-t border-line pt-5">
              <Fields items={[
                ['Paid by', r.payer.fullName],
                ['Email', r.payer.email ?? user?.email],
                ['Method', METHOD[r.method] ?? r.method],
                ['Date', dateTime(r.paidAt ?? r.createdAt)],
                ['Receipt no.', <code key="id" className="text-xs">{r.id.slice(0, 8).toUpperCase()}</code>],
                ['Provider reference', r.providerRef ? <code key="ref" className="text-xs break-all">{r.providerRef}</code> : null],
              ]} />
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 print:hidden">
          {r.checkoutUrl && <a href={r.checkoutUrl} className="btn btn-gold !h-11">Finish paying</a>}
          {r.link && paid && <Link to={r.link} className="btn btn-ghost !h-11">{r.purpose === 'MEMBERSHIP' ? 'View card' : r.purpose === 'SESSION' ? 'View session' : 'Open'}</Link>}
          {paid && <button type="button" className="btn btn-ghost !h-11" onClick={() => window.print()}>Print</button>}
        </div>
      </div>
    </>
  );
}
