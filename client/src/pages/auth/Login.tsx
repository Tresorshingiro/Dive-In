import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { fieldErrors, loginSchema } from '@dive/shared';
import { afterAuthPath } from '../../lib/redirect';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { Icon } from '../../components/ui/Icon';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { AuthShell, FormError } from './AuthShell';

const DEMO = [
  ['Member', 'member@demo.dive.rw'],
  ['Gym owner', 'owner@demo.dive.rw'],
  ['Reception', 'reception@demo.dive.rw'],
  ['Trainer', 'trainer@demo.dive.rw'],
] as const;

export function LoginForm({ admin = false }: { admin?: boolean }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setError('');
    setBusy(true);
    try {
      const user = await login(parsed.data, { admin });
      navigate(user.mustChangePassword ? '/account/password' : afterAuthPath(user.role, from), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <FormError message={error} />
      <div>
        <label className="field-label" htmlFor="l-email">
          Email
        </label>
        <input id="l-email" type="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
        {errors.email && <p className="field-error">{errors.email}</p>}
      </div>
      <div className="mt-4">
        <label className="field-label" htmlFor="l-pass">
          Password
        </label>
        <div className="relative">
          <input
            id="l-pass"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            className="field !pr-20"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-4 -translate-y-1/2 text-[13px] font-semibold text-muted hover:text-text">
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
        {errors.password && <p className="field-error">{errors.password}</p>}
      </div>
      <button type="submit" className="btn btn-gold mt-7 !h-[56px] w-full" disabled={busy}>
        {busy ? 'Logging in…' : 'Log in'}
        {!busy && <Icon name="arrowRight" size={16} strokeWidth={2.4} />}
      </button>

      {import.meta.env.DEV && !admin && (
        <div className="mt-8 rounded-2xl border border-dashed border-line-2 p-4">
          <div className="mb-3 text-xs font-bold tracking-[.14em] text-faint">DEV · DEMO ACCOUNTS (password DiveDemo2026)</div>
          <div className="flex flex-wrap gap-2">
            {DEMO.map(([label, mail]) => (
              <button
                key={mail}
                type="button"
                className="chip !h-9 !px-3.5 !text-[13px]"
                onClick={() => {
                  setEmail(mail);
                  setPassword('DiveDemo2026');
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

export default function Login() {
  useDocumentTitle('Log in');
  return (
    <AuthShell
      title={
        <>
          Welcome
          <br />
          back.
        </>
      }
    >
      <LoginForm />
      <p className="mt-8 text-sm text-muted">
        New to DIVE-IN?{' '}
        <Link to="/register" className="font-semibold text-gold no-underline hover:text-gold-hi">
          Create a free account
        </Link>
      </p>
      <p className="mt-2 text-[13px] text-faint">Gym owners, reception staff and trainers all log in here.</p>
    </AuthShell>
  );
}
