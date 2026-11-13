import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ROLE_HOME, changePasswordSchema, fieldErrors } from '@dive/shared';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { Icon } from '../../components/ui/Icon';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { AuthShell, FormError } from './AuthShell';

export default function ChangePassword() {
  useDocumentTitle('Set your password');
  const { user, loading, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const forced = user.mustChangePassword;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = changePasswordSchema.safeParse({ currentPassword: cur, newPassword: next });
    const errs = parsed.success ? {} : fieldErrors(parsed.error);
    if (next !== confirm) errs.confirm = 'Passwords don’t match';
    if (Object.keys(errs).length) return setErrors(errs);
    setErrors({});
    setError('');
    setBusy(true);
    try {
      const u = await changePassword(cur, next);
      navigate(ROLE_HOME[u.role], { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      setError(err instanceof ApiError ? err.message : 'Could not change the password');
      setBusy(false);
    }
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, auto: string) => (
    <div className="mt-4">
      <label className="field-label" htmlFor={id}>{label}</label>
      <input id={id} type="password" autoComplete={auto} className="field" value={value} onChange={(e) => set(e.target.value)} aria-invalid={!!errors[id]} />
      {errors[id] && <p className="field-error">{errors[id]}</p>}
    </div>
  );

  return (
    <AuthShell side="Your desk. Your login." image="/images/gym-4.webp" title={<>Set your<br /><span className="text-gold">password.</span></>}>
      {forced && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold-line bg-gold-deep px-4 py-3 text-sm text-chalk">
          <Icon name="shield" className="mt-0.5 flex-none text-gold" />
          Hi {user.fullName.split(' ')[0]} — your account was created with a temporary password. Choose your own before you start.
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <FormError message={error} />
        {field('currentPassword', forced ? 'Temporary password' : 'Current password', cur, setCur, 'current-password')}
        {field('newPassword', 'New password', next, setNext, 'new-password')}
        {field('confirm', 'Repeat new password', confirm, setConfirm, 'new-password')}
        <p className="mt-3 text-[13px] text-faint">At least 8 characters, with letters and a number. You’ll be signed out on other devices.</p>
        <button type="submit" disabled={busy} className="btn btn-gold mt-6 !h-[56px] w-full">{busy ? 'Saving…' : 'Save password'}</button>
      </form>
      <button type="button" className="mt-6 text-sm text-muted hover:text-text" onClick={async () => { await logout(); navigate('/login'); }}>Log out instead</button>
    </AuthShell>
  );
}
