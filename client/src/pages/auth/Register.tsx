import { AnimatePresence, motion } from 'framer-motion';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { afterAuthPath } from '../../lib/redirect';
import { NEIGHBOURHOODS, SELF_REGISTER_ROLES, fieldErrors, registerSchema, type SelfRegisterRole } from '@dive/shared';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { EASE_DIVE } from '../../components/motion/Reveal';
import { Icon, type IconName } from '../../components/ui/Icon';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { AuthShell, FormError } from './AuthShell';

const ROLE_CARDS: Record<SelfRegisterRole, { icon: IconName; title: string; text: string }> = {
  MEMBER: { icon: 'user', title: 'Member', text: 'Find gyms, buy a membership, book coaches.' },
  GYM_OWNER: { icon: 'dumbbell', title: 'Gym owner', text: 'List your gym, manage members and reception.' },
  TRAINER: { icon: 'calendarCheck', title: 'Trainer', text: 'Show your profile, set availability, get booked.' },
};

const SPECIALTIES = ['Strength', 'HIIT', 'Boxing', 'Yoga', 'Pilates', 'Mobility', 'Powerlifting', 'Swimming', 'Weight loss', 'Nutrition', 'Conditioning', 'Calisthenics'];

export default function Register() {
  useDocumentTitle('Create account');
  const [params] = useSearchParams();
  const initialRole = SELF_REGISTER_ROLES.includes(params.get('role') as SelfRegisterRole) ? (params.get('role') as SelfRegisterRole) : 'MEMBER';
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [role, setRole] = useState<SelfRegisterRole>(initialRole);
  const [f, setF] = useState({ fullName: '', email: '', phone: '', password: '', gymName: '', neighbourhood: '' });
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof f, v: string) => {
    setF((s) => ({ ...s, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = {
      role,
      fullName: f.fullName,
      email: f.email,
      phone: f.phone,
      password: f.password,
      ...(role === 'GYM_OWNER' ? { gymName: f.gymName, neighbourhood: f.neighbourhood || undefined } : {}),
      ...(role === 'TRAINER' ? { specialties } : {}),
    };
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setError('');
    setBusy(true);
    try {
      const user = await register(parsed.data);
      navigate(afterAuthPath(user.role, (location.state as { from?: string } | null)?.from), { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      setError(err instanceof ApiError ? err.message : 'Could not create your account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="field-label" htmlFor={`r-${k}`}>
        {label}
      </label>
      <input id={`r-${k}`} className="field" value={f[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={!!errors[k]} {...props} />
      {errors[k] && <p className="field-error">{errors[k]}</p>}
    </div>
  );

  return (
    <AuthShell
      side="Free to join. Dive in."
      image="/images/gym-2.webp"
      title={
        <>
          Create your
          <br />
          <span className="text-gold">account.</span>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <fieldset className="m-0 mb-7 border-0 p-0">
          <legend className="field-label">I’m joining as</legend>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3" role="radiogroup">
            {SELF_REGISTER_ROLES.map((r) => {
              const c = ROLE_CARDS[r];
              const on = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setRole(r)}
                  className={`flex items-start gap-3 rounded-[20px] border p-4 text-left transition-all sm:flex-col ${
                    on ? 'border-gold bg-gold-deep' : 'border-line bg-surface hover:border-[#5a5a5a]'
                  }`}
                >
                  <span className={`grid h-10 w-10 flex-none place-items-center rounded-xl ${on ? 'bg-gold text-gold-ink' : 'bg-field text-gold'}`}>
                    <Icon name={c.icon} size={18} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-bold text-text">{c.title}</span>
                    <span className="mt-1 block text-[12.5px] leading-snug text-muted">{c.text}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <FormError message={error} />

        <div className="grid grid-cols-1 gap-4">
          {field('fullName', 'Full name', { autoComplete: 'name' })}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
            {field('phone', 'Phone (MoMo number)', { type: 'tel', autoComplete: 'tel', placeholder: '078 123 4567' })}
          </div>
          {field('password', 'Password', { type: 'password', autoComplete: 'new-password', placeholder: '8+ characters, letters and a number' })}
        </div>

        <AnimatePresence initial={false} mode="wait">
          {role === 'GYM_OWNER' && (
            <motion.div key="gym" className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE_DIVE }}>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {field('gymName', 'Gym name')}
                <div>
                  <label className="field-label" htmlFor="r-area">
                    Neighbourhood
                  </label>
                  <select id="r-area" className="field" value={f.neighbourhood} onChange={(e) => set('neighbourhood', e.target.value)} aria-invalid={!!errors.neighbourhood}>
                    <option value="">Choose…</option>
                    {NEIGHBOURHOODS.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                  {errors.neighbourhood && <p className="field-error">{errors.neighbourhood}</p>}
                </div>
              </div>
              <p className="mt-3 text-[13px] text-muted">DIVE-IN reviews every gym before it goes live. Your one-month free trial starts on approval.</p>
            </motion.div>
          )}
          {role === 'TRAINER' && (
            <motion.div key="trainer" className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE_DIVE }}>
              <div className="mt-4">
                <span className="field-label">Specialties</span>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="chip !h-9 !px-3.5 !text-[13px]"
                      aria-pressed={specialties.includes(s)}
                      onClick={() => setSpecialties((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : cur.length < 8 ? [...cur, s] : cur))}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[13px] text-muted">DIVE-IN verifies trainer profiles before they appear publicly.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" className="btn btn-gold mt-7 !h-[56px] w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create free account'}
          {!busy && <Icon name="arrowRight" size={16} strokeWidth={2.4} />}
        </button>
        <p className="mt-4 text-[13px] text-faint">Reception accounts are created by gym owners inside the gym portal.</p>
      </form>
      <p className="mt-6 text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-gold no-underline hover:text-gold-hi">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
