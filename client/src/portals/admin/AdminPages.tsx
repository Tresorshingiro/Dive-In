import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  fieldErrors,
  platformConfigSchema,
  type AdminGymRow,
  type AdminOverview,
  type AdminPaymentRow,
  type AdminTrainerRow,
  type AdminUserRow,
  type AuditRow,
} from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { BarChart, CHART } from '../../components/charts/BarChart';
import { Icon } from '../../components/ui/Icon';
import { Photo } from '../../components/ui/Photo';
import { PortalShell } from '../trainer/TrainerLayout';
import { NotificationBell } from '../../components/NotificationBell';
import { dateTime, longDate, rwf, timeAgo } from '../../lib/format';
import { Empty, ErrorNote, Flash, Modal, PageHead, Skeleton, Stat } from '../ui';

export default function AdminLayout() {
  return (
    <PortalShell
      label="DIVE-IN admin"
      home="/admin"
      nav={[
        { to: '/admin', label: 'Overview', icon: 'sparkle', end: true },
        { to: '/admin/gyms', label: 'Gyms', icon: 'dumbbell' },
        { to: '/admin/trainers', label: 'Trainers', icon: 'calendarCheck' },
        { to: '/admin/users', label: 'Users', icon: 'user' },
        { to: '/admin/payments', label: 'Payments', icon: 'arrowUpRight' },
        { to: '/admin/settings', label: 'Prices & settings', icon: 'lock' },
        { to: '/admin/inbox', label: 'Contact inbox', icon: 'mail' },
        { to: '/admin/audit', label: 'Audit log', icon: 'shield' },
      ]}
    >
      <NotificationBell />
    </PortalShell>
  );
}

const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
const mLabel = (ym: string) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short' });
const mLong = (ym: string) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/** Asks for an optional note, then runs the action. */
function useAction(reload: () => void) {
  const [err, setErr] = useState('');
  const run = async (path: string, confirmText?: string, askNote?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    let note: string | undefined;
    if (askNote) {
      const r = prompt(askNote);
      if (r === null) return;
      note = r || undefined;
    }
    setErr('');
    try {
      await api(path, { method: 'POST', body: { note } });
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Action failed');
    }
  };
  return { err, run };
}

// ───────────────────────── overview ─────────────────────────

export function AdminHome() {
  useDocumentTitle('Admin');
  const { data } = useFetch<{ overview: AdminOverview }>('/admin/overview');
  const o = data?.overview;
  if (!o) return <Skeleton h={400} />;
  const todo = [
    o.gyms.PENDING && { to: '/admin/gyms?status=PENDING', text: `${o.gyms.PENDING} gym application${o.gyms.PENDING > 1 ? 's' : ''} to review` },
    o.trainersPending && { to: '/admin/trainers?status=PENDING', text: `${o.trainersPending} trainer${o.trainersPending > 1 ? 's' : ''} to verify` },
    o.paymentsNeedingReview && { to: '/admin/payments?status=REVIEW', text: `${o.paymentsNeedingReview} payment${o.paymentsNeedingReview > 1 ? 's' : ''} need attention (refunds, conflicts)` },
    o.contactUnhandled && { to: '/admin/inbox', text: `${o.contactUnhandled} unanswered contact message${o.contactUnhandled > 1 ? 's' : ''}` },
  ].filter(Boolean) as { to: string; text: string }[];

  return (
    <>
      <PageHead eyebrow="Control centre" title="DIVE-IN overview">Platform activity, approvals and revenue. Prices are proposals until confirmed with pilot partners.</PageHead>
      {todo.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {todo.map((t) => (
            <Link key={t.to} to={t.to} className="flex items-center justify-between rounded-2xl border border-gold-line bg-gold-deep px-5 py-3.5 text-sm text-chalk no-underline hover:text-text">
              <span className="flex items-center gap-2.5"><span className="h-2 w-2 rounded-full bg-gold" />{t.text}</span>
              <Icon name="arrowRight" size={15} className="text-gold" />
            </Link>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="DIVE-IN revenue this month" value={rwf(o.revenueThisMonth.total)} tone="gold" hint={`Commission ${short(o.revenueThisMonth.commission)} · Pass ${short(o.revenueThisMonth.coachPass)} · Plans ${short(o.revenueThisMonth.subscriptions)}`} />
        <Stat label="Processed via DIVE-IN" value={rwf(o.processedThisMonthRwf)} hint="All online payments this month" />
        <Stat label="Active memberships" value={o.activeMemberships} hint={`${o.checkInsToday} check-ins today`} />
        <Stat label="Partner gyms" value={o.gyms.APPROVED} hint={`${o.gyms.PENDING} pending · ${o.gyms.SUSPENDED} suspended`} />
        <Stat label="Members" value={o.users.MEMBER ?? 0} />
        <Stat label="Trainers" value={o.users.TRAINER ?? 0} hint={`${o.trainersPending} awaiting verification`} />
        <Stat label="Upcoming sessions" value={o.bookingsUpcoming} />
        <Stat label="Gym owners & staff" value={(o.users.GYM_OWNER ?? 0) + (o.users.RECEPTIONIST ?? 0)} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <BarChart
            title="DIVE-IN revenue · last 6 months"
            data={o.revenueByMonth.map((m) => ({ label: mLabel(m.month), tooltipLabel: mLong(m.month), values: { commission: m.commission, pass: m.coachPass, subs: m.subscriptions } }))}
            series={[{ key: 'commission', label: 'Commission', color: CHART.gold }, { key: 'pass', label: 'Coach Access Pass', color: CHART.blue }, { key: 'subs', label: 'Partner plans', color: CHART.magenta }]}
            format={short}
          />
        </section>
        <section className="card p-6">
          <BarChart
            title="New sign-ups · last 6 months"
            data={o.signupsByMonth.map((m) => ({ label: mLabel(m.month), tooltipLabel: mLong(m.month), values: { members: m.members, gyms: m.gyms, trainers: m.trainers } }))}
            series={[{ key: 'members', label: 'Members', color: CHART.gold }, { key: 'gyms', label: 'Gym owners', color: CHART.blue }, { key: 'trainers', label: 'Trainers', color: CHART.magenta }]}
          />
        </section>
      </div>
    </>
  );
}

// ───────────────────────── gyms ─────────────────────────

const STATUS_TABS = (values: string[]) => ['', ...values];
function Tabs({ values, labels }: { values: string[]; labels?: Record<string, string> }) {
  const [params, setParams] = useSearchParams();
  const cur = params.get('status') ?? '';
  return (
    <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter">
      {STATUS_TABS(values).map((v) => (
        <button key={v} type="button" className="chip !h-10 !px-4 !text-[13px]" aria-pressed={cur === v} onClick={() => setParams((p) => { v ? p.set('status', v) : p.delete('status'); p.delete('page'); return p; })}>
          {v ? (labels?.[v] ?? v.charAt(0) + v.slice(1).toLowerCase().replace('_', ' ')) : 'All'}
        </button>
      ))}
    </div>
  );
}
const pill = (s: string) => ({ PENDING: 'bg-warning/15 text-warning', APPROVED: 'bg-success/15 text-success', VERIFIED: 'bg-success/15 text-success', REJECTED: 'bg-error/15 text-error', SUSPENDED: 'bg-error/15 text-error', ACTIVE: 'bg-success/15 text-success' })[s] ?? 'bg-field text-muted';

export function AdminGyms() {
  useDocumentTitle('Gyms');
  const [params] = useSearchParams();
  const status = params.get('status') ?? '';
  const { data, reload } = useFetch<{ gyms: AdminGymRow[] }>(`/admin/gyms${status ? `?status=${status}` : ''}`);
  const { err, run } = useAction(reload);
  return (
    <>
      <PageHead eyebrow="Partners" title="Gyms">Approving a gym makes it public and starts its free trial. Every decision is logged.</PageHead>
      <Tabs values={['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']} />
      <div className="mb-4"><ErrorNote message={err} /></div>
      {!data ? <Skeleton h={300} /> : data.gyms.length === 0 ? <Empty>No gyms here.</Empty> : (
        <div className="flex flex-col gap-3">
          {data.gyms.map((g) => (
            <div key={g.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/admin/gyms/${g.id}`} className="text-lg font-bold text-text hover:text-gold">{g.name}</Link>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${pill(g.status)}`}>{g.status}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted">{g.neighbourhood} · applied {longDate(g.createdAt)} · {g.owner.fullName} · {g.owner.email}{g.owner.phone ? ` · ${g.owner.phone}` : ''}</div>
                  <div className="mt-2 text-[13px] text-chalk">
                    {g.packages} packages · {g.photos} photos · {g.activeMembers} active members · {g.diveCheckoutEnabled ? `DIVE-IN checkout${g.commissionOptIn ? ' + commission' : ''}` : 'pays at gym'}
                    {g.subscription && ` · ${g.subscription.plan.toLowerCase()} until ${longDate(g.subscription.endsAt)}`}
                  </div>
                  {g.statusNote && <div className="mt-2 text-[13px] text-warning">Note: {g.statusNote}</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/admin/gyms/${g.id}`} className="btn btn-ghost !h-10 !px-4 !text-[13px]">Full details</Link>
                  {g.status === 'APPROVED' && <a href={`/gyms/${g.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost !h-10 !px-4 !text-[13px]">View</a>}
                  {(g.status === 'PENDING' || g.status === 'REJECTED') && <button type="button" className="btn btn-gold !h-10 !px-4 !text-[13px]" onClick={() => run(`/admin/gyms/${g.id}/approve`, `Approve ${g.name}? It goes live and its free trial starts.`)}>Approve</button>}
                  {g.status === 'PENDING' && <button type="button" className="btn btn-ghost !h-10 !px-4 !text-[13px]" onClick={() => run(`/admin/gyms/${g.id}/reject`, undefined, 'Reason shown to the owner:')}>Reject</button>}
                  {g.status === 'APPROVED' && <button type="button" className="btn btn-ghost !h-10 !px-4 !text-[13px]" onClick={() => run(`/admin/gyms/${g.id}/suspend`, undefined, `Suspend ${g.name}? Reason shown to the owner:`)}>Suspend</button>}
                  {g.status === 'SUSPENDED' && <button type="button" className="btn btn-gold !h-10 !px-4 !text-[13px]" onClick={() => run(`/admin/gyms/${g.id}/reinstate`, `Reinstate ${g.name}?`)}>Reinstate</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ───────────────────────── trainers ─────────────────────────

export function AdminTrainers() {
  useDocumentTitle('Trainers');
  const [params] = useSearchParams();
  const status = params.get('status') ?? '';
  const { data, reload } = useFetch<{ trainers: AdminTrainerRow[] }>(`/admin/trainers${status ? `?status=${status}` : ''}`);
  const { err, run } = useAction(reload);
  return (
    <>
      <PageHead eyebrow="Coaches" title="Trainer verification">Only verified trainers appear publicly and can be booked.</PageHead>
      <Tabs values={['PENDING', 'VERIFIED', 'REJECTED']} />
      <div className="mb-4"><ErrorNote message={err} /></div>
      {!data ? <Skeleton h={300} /> : data.trainers.length === 0 ? <Empty>No trainers here.</Empty> : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {data.trainers.map((t) => (
            <div key={t.id} className="card flex gap-4 p-4">
              <Photo src={t.photoUrl} alt="" className="h-24 w-20 flex-none rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/admin/trainers/${t.id}`} className="font-bold text-text hover:text-gold">{t.fullName}</Link>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${pill(t.verificationStatus)}`}>{t.verificationStatus}</span>
                </div>
                <div className="text-[13px] text-muted">{t.email}{t.phone ? ` · ${t.phone}` : ''} · joined {longDate(t.createdAt)}</div>
                <div className="mt-1.5 text-[13px] text-chalk">{t.headline ?? 'No headline'} · {t.specialties.join(', ') || 'no specialties'}</div>
                <div className="text-[13px] text-chalk">{t.certifications.length ? `Certs: ${t.certifications.join(', ')}` : 'No certifications listed'}{t.yearsExperience !== null ? ` · ${t.yearsExperience} yrs` : ''}{t.gyms.length ? ` · ${t.gyms.join(', ')}` : ''}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/admin/trainers/${t.id}`} className="btn btn-ghost !h-9 !px-3.5 !text-[13px]">Full details</Link>
                  {t.verificationStatus !== 'VERIFIED' && <button type="button" className="btn btn-gold !h-9 !px-3.5 !text-[13px]" onClick={() => run(`/admin/trainers/${t.id}/verify`, `Verify ${t.fullName}? They become public and bookable.`)}>Verify</button>}
                  {t.verificationStatus === 'PENDING' && <button type="button" className="btn btn-ghost !h-9 !px-3.5 !text-[13px]" onClick={() => run(`/admin/trainers/${t.id}/reject`, undefined, 'Reason shown to the trainer:')}>Reject</button>}
                  {t.verificationStatus !== 'PENDING' && <button type="button" className="btn btn-ghost !h-9 !px-3.5 !text-[13px]" onClick={() => run(`/admin/trainers/${t.id}/reopen`, `Move ${t.fullName} back to pending? They're hidden until verified again.`)}>Reopen</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ───────────────────────── users ─────────────────────────

export function AdminUsers() {
  useDocumentTitle('Users');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const role = params.get('role') ?? '';
  const page = Number(params.get('page') ?? 1);
  useEffect(() => {
    const t = setTimeout(() => setParams((p) => { q ? p.set('q', q) : p.delete('q'); p.delete('page'); return p; }, { replace: true }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const qs = new URLSearchParams({ page: String(page) });
  if (role) qs.set('role', role);
  if (params.get('q')) qs.set('q', params.get('q')!);
  const { data, reload } = useFetch<{ rows: AdminUserRow[]; total: number; pageSize: number }>(`/admin/users?${qs}`);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');
  const act = async (u: AdminUserRow, what: string, msg: string) => {
    if (!confirm(msg)) return;
    setErr('');
    try {
      const r = await api<{ temporaryPassword?: string } | undefined>(`/admin/users/${u.id}/${what}`, { method: 'POST' });
      if (r?.temporaryPassword) setSecret({ email: u.email, password: r.temporaryPassword });
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed');
    }
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <PageHead eyebrow="Accounts" title="Users" actions={<button type="button" className="btn btn-gold !h-11" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> New admin</button>}>
        {data ? `${data.total} accounts` : ' '}. Suspending signs the person out everywhere immediately.
      </PageHead>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex h-12 flex-1 items-center gap-2.5 rounded-2xl border border-line bg-field px-4">
          <Icon name="search" size={18} className="text-dim" />
          <span className="sr-only">Search users</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or phone" className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-text outline-none placeholder:text-[#6b675f]" />
        </label>
        <div className="flex flex-wrap gap-2">
          {['', 'MEMBER', 'GYM_OWNER', 'RECEPTIONIST', 'TRAINER', 'ADMIN'].map((r) => (
            <button key={r} type="button" className="chip !h-10 !px-4 !text-[13px]" aria-pressed={role === r} onClick={() => setParams((p) => { r ? p.set('role', r) : p.delete('role'); p.delete('page'); return p; })}>{r ? r.replace('_', ' ').toLowerCase() : 'all'}</button>
          ))}
        </div>
      </div>
      <div className="mb-4"><ErrorNote message={err} /></div>
      {!data ? <Skeleton h={400} /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-line text-xs tracking-[.1em] text-faint"><th className="px-5 py-3.5 font-bold">NAME</th><th className="px-3 py-3.5 font-bold">ROLE</th><th className="px-3 py-3.5 font-bold">STATUS</th><th className="px-3 py-3.5 font-bold">LAST LOGIN</th><th className="px-5 py-3.5 text-right font-bold">ACTIONS</th></tr></thead>
            <tbody>
              {data.rows.map((u) => (
                <tr key={u.id} className="border-b border-line-soft">
                  <td className="px-5 py-3"><Link to={`/admin/users/${u.id}`} className="font-semibold text-text hover:text-gold">{u.fullName}</Link><span className="block text-xs text-muted">{u.email}{u.phone ? ` · ${u.phone}` : ''}</span></td>
                  <td className="px-3 py-3 text-chalk">{u.role.replace('_', ' ').toLowerCase()}{u.role === 'ADMIN' && u.mfaEnabled && <span className="ml-2 text-[11px] font-bold text-success">2FA</span>}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${pill(u.status)}`}>{u.status}</span></td>
                  <td className="px-3 py-3 text-chalk">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'never'}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {u.status === 'ACTIVE'
                        ? <button type="button" className="btn btn-ghost !h-8 !px-3 !text-xs" onClick={() => act(u, 'suspend', `Suspend ${u.fullName}?`)}>Suspend</button>
                        : <button type="button" className="btn btn-ghost !h-8 !px-3 !text-xs" onClick={() => act(u, 'reactivate', `Reactivate ${u.fullName}?`)}>Reactivate</button>}
                      <button type="button" className="btn btn-ghost !h-8 !px-3 !text-xs" onClick={() => act(u, 'reset-password', `Give ${u.fullName} a temporary password? Their sessions end.`)}>Reset password</button>
                      {u.role === 'ADMIN' && u.mfaEnabled && <button type="button" className="btn btn-ghost !h-8 !px-3 !text-xs" onClick={() => act(u, 'reset-mfa', `Reset ${u.fullName}'s two-factor app? They'll set it up again at next login.`)}>Reset 2FA</button>}
                    </div>
                  </td>
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
      {secret && (
        <Modal open onClose={() => setSecret(null)} title="Temporary password">
          <p className="mt-0 text-sm text-chalk">Share it with the person directly. Shown only once; they must choose a new password at login.</p>
          <div className="rounded-2xl border border-gold-line bg-gold-deep p-5"><div className="text-xs text-faint">{secret.email}</div><div className="mt-1 font-mono text-2xl font-bold text-gold">{secret.password}</div></div>
          <button type="button" className="btn btn-gold mt-5 !h-11" onClick={() => setSecret(null)}>Done</button>
        </Modal>
      )}
      {adding && <NewAdmin onClose={() => setAdding(false)} onCreated={(s) => { setAdding(false); setSecret(s); reload(); }} />}
    </>
  );
}

function NewAdmin({ onClose, onCreated }: { onClose: () => void; onCreated: (s: { email: string; password: string }) => void }) {
  const [f, setF] = useState({ fullName: '', email: '' });
  const [err, setErr] = useState('');
  return (
    <Modal open onClose={onClose} title="New admin">
      <form className="flex flex-col gap-4" onSubmit={async (e) => {
        e.preventDefault();
        try {
          const r = await api<{ temporaryPassword: string }>('/admin/admins', { method: 'POST', body: f });
          onCreated({ email: f.email, password: r.temporaryPassword });
        } catch (e2) { setErr(e2 instanceof ApiError ? e2.message : 'Failed'); }
      }}>
        <p className="m-0 text-sm text-muted">They sign in at /admin/login with a temporary password, then choose their own.</p>
        <ErrorNote message={err} />
        <input className="field" placeholder="Full name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} aria-label="Full name" />
        <input className="field" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-label="Email" />
        <button type="submit" className="btn btn-gold !h-12">Create admin</button>
      </form>
    </Modal>
  );
}

// ───────────────────────── payments ─────────────────────────

export function AdminPayments() {
  useDocumentTitle('Payments');
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const purpose = params.get('purpose') ?? '';
  const page = Number(params.get('page') ?? 1);
  const qs = new URLSearchParams({ page: String(page) });
  if (status) qs.set('status', status);
  if (purpose) qs.set('purpose', purpose);
  const { data, reload } = useFetch<{ rows: AdminPaymentRow[]; total: number; pageSize: number }>(`/admin/payments?${qs}`);
  const { err, run } = useAction(reload);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <PageHead eyebrow="Money" title="Payments">A payment is PAID only after the provider confirms it. Refunds go back through the provider and withdraw what was bought.</PageHead>
      <Tabs values={['REVIEW', 'PAID', 'PENDING', 'FAILED', 'REFUNDED']} labels={{ REVIEW: 'Needs attention' }} />
      <div className="mb-5 flex flex-wrap gap-2">
        {['', 'MEMBERSHIP', 'COACH_PASS', 'SESSION', 'GYM_SUBSCRIPTION'].map((p) => (
          <button key={p} type="button" className="chip !h-9 !px-3.5 !text-xs" aria-pressed={purpose === p} onClick={() => setParams((x) => { p ? x.set('purpose', p) : x.delete('purpose'); x.delete('page'); return x; })}>{p ? p.replace('_', ' ').toLowerCase() : 'all types'}</button>
        ))}
      </div>
      <div className="mb-4"><ErrorNote message={err} /></div>
      {!data ? <Skeleton h={400} /> : data.rows.length === 0 ? <Empty>No payments here.</Empty> : (
        <div className="card divide-y divide-line-soft">
          {data.rows.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <Link to={`/admin/payments/${p.id}`} className="font-semibold text-text hover:text-gold">{p.description}</Link>
                <div className="text-xs text-muted">{p.userName} · {p.userEmail} · {dateTime(p.paidAt ?? p.createdAt)} · {p.method === 'PAID_AT_GYM' ? 'at gym' : `${p.method.toLowerCase()} via ${p.provider}`}</div>
                {p.failureReason && <div className={`mt-1 text-xs ${p.needsReview ? 'font-semibold text-warning' : 'text-faint'}`}>{p.failureReason.replace('NEEDS_REVIEW: ', '⚠ ')}</div>}
              </div>
              <span className="font-semibold tabular-nums">{rwf(p.amountRwf)}</span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${p.status === 'PAID' ? 'bg-success/15 text-success' : p.status === 'PENDING' ? 'bg-warning/15 text-warning' : 'bg-field text-muted'}`}>{p.status}</span>
              <div className="flex gap-2">
                {p.status === 'PAID' && p.method !== 'PAID_AT_GYM' && <button type="button" className="btn btn-ghost !h-9 !px-3 !text-xs" onClick={() => run(`/admin/payments/${p.id}/refund`, `Refund ${rwf(p.amountRwf)} to ${p.userName}? This can't be undone.`, 'Reason (shown to the customer):')}>Refund</button>}
                {p.needsReview && <button type="button" className="btn btn-ghost !h-9 !px-3 !text-xs" onClick={() => run(`/admin/payments/${p.id}/resolve`, undefined, 'How was it resolved?')}>Mark resolved</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {pages > 1 && (
        <div className="mt-5 flex items-center justify-end gap-3 text-sm">
          <button type="button" className="btn btn-ghost !h-10" disabled={page <= 1} onClick={() => setParams((p) => { p.set('page', String(page - 1)); return p; })}>Previous</button>
          <span className="text-muted">Page {page} of {pages}</span>
          <button type="button" className="btn btn-ghost !h-10" disabled={page >= pages} onClick={() => setParams((p) => { p.set('page', String(page + 1)); return p; })}>Next</button>
        </div>
      )}
    </>
  );
}

// ───────────────────────── settings ─────────────────────────

interface Cfg {
  coachPass: { priceRwf: number; days: number };
  gymPlans: Record<'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL', { priceRwf: number; months: number; label: string }>;
  commissionPercent: number;
  trialDays: number;
}

export function AdminSettings() {
  useDocumentTitle('Prices & settings');
  const { data, setData } = useFetch<{ config: Cfg }>('/admin/config');
  const [c, setC] = useState<Cfg | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (data && !c) setC(data.config); }, [data, c]);
  useEffect(() => { if (saved) { const t = setTimeout(() => setSaved(false), 2500); return () => clearTimeout(t); } }, [saved]);
  if (!c) return <Skeleton h={400} />;
  const num = (v: string) => Number(v.replace(/[,\s]/g, '')) || 0;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = platformConfigSchema.safeParse(c);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    if (!confirm('Save new platform prices? They apply to new purchases immediately and are logged.')) return;
    setErrors({});
    setErr('');
    try {
      const r = await api<{ config: Cfg }>('/admin/config', { method: 'PUT', body: parsed.data });
      setData(r);
      setC(r.config);
      setSaved(true);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Could not save');
    }
  };
  const row = (label: string, value: number, onChange: (n: number) => void, suffix: string, errKey: string) => (
    <div className="grid grid-cols-[1fr_180px] items-center gap-4 py-3">
      <label className="text-sm text-chalk">{label}</label>
      <div>
        <div className="flex items-center gap-2">
          <input className="field !h-11 text-right tabular-nums" inputMode="numeric" value={value.toLocaleString('en-US')} onChange={(e) => onChange(num(e.target.value))} aria-label={label} aria-invalid={!!errors[errKey]} />
          <span className="w-10 text-xs text-muted">{suffix}</span>
        </div>
        {errors[errKey] && <p className="field-error">{errors[errKey]}</p>}
      </div>
    </div>
  );
  return (
    <form onSubmit={save} noValidate>
      <PageHead eyebrow="Platform" title="Prices & settings" actions={<><Flash show={saved} /><button type="submit" className="btn btn-gold !h-11">Save</button></>}>
        Proposed prices from the business plan, still to be validated with pilot partners. Changes apply to new purchases only.
      </PageHead>
      <div className="mb-4"><ErrorNote message={err} /></div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <h2 className="disp m-0 mb-2 text-[26px]">Coach Access Pass</h2>
          <div className="divide-y divide-line-soft">
            {row('Price', c.coachPass.priceRwf, (n) => setC({ ...c, coachPass: { ...c.coachPass, priceRwf: n } }), 'RWF', 'coachPass.priceRwf')}
            {row('Length', c.coachPass.days, (n) => setC({ ...c, coachPass: { ...c.coachPass, days: n } }), 'days', 'coachPass.days')}
          </div>
        </section>
        <section className="card p-6">
          <h2 className="disp m-0 mb-2 text-[26px]">Membership checkout</h2>
          <div className="divide-y divide-line-soft">
            {row('DIVE-IN commission (gyms that opt in)', c.commissionPercent, (n) => setC({ ...c, commissionPercent: n }), '%', 'commissionPercent')}
            {row('Free trial for new gyms', c.trialDays, (n) => setC({ ...c, trialDays: n }), 'days', 'trialDays')}
          </div>
        </section>
        <section className="card p-6 xl:col-span-2">
          <h2 className="disp m-0 mb-2 text-[26px]">Gym partner plans</h2>
          <div className="grid grid-cols-1 divide-y divide-line-soft md:grid-cols-2 md:gap-x-10 md:divide-y-0">
            {(Object.keys(c.gymPlans) as Array<keyof Cfg['gymPlans']>).map((k) => (
              <div key={k} className="md:border-b md:border-line-soft">
                {row(`${c.gymPlans[k].label} (${c.gymPlans[k].months} mo)`, c.gymPlans[k].priceRwf, (n) => setC({ ...c, gymPlans: { ...c.gymPlans, [k]: { ...c.gymPlans[k], priceRwf: n } } }), 'RWF', `gymPlans.${k}.priceRwf`)}
              </div>
            ))}
          </div>
        </section>
      </div>
    </form>
  );
}

// ───────────────────────── inbox ─────────────────────────

interface Contact { id: string; name: string; email: string; phone: string | null; role: string; gymName: string | null; neighbourhood: string | null; message: string; createdAt: string; handledAt: string | null }

export function AdminInbox() {
  useDocumentTitle('Contact inbox');
  const [all, setAll] = useState(false);
  const { data, reload } = useFetch<{ messages: Contact[] }>(`/admin/contact${all ? '?all=true' : ''}`);
  return (
    <>
      <PageHead eyebrow="Support" title="Contact inbox" actions={<button type="button" className="btn btn-ghost !h-11" onClick={() => setAll((a) => !a)}>{all ? 'Show unanswered only' : 'Show all'}</button>}>Messages from the public contact form.</PageHead>
      {!data ? <Skeleton h={300} /> : data.messages.length === 0 ? <Empty>Inbox zero.</Empty> : (
        <div className="flex flex-col gap-3">
          {data.messages.map((m) => (
            <div key={m.id} className={`card p-5 ${m.handledAt ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-bold">{m.name} <span className="ml-1 rounded-full bg-field px-2 py-0.5 text-[11px] font-bold text-muted">{m.role.replace('_', ' ')}</span></div>
                  <div className="text-xs text-muted">{m.email}{m.phone ? ` · ${m.phone}` : ''} · {timeAgo(m.createdAt)}{m.gymName ? ` · ${m.gymName} (${m.neighbourhood})` : ''}</div>
                </div>
                <div className="flex gap-2">
                  <a href={`mailto:${m.email}?subject=${encodeURIComponent('DIVE-IN Fitness Hub')}`} className="btn btn-ghost !h-9 !px-3.5 !text-[13px]">Reply</a>
                  {!m.handledAt && <button type="button" className="btn btn-gold !h-9 !px-3.5 !text-[13px]" onClick={async () => { await api(`/admin/contact/${m.id}/handled`, { method: 'POST' }); reload(); }}>Mark handled</button>}
                </div>
              </div>
              <p className="mt-3 mb-0 whitespace-pre-wrap text-[15px] text-chalk">{m.message}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ───────────────────────── audit ─────────────────────────

export function AdminAudit() {
  useDocumentTitle('Audit log');
  const [params, setParams] = useSearchParams();
  const [action, setAction] = useState(params.get('action') ?? '');
  const [actor, setActor] = useState(params.get('actor') ?? '');
  const page = Number(params.get('page') ?? 1);
  const [open, setOpen] = useState<string | null>(null);
  const qs = new URLSearchParams({ page: String(page) });
  if (params.get('action')) qs.set('action', params.get('action')!);
  if (params.get('actor')) qs.set('actor', params.get('actor')!);
  const { data } = useFetch<{ rows: AuditRow[]; total: number; pageSize: number }>(`/admin/audit?${qs}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <PageHead eyebrow="Security" title="Audit log">Every important admin, owner and reception action: who, what, when, from where.</PageHead>
      <form className="mb-5 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setParams(() => { const p = new URLSearchParams(); if (action) p.set('action', action); if (actor) p.set('actor', actor); return p; }); }}>
        <input className="field !h-11 !w-[220px]" placeholder="Action, e.g. payment. or gym.approve" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action prefix" />
        <input className="field !h-11 !w-[220px]" placeholder="Who (name or email)" value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Actor" />
        <button type="submit" className="btn btn-ghost !h-11">Filter</button>
        <div className="flex flex-wrap gap-2">
          {['auth.', 'gym.', 'payment.', 'checkin.', 'staff.', 'config.', 'user.'].map((a) => <button key={a} type="button" className="chip !h-9 !px-3 !text-xs" onClick={() => setParams({ action: a })}>{a}</button>)}
        </div>
      </form>
      {!data ? <Skeleton h={400} /> : (
        <div className="card divide-y divide-line-soft">
          {data.rows.map((r) => (
            <div key={r.id} className="px-5 py-3 text-sm">
              <button type="button" className="flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 text-left" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                <span className="w-[150px] flex-none text-xs text-faint tabular-nums">{dateTime(r.createdAt)}</span>
                <code className="text-gold">{r.action}</code>
                <span className="flex-1 text-chalk">{r.actorName ?? 'System'}{r.actorRole ? ` · ${r.actorRole.toLowerCase().replace('_', ' ')}` : ''}{r.gymName ? ` · ${r.gymName}` : ''}</span>
                <span className="text-xs text-faint">{r.ip ?? ''}</span>
              </button>
              {open === r.id && (
                <pre className="mt-2 max-h-60 overflow-auto rounded-xl border border-line bg-ink p-3 text-xs text-chalk">{JSON.stringify({ entity: r.entity, entityId: r.entityId, before: r.before, after: r.after }, null, 2)}</pre>
              )}
            </div>
          ))}
          {data.rows.length === 0 && <p className="m-0 p-6 text-center text-muted">Nothing matches.</p>}
        </div>
      )}
      {pages > 1 && (
        <div className="mt-5 flex items-center justify-end gap-3 text-sm">
          <button type="button" className="btn btn-ghost !h-10" disabled={page <= 1} onClick={() => setParams((p) => { p.set('page', String(page - 1)); return p; })}>Newer</button>
          <span className="text-muted">Page {page} of {pages}</span>
          <button type="button" className="btn btn-ghost !h-10" disabled={page >= pages} onClick={() => setParams((p) => { p.set('page', String(page + 1)); return p; })}>Older</button>
        </div>
      )}
    </>
  );
}
