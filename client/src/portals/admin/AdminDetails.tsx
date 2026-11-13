import { useState } from 'react';
import { Link, useParams } from 'react-router';
import type { AdminGymDetail, AdminPaymentDetail, AdminTrainerDetail, AdminUserDetail } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { GymMap } from '../../components/map/GymMap';
import { Photo } from '../../components/ui/Photo';
import { dateTime, durationLabel, longDate, rwf } from '../../lib/format';
import { ErrorNote, Modal, Skeleton } from '../ui';
import { Activity, BackLink, Fields, MiniStat, Pills, Section, Tag, WEEKDAY_NAMES } from '../detailUi';

/** POST an admin action, optionally asking for a confirmation and/or a note first. */
function useAct(reload: () => void) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (path: string, opts: { confirm?: string; note?: string } = {}) => {
    if (opts.confirm && !confirm(opts.confirm)) return null;
    let note: string | undefined;
    if (opts.note) {
      const r = prompt(opts.note);
      if (r === null) return null;
      note = r || undefined;
    }
    setErr('');
    setBusy(true);
    try {
      const out = await api<unknown>(path, { method: 'POST', body: { note } });
      reload();
      return out;
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Action failed');
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { err, busy, run };
}

function Header({ eyebrow, title, tag, children, actions }: { eyebrow: string; title: string; tag?: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="eyebrow mb-3">{eyebrow}</div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="disp m-0 text-[40px] sm:text-[56px]">{title}</h1>
          {tag && <Tag s={tag} />}
        </div>
        {children && <div className="mt-2 text-[15px] text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

// ───────────────────────── gym ─────────────────────────

export function AdminGymPage() {
  const { id = '' } = useParams();
  const { data, error, reload } = useFetch<{ gym: AdminGymDetail }>(`/admin/gyms/${id}`);
  const g = data?.gym;
  useDocumentTitle(g?.name ?? 'Gym');
  const { err, busy, run } = useAct(reload);
  const [photo, setPhoto] = useState(0);
  if (error) return <p className="text-error">{error.message}</p>;
  if (!g) return <Skeleton h={500} />;

  const actions = (
    <>
      {g.status === 'APPROVED' && <a href={`/gyms/${g.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost !h-11">Public page</a>}
      {(g.status === 'PENDING' || g.status === 'REJECTED') && <button type="button" disabled={busy} className="btn btn-gold !h-11" onClick={() => run(`/admin/gyms/${g.id}/approve`, { confirm: `Approve ${g.name}? It goes live and its free trial starts.` })}>Approve</button>}
      {g.status === 'PENDING' && <button type="button" disabled={busy} className="btn btn-ghost !h-11" onClick={() => run(`/admin/gyms/${g.id}/reject`, { note: 'Reason shown to the owner:' })}>Reject</button>}
      {g.status === 'APPROVED' && <button type="button" disabled={busy} className="btn btn-ghost !h-11" onClick={() => run(`/admin/gyms/${g.id}/suspend`, { note: `Suspend ${g.name}? Reason shown to the owner:` })}>Suspend</button>}
      {g.status === 'SUSPENDED' && <button type="button" disabled={busy} className="btn btn-gold !h-11" onClick={() => run(`/admin/gyms/${g.id}/reinstate`, { confirm: `Reinstate ${g.name}?` })}>Reinstate</button>}
    </>
  );

  return (
    <>
      <BackLink to="/admin/gyms">All gyms</BackLink>
      <Header eyebrow="Gym" title={g.name} tag={g.status} actions={actions}>
        {g.neighbourhood} · applied {longDate(g.createdAt)}{g.approvedAt ? ` · approved ${longDate(g.approvedAt)}` : ''}
      </Header>
      <div className="mb-4"><ErrorNote message={err} /></div>
      {g.statusNote && <div className="mb-6 rounded-2xl border border-warning/30 bg-warning/10 px-5 py-3 text-sm text-chalk">Note on file: {g.statusNote}</div>}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="Active members" value={g.stats.activeMembers} />
        <MiniStat label="Awaiting payment" value={g.stats.awaitingPayment} />
        <MiniStat label="All members" value={g.stats.totalMembers} />
        <MiniStat label="Check-ins 30d" value={g.stats.checkIns30d} />
        <MiniStat label="Gym share 30d" value={rwf(g.stats.revenue30dRwf)} />
        <MiniStat label="Commission 30d" value={rwf(g.stats.commission30dRwf)} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="Photos">
          {g.photos.length === 0 ? <p className="m-0 text-sm text-faint">No photos uploaded yet.</p> : (
            <>
              <Photo key={g.photos[photo]?.url} src={g.photos[photo]?.url} alt={g.photos[photo]?.caption ?? g.name} className="aspect-[3/2] rounded-2xl" />
              <div className="mt-3 flex flex-wrap gap-2">
                {g.photos.map((p, i) => (
                  <button key={p.url} type="button" onClick={() => setPhoto(i)} className={`h-14 w-20 overflow-hidden rounded-xl border-2 ${i === photo ? 'border-gold' : 'border-transparent opacity-60'}`} aria-label={`Photo ${i + 1}`}>
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
        </Section>

        <Section title="Profile">
          <p className="mt-0 mb-5 text-[15px] leading-relaxed text-soft">{g.description ?? <span className="text-faint">No description yet.</span>}</p>
          <Fields items={[
            ['Address', g.address],
            ['Phone', g.phone],
            ['Email', g.email],
            ['Payments', g.diveCheckoutEnabled ? `Online via DIVE-IN${g.commissionOptIn ? ' · commission opted in' : ''}` : 'Paid at the gym'],
          ]} />
          <div className="mt-5 text-xs font-bold tracking-[.12em] text-faint">TRAINING STYLES</div>
          <div className="mt-2"><Pills items={g.tags} /></div>
          <div className="mt-4 text-xs font-bold tracking-[.12em] text-faint">AMENITIES</div>
          <div className="mt-2"><Pills items={g.amenities} /></div>
        </Section>

        <Section title="Location & hours">
          <div className="relative isolate h-[220px] overflow-hidden rounded-2xl border border-line">
            <GymMap gyms={[{ id: g.id, slug: '', name: g.name, neighbourhood: g.neighbourhood, tags: [], lat: g.lat, lng: g.lng, coverUrl: null, fromPriceRwf: null, verified: true }]} area={g.neighbourhood} interactive={false} />
          </div>
          <dl className="m-0 mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d, i) => (
              <div key={d} className="flex justify-between gap-3">
                <dt className="text-muted">{WEEKDAY_NAMES[(i + 1) % 7]}</dt>
                <dd className="m-0 text-chalk">{g.openingHours?.[d] || 'Closed'}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Owner">
          <Fields items={[
            ['Name', <Link key="o" to={`/admin/users/${g.owner.id}`} className="text-gold">{g.owner.fullName}</Link>],
            ['Email', <a key="e" href={`mailto:${g.owner.email}`} className="text-text">{g.owner.email}</a>],
            ['Phone', g.owner.phone ? <a key="p" href={`tel:${g.owner.phone}`} className="text-text">{g.owner.phone}</a> : null],
            ['Last login', g.owner.lastLoginAt ? dateTime(g.owner.lastLoginAt) : 'Never'],
          ]} />
        </Section>

        <Section title={`Packages (${g.packages.length})`}>
          {g.packages.length === 0 ? <p className="m-0 text-sm text-faint">No packages yet.</p> : (
            <ul className="m-0 list-none divide-y divide-line-soft p-0">
              {g.packages.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span><span className="font-semibold">{p.name}</span> <span className="text-muted">· {durationLabel(p.durationDays)}{p.perks.length ? ` · ${p.perks.join(', ')}` : ''}</span>{!p.active && <span className="ml-2 text-xs font-bold text-faint">HIDDEN</span>}</span>
                  <span className="font-semibold tabular-nums text-gold">{rwf(p.priceRwf)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Team">
          <div className="text-xs font-bold tracking-[.12em] text-faint">RECEPTION STAFF</div>
          <ul className="m-0 mt-2 mb-5 list-none p-0 text-sm">
            {g.staff.map((s) => (
              <li key={s.id} className="flex justify-between gap-3 py-1.5">
                <Link to={`/admin/users/${s.userId}`} className="text-text">{s.fullName}</Link>
                <span className="text-muted">{s.active ? (s.lastLoginAt ? `last login ${longDate(s.lastLoginAt)}` : 'never logged in') : 'deactivated'}</span>
              </li>
            ))}
            {g.staff.length === 0 && <li className="text-faint">No staff accounts.</li>}
          </ul>
          <div className="text-xs font-bold tracking-[.12em] text-faint">LINKED TRAINERS</div>
          <ul className="m-0 mt-2 list-none p-0 text-sm">
            {g.trainers.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-1.5">
                <Link to={`/admin/trainers/${t.id}`} className="text-text">{t.fullName}</Link>
                <Tag s={t.verificationStatus} />
              </li>
            ))}
            {g.trainers.length === 0 && <li className="text-faint">No trainers linked.</li>}
          </ul>
        </Section>

        <Section title="Partner plan history">
          {g.subscriptions.length === 0 ? <p className="m-0 text-sm text-faint">No plan yet — the free trial starts on approval.</p> : (
            <ul className="m-0 list-none divide-y divide-line-soft p-0 text-sm">
              {g.subscriptions.map((s) => (
                <li key={s.id} className="flex flex-wrap justify-between gap-3 py-2.5">
                  <span><span className="font-semibold">{s.plan === 'TRIAL' ? 'Free trial' : s.plan.toLowerCase()}</span> <span className="text-muted">· {longDate(s.startsAt)} → {longDate(s.endsAt)}</span></span>
                  <span className="flex items-center gap-2">{s.priceRwf ? rwf(s.priceRwf) : 'Free'} <Tag s={s.status} /></span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recent activity"><Activity items={g.activity} /></Section>
      </div>
    </>
  );
}

// ───────────────────────── trainer ─────────────────────────

export function AdminTrainerPage() {
  const { id = '' } = useParams();
  const { data, error, reload } = useFetch<{ trainer: AdminTrainerDetail }>(`/admin/trainers/${id}`);
  const t = data?.trainer;
  useDocumentTitle(t?.fullName ?? 'Trainer');
  const { err, busy, run } = useAct(reload);
  if (error) return <p className="text-error">{error.message}</p>;
  if (!t) return <Skeleton h={500} />;

  const actions = (
    <>
      {t.verificationStatus === 'VERIFIED' && <a href={`/coaches/${t.id}`} target="_blank" rel="noreferrer" className="btn btn-ghost !h-11">Public profile</a>}
      {t.verificationStatus !== 'VERIFIED' && <button type="button" disabled={busy} className="btn btn-gold !h-11" onClick={() => run(`/admin/trainers/${t.id}/verify`, { confirm: `Verify ${t.fullName}? They become public and bookable.` })}>Verify</button>}
      {t.verificationStatus === 'PENDING' && <button type="button" disabled={busy} className="btn btn-ghost !h-11" onClick={() => run(`/admin/trainers/${t.id}/reject`, { note: 'Reason shown to the trainer:' })}>Reject</button>}
      {t.verificationStatus !== 'PENDING' && <button type="button" disabled={busy} className="btn btn-ghost !h-11" onClick={() => run(`/admin/trainers/${t.id}/reopen`, { confirm: `Move ${t.fullName} back to pending? They're hidden until verified again.` })}>Reopen</button>}
    </>
  );

  return (
    <>
      <BackLink to="/admin/trainers">All trainers</BackLink>
      <Header eyebrow="Trainer" title={t.fullName} tag={t.verificationStatus} actions={actions}>
        {t.headline ?? 'No headline yet'} · joined {longDate(t.createdAt)}{t.verifiedAt ? ` · verified ${longDate(t.verifiedAt)}` : ''}
      </Header>
      <div className="mb-4"><ErrorNote message={err} /></div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <MiniStat label="Upcoming" value={t.stats.upcoming} />
        <MiniStat label="Completed" value={t.stats.completed} />
        <MiniStat label="Cancelled" value={t.stats.cancelled} />
        <MiniStat label="Earned (all time)" value={rwf(t.stats.earnedRwf)} />
        <MiniStat label="Conversations" value={t.stats.conversations} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Section title="Photo">
            <Photo src={t.photoUrl} alt={t.fullName} caption="No photo yet" className="aspect-[4/5] rounded-2xl" />
          </Section>
          <Section title="Account">
            <Fields cols={2} items={[
              ['Email', <a key="e" href={`mailto:${t.email}`} className="text-text">{t.email}</a>],
              ['Phone', t.phone],
              ['Account', t.accountStatus === 'ACTIVE' ? 'Active' : 'Suspended'],
              ['Last login', t.lastLoginAt ? dateTime(t.lastLoginAt) : 'Never'],
            ]} />
            <Link to={`/admin/users/${t.userId}`} className="mt-4 inline-block text-sm text-gold">Open user account →</Link>
          </Section>
        </div>
        <div className="flex flex-col gap-6">
          <Section title="Profile">
            <p className="mt-0 mb-5 text-[15px] leading-relaxed text-soft">{t.bio ?? <span className="text-faint">No bio yet.</span>}</p>
            <Fields cols={3} items={[
              ['Experience', t.yearsExperience !== null ? `${t.yearsExperience} years` : null],
              ['Session', `${t.sessionMinutes} min`],
              ['Fee', t.sessionFeeRwf ? rwf(t.sessionFeeRwf) : 'Not set'],
            ]} />
            <div className="mt-5 text-xs font-bold tracking-[.12em] text-faint">SPECIALTIES</div>
            <div className="mt-2"><Pills items={t.specialties} /></div>
            <div className="mt-4 text-xs font-bold tracking-[.12em] text-faint">CERTIFICATIONS</div>
            <div className="mt-2"><Pills items={t.certifications} empty="None listed — ask for proof before verifying" /></div>
            <div className="mt-4 text-xs font-bold tracking-[.12em] text-faint">LANGUAGES</div>
            <div className="mt-2"><Pills items={t.languages} /></div>
          </Section>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Section title="Gyms">
              <ul className="m-0 list-none p-0 text-sm">
                {t.gyms.map((g) => <li key={g.id} className="py-1.5"><Link to={`/admin/gyms/${g.id}`} className="text-text">{g.name}</Link> <span className="text-muted">· {g.neighbourhood}</span></li>)}
                {t.gyms.length === 0 && <li className="text-faint">Not linked to a gym.</li>}
              </ul>
            </Section>
            <Section title="Weekly availability">
              <ul className="m-0 list-none p-0 text-sm">
                {t.availability.map((a, i) => <li key={i} className="flex justify-between gap-3 py-1"><span className="text-muted">{WEEKDAY_NAMES[a.weekday]}</span><span>{a.startTime}–{a.endTime}{a.gymName ? ` · ${a.gymName}` : ''}</span></li>)}
                {t.availability.length === 0 && <li className="text-faint">No availability set.</li>}
              </ul>
            </Section>
          </div>
          <Section title="Recent bookings">
            <ul className="m-0 list-none divide-y divide-line-soft p-0 text-sm">
              {t.recentBookings.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <span><span className="font-semibold">{b.memberName}</span> <span className="text-muted">· {dateTime(b.startsAt)} · {rwf(b.feeRwf)}</span></span>
                  <Tag s={b.status} />
                </li>
              ))}
              {t.recentBookings.length === 0 && <li className="py-2 text-faint">No bookings yet.</li>}
            </ul>
          </Section>
          <Section title="Recent activity"><Activity items={t.activity} /></Section>
        </div>
      </div>
    </>
  );
}

// ───────────────────────── user ─────────────────────────

export function AdminUserPage() {
  const { id = '' } = useParams();
  const { data, error, reload } = useFetch<{ user: AdminUserDetail }>(`/admin/users/${id}`);
  const u = data?.user;
  useDocumentTitle(u?.fullName ?? 'User');
  const { err, busy, run } = useAct(reload);
  const [temp, setTemp] = useState<string | null>(null);
  if (error) return <p className="text-error">{error.message}</p>;
  if (!u) return <Skeleton h={500} />;

  const actions = (
    <>
      {u.status === 'ACTIVE'
        ? <button type="button" disabled={busy} className="btn btn-ghost !h-11" onClick={() => run(`/admin/users/${u.id}/suspend`, { confirm: `Suspend ${u.fullName}? They're signed out everywhere.` })}>Suspend</button>
        : <button type="button" disabled={busy} className="btn btn-gold !h-11" onClick={() => run(`/admin/users/${u.id}/reactivate`, { confirm: `Reactivate ${u.fullName}?` })}>Reactivate</button>}
      <button
        type="button"
        disabled={busy}
        className="btn btn-ghost !h-11"
        onClick={async () => {
          const r = (await run(`/admin/users/${u.id}/reset-password`, { confirm: `Give ${u.fullName} a temporary password? Their sessions end.` })) as { temporaryPassword?: string } | null;
          if (r?.temporaryPassword) setTemp(r.temporaryPassword);
        }}
      >
        Reset password
      </button>
    </>
  );

  return (
    <>
      <BackLink to="/admin/users">All users</BackLink>
      <Header eyebrow={u.role.replace('_', ' ').toLowerCase()} title={u.fullName} tag={u.status} actions={actions}>
        {u.email} · joined {longDate(u.createdAt)}
      </Header>
      <div className="mb-4"><ErrorNote message={err} /></div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="Account">
          <Fields items={[
            ['Email', <a key="e" href={`mailto:${u.email}`} className="text-text">{u.email}</a>],
            ['Phone', u.phone ? <a key="p" href={`tel:${u.phone}`} className="text-text">{u.phone}</a> : null],
            ['Role', u.role.replace('_', ' ').toLowerCase()],
            ['Last login', u.lastLoginAt ? dateTime(u.lastLoginAt) : 'Never'],
            ['Password', u.mustChangePassword ? 'Temporary — must change at next login' : 'Set by the user'],
            ['Status', u.status === 'ACTIVE' ? 'Active' : 'Suspended'],
          ]} />
        </Section>
        <Section title="Linked to">
          <ul className="m-0 list-none p-0 text-sm">
            {u.ownedGyms.map((g) => <li key={g.id} className="flex items-center justify-between gap-3 py-1.5"><span>Owner of <Link to={`/admin/gyms/${g.id}`} className="text-gold">{g.name}</Link></span><Tag s={g.status} /></li>)}
            {u.staffOf && <li className="py-1.5">Receptionist at <Link to={`/admin/gyms/${u.staffOf.gymId}`} className="text-gold">{u.staffOf.gymName}</Link>{!u.staffOf.active && ' (deactivated)'}</li>}
            {u.trainerId && <li className="py-1.5"><Link to={`/admin/trainers/${u.trainerId}`} className="text-gold">Trainer profile →</Link></li>}
            {!u.ownedGyms.length && !u.staffOf && !u.trainerId && <li className="text-faint">Member account — see memberships and bookings.</li>}
          </ul>
        </Section>

        {u.memberships.length > 0 && (
          <Section title="Memberships">
            <ul className="m-0 list-none divide-y divide-line-soft p-0 text-sm">
              {u.memberships.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <span><span className="font-semibold">{m.gymName}</span> <span className="text-muted">· {m.packageName} · {m.number}{m.endsAt ? ` · until ${longDate(m.endsAt)}` : ''}</span></span>
                  <Tag s={m.status} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {(u.coachPasses.length > 0 || u.bookings.length > 0) && (
          <Section title="Coaching">
            {u.coachPasses.length > 0 && (
              <>
                <div className="text-xs font-bold tracking-[.12em] text-faint">COACH ACCESS PASSES</div>
                <ul className="m-0 mt-2 mb-4 list-none p-0 text-sm">
                  {u.coachPasses.map((p) => <li key={p.id} className="py-1">{longDate(p.startsAt)} → {longDate(p.endsAt)} · {rwf(p.priceRwf)}</li>)}
                </ul>
              </>
            )}
            {u.bookings.length > 0 && (
              <>
                <div className="text-xs font-bold tracking-[.12em] text-faint">SESSIONS</div>
                <ul className="m-0 mt-2 list-none divide-y divide-line-soft p-0 text-sm">
                  {u.bookings.map((b) => <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-2"><span>{b.trainerName} <span className="text-muted">· {dateTime(b.startsAt)}</span></span><Tag s={b.status} /></li>)}
                </ul>
              </>
            )}
          </Section>
        )}

        <Section title="Payments">
          <ul className="m-0 list-none divide-y divide-line-soft p-0 text-sm">
            {u.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <Link to={`/admin/payments/${p.id}`} className="min-w-0 text-text">{p.description} <span className="text-muted">· {dateTime(p.createdAt)}</span></Link>
                <span className="flex items-center gap-2"><span className="tabular-nums">{rwf(p.amountRwf)}</span><Tag s={p.status} /></span>
              </li>
            ))}
            {u.payments.length === 0 && <li className="py-2 text-faint">No payments.</li>}
          </ul>
        </Section>

        <Section title="Activity"><Activity items={u.activity} /></Section>
      </div>

      {temp && (
        <Modal open onClose={() => setTemp(null)} title="Temporary password">
          <p className="mt-0 text-sm text-chalk">Share it with {u.fullName} directly. It's shown only once; they choose a new password at their next login.</p>
          <div className="rounded-2xl border border-gold-line bg-gold-deep p-5"><div className="text-xs text-faint">{u.email}</div><div className="mt-1 font-mono text-2xl font-bold text-gold">{temp}</div></div>
          <button type="button" className="btn btn-gold mt-5 !h-11" onClick={() => setTemp(null)}>Done</button>
        </Modal>
      )}
    </>
  );
}

// ───────────────────────── payment ─────────────────────────

const METHOD: Record<string, string> = { CARD: 'Card', MOMO: 'Mobile Money', PAID_AT_GYM: 'Paid at the gym' };

export function AdminPaymentPage() {
  const { id = '' } = useParams();
  const { data, error, reload } = useFetch<{ payment: AdminPaymentDetail }>(`/admin/payments/${id}`);
  const p = data?.payment;
  useDocumentTitle('Payment');
  const { err, busy, run } = useAct(reload);
  if (error) return <p className="text-error">{error.message}</p>;
  if (!p) return <Skeleton h={500} />;
  const review = p.failureReason?.startsWith('NEEDS_REVIEW');

  const actions = (
    <>
      {p.status === 'PAID' && p.method !== 'PAID_AT_GYM' && <button type="button" disabled={busy} className="btn btn-ghost !h-11" onClick={() => run(`/admin/payments/${p.id}/refund`, { confirm: `Refund ${rwf(p.amountRwf)} to ${p.user.fullName}? This can't be undone.`, note: 'Reason (shown to the customer):' })}>Refund</button>}
      {review && <button type="button" disabled={busy} className="btn btn-gold !h-11" onClick={() => run(`/admin/payments/${p.id}/resolve`, { note: 'How was it resolved?' })}>Mark resolved</button>}
    </>
  );

  return (
    <>
      <BackLink to="/admin/payments">All payments</BackLink>
      <Header eyebrow={p.purpose.replace('_', ' ').toLowerCase()} title={rwf(p.amountRwf)} tag={p.status} actions={actions}>{p.description}</Header>
      <div className="mb-4"><ErrorNote message={err} /></div>
      {p.failureReason && (
        <div className={`mb-6 rounded-2xl border px-5 py-3 text-sm ${review ? 'border-warning/30 bg-warning/10 text-chalk' : 'border-line bg-surface text-muted'}`}>
          {review ? '⚠ Needs attention: ' : ''}{p.failureReason.replace('NEEDS_REVIEW: ', '')}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="Money">
          <Fields items={[
            ['Amount', rwf(p.amountRwf)],
            ['DIVE-IN commission', p.commissionRwf ? rwf(p.commissionRwf) : 'None'],
            ['To gym / trainer', p.payeeShareRwf ? rwf(p.payeeShareRwf) : '—'],
            ['Method', METHOD[p.method] ?? p.method],
            ['Provider', p.provider],
            ['Provider reference', p.providerRef ? <code key="r" className="text-xs break-all">{p.providerRef}</code> : null],
          ]} />
        </Section>
        <Section title="Timeline">
          <Fields items={[
            ['Started', dateTime(p.createdAt)],
            ['Paid', p.paidAt ? dateTime(p.paidAt) : null],
            ['Verified with provider', p.verifiedAt ? dateTime(p.verifiedAt) : null],
            ['Checkout expires', p.expiresAt ? dateTime(p.expiresAt) : null],
            ['Recorded by', p.recordedBy?.fullName ?? (p.method === 'PAID_AT_GYM' ? null : 'Customer, online')],
            ['Idempotency key', <code key="k" className="text-xs break-all">{p.idempotencyKey}</code>],
          ]} />
        </Section>
        <Section title="Customer">
          <Fields items={[
            ['Name', <Link key="u" to={`/admin/users/${p.user.id}`} className="text-gold">{p.user.fullName}</Link>],
            ['Email', p.user.email],
            ['Phone', p.user.phone],
          ]} />
        </Section>
        <Section title="Paid for">
          {p.target ? (
            <>
              <div className="text-xs font-bold tracking-[.12em] text-faint uppercase">{p.target.kind}</div>
              <div className="mt-1 text-[15px] font-semibold">{p.target.label}</div>
              {p.target.adminLink && <Link to={p.target.adminLink} className="mt-3 inline-block text-sm text-gold">Open →</Link>}
            </>
          ) : <p className="m-0 text-sm text-faint">Nothing linked.</p>}
        </Section>
        <Section title={`Provider events (${p.events.length})`}>
          {p.events.length === 0 ? <p className="m-0 text-sm text-faint">No webhooks received for this payment.</p> : (
            <ul className="m-0 list-none divide-y divide-line-soft p-0 text-sm">
              {p.events.map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-3 py-2">
                  <span><code className="text-[13px] text-gold">{e.type}</code> <span className="text-xs text-faint">{e.eventId}</span></span>
                  <span className="text-xs text-muted">{dateTime(e.receivedAt)} · {e.processed ? 'processed' : 'stored'}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Audit trail"><Activity items={p.activity} /></Section>
      </div>
    </>
  );
}
