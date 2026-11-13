import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { AuthUser } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { AuthShell, FormError } from './AuthShell';

type Step = 'password' | 'setup' | 'verify';

/** Admin sign-in: password → authenticator app (set up on first login) → session. */
export default function AdminLogin() {
  useDocumentTitle('Admin login');
  const { reload } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown, fallback: string) => {
    setError(e instanceof ApiError ? e.message : fallback);
    if (e instanceof ApiError && e.status === 401 && step !== 'password') setStep('password');
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api<{ mfa: 'setup' | 'verify' }>('/auth/admin/login', { method: 'POST', body: { email, password } });
      if (r.mfa === 'setup') {
        setSetup(await api('/auth/admin/mfa/setup', { method: 'POST' }));
        setStep('setup');
      } else setStep('verify');
      setPassword('');
    } catch (e2) {
      fail(e2, 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api<{ user: AuthUser }>('/auth/admin/mfa/verify', { method: 'POST', body: { code: code.replace(/\s/g, '') } });
      await reload();
      navigate(r.user.mustChangePassword ? '/account/password' : '/admin', { replace: true });
    } catch (e2) {
      fail(e2, 'Could not verify the code');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell side="Platform. Partners. Trust." image="/images/gym-3.webp" title={<>DIVE-IN<br /><span className="text-gold">admin.</span></>}>
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-gold-line bg-gold-deep px-4 py-3 text-sm text-chalk">
        <Icon name="shield" className="flex-none text-gold" />
        Restricted area. Two-factor sign-in is required and every sign-in is logged.
      </div>
      <FormError message={error} />

      {step === 'password' && (
        <form onSubmit={submitPassword} noValidate>
          <label className="field-label" htmlFor="a-email">Email</label>
          <input id="a-email" type="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="field-label mt-4" htmlFor="a-pass">Password</label>
          <input id="a-pass" type="password" autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="btn btn-gold mt-7 !h-[56px] w-full" disabled={busy || !email || !password}>{busy ? 'Checking…' : 'Continue'}</button>
        </form>
      )}

      {step === 'setup' && setup && (
        <form onSubmit={submitCode} noValidate>
          <p className="mt-0 text-sm text-chalk">First sign-in: scan this with Google Authenticator, Authy, 1Password or Microsoft Authenticator, then enter the 6-digit code it shows.</p>
          <div className="my-5 flex flex-wrap items-center gap-5">
            <img src={setup.qrDataUrl} alt="QR code for your authenticator app" width={180} height={180} className="rounded-2xl" />
            <div className="min-w-0 text-sm">
              <div className="text-xs font-bold tracking-[.12em] text-faint">CAN’T SCAN? ENTER THIS KEY</div>
              <code className="mt-1 block break-all font-mono text-gold">{setup.secret.match(/.{1,4}/g)?.join(' ')}</code>
            </div>
          </div>
          <CodeField code={code} setCode={setCode} />
          <button type="submit" className="btn btn-gold mt-6 !h-[56px] w-full" disabled={busy || code.replace(/\s/g, '').length !== 6}>{busy ? 'Verifying…' : 'Confirm and sign in'}</button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={submitCode} noValidate>
          <p className="mt-0 text-sm text-chalk">Enter the 6-digit code from your authenticator app.</p>
          <CodeField code={code} setCode={setCode} />
          <button type="submit" className="btn btn-gold mt-6 !h-[56px] w-full" disabled={busy || code.replace(/\s/g, '').length !== 6}>{busy ? 'Verifying…' : 'Sign in'}</button>
          <p className="mt-4 text-[13px] text-faint">Lost your phone? Another DIVE-IN admin can reset your two-factor setup from Users.</p>
        </form>
      )}

      <p className="mt-8 text-sm text-muted">Not an administrator? <Link to="/login" className="font-semibold text-gold no-underline">Go to the regular login</Link></p>
    </AuthShell>
  );
}

function CodeField({ code, setCode }: { code: string; setCode: (v: string) => void }) {
  return (
    <>
      <label className="field-label" htmlFor="a-code">Code</label>
      <input id="a-code" className="field text-center font-mono !text-2xl tracking-[.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))} placeholder="000000" />
    </>
  );
}
