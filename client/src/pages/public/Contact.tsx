import { AnimatePresence, motion } from 'framer-motion';
import { useState, type FormEvent } from 'react';
import { CONTACT_ROLES, NEIGHBOURHOODS, contactSchema, fieldErrors, type ContactRole } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { WordStagger, WORD_STAGGER } from '../../components/motion/WordStagger';
import { Reveal, EASE_DIVE } from '../../components/motion/Reveal';
import { Icon, type IconName } from '../../components/ui/Icon';
import { GymMap } from '../../components/map/GymMap';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const EMAIL = import.meta.env.VITE_CONTACT_EMAIL ?? 'hello@dive.rw';
const PHONE = import.meta.env.VITE_CONTACT_PHONE ?? '+250 788 000 000';
const WHATSAPP = import.meta.env.VITE_CONTACT_WHATSAPP ?? '250788000000';

const CARDS: Array<{ icon: IconName; label: string; value: string; href?: string; note: string }> = [
  { icon: 'mail', label: 'Email', value: EMAIL, href: `mailto:${EMAIL}`, note: 'We reply within one working day.' },
  { icon: 'whatsapp', label: 'Phone / WhatsApp', value: PHONE, href: `https://wa.me/${WHATSAPP}`, note: 'Message us any time on WhatsApp.' },
  { icon: 'pin', label: 'Location', value: 'Kacyiru, Kigali', note: 'Visits by appointment.' },
  { icon: 'clock', label: 'Hours', value: 'Mon–Fri 8:00–18:00', note: 'Saturday 9:00–13:00 · Kigali time' },
];

const ROLE_LABEL: Record<ContactRole, string> = { MEMBER: 'Member', GYM_OWNER: 'Gym owner', TRAINER: 'Trainer', OTHER: 'Other' };

const FAQ = [
  { q: 'Is DIVE-IN free to use?', a: 'Yes. Creating an account and browsing gyms is free. You pay only for what you choose: a gym membership, a Coach Access Pass, or a coaching session.' },
  { q: 'How do I pay?', a: 'With Mobile Money or a bank card through a trusted payment provider. Some gyms take payment at the front desk instead; the gym profile tells you which.' },
  { q: 'When does my membership card activate?', a: 'As soon as the payment provider confirms your payment to DIVE-IN. Typing a transaction reference is never enough: the confirmation comes from the provider directly.' },
  { q: 'Why is there no QR code on the card?', a: 'Reception looks up your live record by name or membership number. That way an expired or unpaid membership can’t get through with an old screenshot.' },
  { q: 'What is the Coach Access Pass?', a: 'A 30-day pass that unlocks full coach profiles, availability, messaging and booking. The coaching session itself is a separate payment to book.' },
  { q: 'How do I list my gym?', a: 'Register as a gym owner. We review the application, and once it is approved your one-month free trial starts. Pricing after the trial is still being confirmed with pilot gyms.' },
  { q: 'How do you handle my data?', a: 'Your data is used only to run your account, memberships and bookings. Each role sees only what it needs: reception sees membership status, not your payment details. Full terms and privacy policy will be published before the public launch.' },
];

type Form = { name: string; email: string; phone: string; role: ContactRole; gymName: string; neighbourhood: string; message: string; website: string };
const EMPTY: Form = { name: '', email: '', phone: '', role: 'MEMBER', gymName: '', neighbourhood: '', message: '', website: '' };

export default function Contact() {
  useDocumentTitle('Contact');
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [serverError, setServerError] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      phone: form.phone || undefined,
      gymName: form.role === 'GYM_OWNER' ? form.gymName : undefined,
      neighbourhood: form.role === 'GYM_OWNER' && form.neighbourhood ? form.neighbourhood : undefined,
      website: form.website || undefined,
    };
    const parsed = contactSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setStatus('sending');
    setServerError('');
    try {
      await api('/contact', { method: 'POST', body: payload });
      setStatus('sent');
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      setServerError(err instanceof ApiError ? err.message : 'Could not send your message. Please try again.');
      setStatus('error');
    }
  };

  const err = (k: keyof Form) => (errors[k] ? <p className="field-error">{errors[k]}</p> : null);

  return (
    <>
      <section className="pt-12 pb-16 lg:pt-[72px] lg:pb-20">
        <div className="wrap">
          <motion.div className="eyebrow mb-7 flex items-center gap-2.5" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE_DIVE }}>
            <span className="h-0.5 w-7 bg-gold" />
            Contact
          </motion.div>
          <div className="grid grid-cols-1 items-end gap-8 lg:grid-cols-2">
            <h1 className="disp m-0 text-[64px] sm:text-[88px] lg:text-[128px]">
              <WordStagger delay={0.1} lines={["Let's", { text: 'talk.', className: 'text-gold' }]} />
            </h1>
            <motion.p
              className="lead m-0 max-w-[480px]"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE_DIVE, delay: 0.1 + 3 * WORD_STAGGER }}
            >
              Questions about memberships, listing your gym or coaching on DIVE-IN? Send us a message and the team in Kigali will get back to you.
            </motion.p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CARDS.map((c, i) => {
              const inner = (
                <>
                  <span className="mb-6 grid h-12 w-12 place-items-center rounded-[14px] border border-line-3 bg-ink text-gold">
                    <Icon name={c.icon} size={20} />
                  </span>
                  <div className="text-xs font-bold tracking-[.14em] text-faint uppercase">{c.label}</div>
                  <div className="mt-2 text-[17px] font-bold break-words text-text">{c.value}</div>
                  <div className="mt-1.5 text-[13px] text-muted">{c.note}</div>
                </>
              );
              return (
                <Reveal key={c.label} delay={Math.min(i, 3) * 0.08} lift className="h-full">
                  {c.href ? (
                    <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="card hover-gold block h-full p-6 no-underline">
                      {inner}
                    </a>
                  ) : (
                    <div className="card hover-gold h-full p-6">{inner}</div>
                  )}
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* form */}
      <section className="border-t border-line-soft bg-section py-20 sm:py-28">
        <div className="wrap grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <Reveal>
            <div className="eyebrow mb-[18px]">Send a message</div>
            <h2 className="disp m-0 text-[42px] sm:text-[52px] lg:text-[68px]">
              Tell us
              <br />
              who you are.
            </h2>
            <p className="lead mt-6 max-w-[420px]">Pick what describes you best so your message reaches the right person. Gym owners: add your gym and we’ll walk you through the pilot.</p>
          </Reveal>

          <Reveal delay={0.1} className="rounded-[30px] border border-line-2 bg-ink p-6 sm:p-9">
            <AnimatePresence mode="wait">
              {status === 'sent' ? (
                <motion.div
                  key="sent"
                  className="flex min-h-[420px] flex-col items-center justify-center text-center"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  role="status"
                >
                  <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-gold text-gold-ink">
                    <Icon name="check" size={28} strokeWidth={2.6} />
                  </span>
                  <h3 className="disp mt-6 mb-3 text-[44px]">Message sent</h3>
                  <p className="m-0 max-w-[360px] text-muted">Thanks, {form.name.split(' ')[0]}. We’ll reply to {form.email} within one working day.</p>
                  <button
                    type="button"
                    className="btn btn-ghost mt-8"
                    onClick={() => {
                      setForm(EMPTY);
                      setStatus('idle');
                    }}
                  >
                    Send another
                  </button>
                </motion.div>
              ) : (
                <motion.form key="form" onSubmit={submit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <fieldset className="m-0 border-0 p-0">
                    <legend className="field-label">I am a</legend>
                    <div className="flex flex-wrap gap-2" role="radiogroup">
                      {CONTACT_ROLES.map((r) => (
                        <button key={r} type="button" role="radio" aria-checked={form.role === r} aria-pressed={form.role === r} className="chip" onClick={() => set('role', r)}>
                          {ROLE_LABEL[r]}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <AnimatePresence initial={false}>
                    {form.role === 'GYM_OWNER' && (
                      <motion.div
                        key="gym"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: EASE_DIVE }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2">
                          <div>
                            <label className="field-label" htmlFor="c-gym">
                              Gym name
                            </label>
                            <input id="c-gym" className="field" value={form.gymName} onChange={(e) => set('gymName', e.target.value)} aria-invalid={!!errors.gymName} />
                            {err('gymName')}
                          </div>
                          <div>
                            <label className="field-label" htmlFor="c-area">
                              Neighbourhood
                            </label>
                            <select id="c-area" className="field" value={form.neighbourhood} onChange={(e) => set('neighbourhood', e.target.value)} aria-invalid={!!errors.neighbourhood}>
                              <option value="">Choose…</option>
                              {NEIGHBOURHOODS.map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                            {err('neighbourhood')}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="field-label" htmlFor="c-name">
                        Full name
                      </label>
                      <input id="c-name" className="field" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} />
                      {err('name')}
                    </div>
                    <div>
                      <label className="field-label" htmlFor="c-email">
                        Email
                      </label>
                      <input id="c-email" type="email" className="field" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} aria-invalid={!!errors.email} />
                      {err('email')}
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="field-label" htmlFor="c-phone">
                      Phone <span className="font-normal text-faint">(optional)</span>
                    </label>
                    <input id="c-phone" type="tel" className="field" autoComplete="tel" placeholder="078 123 4567" value={form.phone} onChange={(e) => set('phone', e.target.value)} aria-invalid={!!errors.phone} />
                    {err('phone')}
                  </div>
                  <div className="mt-4">
                    <label className="field-label" htmlFor="c-msg">
                      Message
                    </label>
                    <textarea id="c-msg" className="field" value={form.message} onChange={(e) => set('message', e.target.value)} aria-invalid={!!errors.message} />
                    {err('message')}
                  </div>
                  {/* honeypot */}
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={(e) => set('website', e.target.value)} aria-hidden />

                  {serverError && (
                    <p className="mt-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
                      {serverError}
                    </p>
                  )}
                  <button type="submit" className="btn btn-gold mt-6 !h-[58px] w-full" disabled={status === 'sending'}>
                    {status === 'sending' ? 'Sending…' : 'Send message'}
                    {status !== 'sending' && <Icon name="arrowRight" size={16} strokeWidth={2.4} />}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </Reveal>
        </div>
      </section>

      {/* map strip */}
      <section aria-label="Map of Kigali" className="relative isolate h-[320px] border-y border-line-soft sm:h-[380px]">
        <GymMap gyms={[{ id: 'hq', slug: '', name: 'DIVE-IN · Kacyiru', neighbourhood: 'Kacyiru', tags: [], lat: -1.9437, lng: 30.0794, coverUrl: null, fromPriceRwf: null, verified: true }]} area="Kacyiru" interactive={false} />
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[500] hidden w-1/3 bg-gradient-to-r from-ink to-transparent sm:block" />
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 sm:py-32">
        <div className="wrap grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <Reveal>
            <div className="eyebrow mb-[18px]">FAQ</div>
            <h2 className="disp m-0 text-[42px] sm:text-[52px] lg:text-[68px]">
              Good
              <br />
              questions.
            </h2>
          </Reveal>
          <div className="flex flex-col gap-3">
            {FAQ.map((f, i) => {
              const open = openFaq === i;
              return (
                <Reveal key={f.q} delay={Math.min(i, 4) * 0.05} className={`rounded-[22px] border bg-surface transition-colors ${open ? 'border-gold-line' : 'border-line'}`}>
                  <h3 className="m-0">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 bg-transparent px-6 py-5 text-left text-[17px] font-bold text-text"
                      aria-expanded={open}
                      aria-controls={`faq-${i}`}
                      onClick={() => setOpenFaq(open ? null : i)}
                    >
                      {f.q}
                      <motion.span
                        className={`grid h-9 w-9 flex-none place-items-center rounded-full ${open ? 'bg-gold text-gold-ink' : 'bg-field text-text'}`}
                        animate={{ rotate: open ? 45 : 0 }}
                        transition={{ duration: 0.3, ease: EASE_DIVE }}
                      >
                        <Icon name="plus" size={16} strokeWidth={2.4} />
                      </motion.span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        id={`faq-${i}`}
                        key="a"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: EASE_DIVE }}
                        className="overflow-hidden"
                      >
                        <p className="m-0 px-6 pb-6 text-[15px] leading-relaxed text-muted">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
