import { useState, type FormEvent } from 'react';
import { fieldErrors, staffCreateSchema, type LinkedTrainerRow, type StaffRow } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Icon } from '../../components/ui/Icon';
import { Photo } from '../../components/ui/Photo';
import { longDate, timeAgo } from '../../lib/format';
import { Empty, ErrorNote, Modal, PageHead, Skeleton } from '../ui';

// ───────────────────────── trainers ─────────────────────────

export function Trainers() {
  useDocumentTitle('Trainers');
  const { data, loading, setData } = useFetch<{ trainers: LinkedTrainerRow[] }>('/gym/trainers');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const link = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      setData(await api('/gym/trainers', { method: 'POST', body: { email } }));
      setEmail('');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Could not add trainer');
    } finally {
      setBusy(false);
    }
  };
  const unlink = async (t: LinkedTrainerRow) => {
    if (!confirm(`Remove ${t.fullName} from your gym?`)) return;
    try {
      await api(`/gym/trainers/${t.trainerId}`, { method: 'DELETE' });
      setData({ trainers: (data?.trainers ?? []).filter((x) => x.trainerId !== t.trainerId) });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not remove');
    }
  };

  return (
    <>
      <PageHead eyebrow="Trainers" title="Trainers at your gym">Coaches linked here appear on your gym profile. They manage their own profile and availability; DIVE-IN verifies them before they show publicly.</PageHead>
      <form onSubmit={link} className="card mb-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="field-label" htmlFor="tr-email">Add a trainer by their DIVE-IN account email</label>
          <input id="tr-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="coach@example.com" />
        </div>
        <button type="submit" className="btn btn-gold !h-[54px]" disabled={busy || !email}>{busy ? 'Adding…' : 'Add trainer'}</button>
      </form>
      <div className="mb-4"><ErrorNote message={err} /></div>
      {loading && !data ? <Skeleton h={200} /> : !data?.trainers.length ? <Empty>No trainers linked yet. Ask your coaches to register as trainers on DIVE-IN, then add them here.</Empty> : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.trainers.map((t) => (
            <div key={t.trainerId} className="card flex items-center gap-4 p-4">
              <Photo src={t.photoUrl} alt={t.fullName} className="h-16 w-16 flex-none rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-bold">{t.fullName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${t.verificationStatus === 'VERIFIED' ? 'bg-success/15 text-success' : t.verificationStatus === 'PENDING' ? 'bg-warning/15 text-warning' : 'bg-error/15 text-error'}`}>{t.verificationStatus}</span>
                </div>
                <div className="truncate text-[13px] text-muted">{t.specialties.join(' · ') || 'No specialties yet'} · since {longDate(t.linkedAt)}</div>
              </div>
              <button type="button" className="btn btn-ghost !h-9 !px-3 !text-[13px]" onClick={() => unlink(t)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ───────────────────────── staff ─────────────────────────

function NewStaff({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ fullName: '', email: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = staffCreateSchema.safeParse(f);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    try {
      const r = await api<{ temporaryPassword: string }>('/gym/staff', { method: 'POST', body: parsed.data });
      setDone(r.temporaryPassword);
      onCreated();
    } catch (e2) {
      if (e2 instanceof ApiError && e2.fields) setErrors(e2.fields);
      setErr(e2 instanceof ApiError ? e2.message : 'Could not create account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={done ? 'Account created' : 'New reception account'}>
      {done ? <TempPassword email={f.email} password={done} onClose={onClose} /> : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <p className="m-0 text-sm text-muted">Reception accounts can search members, see their live status and record check-ins. They can’t see money, change prices or settings.</p>
          <ErrorNote message={err} />
          {(['fullName', 'email', 'phone'] as const).map((k) => (
            <div key={k}>
              <label className="field-label" htmlFor={`st-${k}`}>{k === 'fullName' ? 'Full name' : k === 'email' ? 'Email (their login)' : 'Phone'}</label>
              <input id={`st-${k}`} className="field" type={k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'} value={f[k]} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))} aria-invalid={!!errors[k]} />
              {errors[k] && <p className="field-error">{errors[k]}</p>}
            </div>
          ))}
          <button type="submit" className="btn btn-gold !h-[52px]" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        </form>
      )}
    </Modal>
  );
}

function TempPassword({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="mt-0 text-sm text-chalk">Give these to the staff member in person. The password is shown <strong className="text-text">only once</strong>; they must choose their own when they first log in.</p>
      <div className="mt-4 rounded-2xl border border-gold-line bg-gold-deep p-5">
        <div className="text-xs font-bold tracking-[.12em] text-faint">LOGIN</div>
        <div className="mt-1 font-semibold break-all">{email || '—'}</div>
        <div className="mt-4 text-xs font-bold tracking-[.12em] text-faint">TEMPORARY PASSWORD</div>
        <div className="mt-1 font-mono text-2xl font-bold tracking-wider text-gold">{password}</div>
      </div>
      <div className="mt-5 flex gap-3">
        <button type="button" className="btn btn-ghost !h-11" onClick={async () => { await navigator.clipboard.writeText(password); setCopied(true); }}>{copied ? 'Copied' : 'Copy password'}</button>
        <button type="button" className="btn btn-gold !h-11" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

export function Staff() {
  useDocumentTitle('Staff');
  const { data, loading, reload } = useFetch<{ staff: StaffRow[] }>('/gym/staff');
  const [adding, setAdding] = useState(false);
  const [reset, setReset] = useState<{ email: string; password: string } | null>(null);
  const [err, setErr] = useState('');

  const act = async (s: StaffRow, what: 'deactivate' | 'reactivate' | 'reset-password') => {
    if (what === 'deactivate' && !confirm(`Deactivate ${s.fullName}? They’ll be signed out immediately.`)) return;
    if (what === 'reset-password' && !confirm(`Reset ${s.fullName}’s password? Their current sessions end.`)) return;
    setErr('');
    try {
      const r = await api<{ temporaryPassword?: string } | undefined>(`/gym/staff/${s.id}/${what}`, { method: 'POST' });
      if (r?.temporaryPassword) setReset({ email: s.email, password: r.temporaryPassword });
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Action failed');
    }
  };

  return (
    <>
      <PageHead eyebrow="Staff" title="Staff accounts" actions={<button type="button" className="btn btn-gold !h-11" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add receptionist</button>}>
        Each receptionist gets their own login, so every check-in is traceable. Access is limited to the reception desk of this gym.
      </PageHead>
      <div className="mb-4"><ErrorNote message={err} /></div>
      {loading && !data ? <Skeleton h={200} /> : !data?.staff.length ? <Empty>No staff accounts yet.</Empty> : (
        <div className="card divide-y divide-line-soft">
          {data.staff.map((s) => (
            <div key={s.id} className={`flex flex-wrap items-center gap-4 p-5 ${s.active ? '' : 'opacity-60'}`}>
              <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-field font-bold text-gold">{s.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{s.fullName}</span>
                  {!s.active && <span className="rounded-full bg-field px-2 py-0.5 text-[11px] font-bold text-muted">DEACTIVATED</span>}
                  {s.active && s.mustChangePassword && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-bold text-warning">FIRST LOGIN PENDING</span>}
                </div>
                <div className="truncate text-[13px] text-muted">{s.email} · {s.phone} · {s.lastLoginAt ? `last login ${timeAgo(s.lastLoginAt)}` : 'never logged in'}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {s.active ? (
                  <>
                    <button type="button" className="btn btn-ghost !h-9 !px-3 !text-[13px]" onClick={() => act(s, 'reset-password')}>Reset password</button>
                    <button type="button" className="btn btn-ghost !h-9 !px-3 !text-[13px]" onClick={() => act(s, 'deactivate')}>Deactivate</button>
                  </>
                ) : (
                  <button type="button" className="btn btn-ghost !h-9 !px-3 !text-[13px]" onClick={() => act(s, 'reactivate')}>Reactivate</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {adding && <NewStaff onClose={() => setAdding(false)} onCreated={reload} />}
      {reset && <Modal open onClose={() => setReset(null)} title="New temporary password"><TempPassword email={reset.email} password={reset.password} onClose={() => setReset(null)} /></Modal>}
    </>
  );
}
