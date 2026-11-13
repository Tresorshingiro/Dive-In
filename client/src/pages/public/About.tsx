import { motion } from 'framer-motion';
import { WordStagger, WORD_STAGGER } from '../../components/motion/WordStagger';
import { Reveal, EASE_DIVE } from '../../components/motion/Reveal';
import { Photo } from '../../components/ui/Photo';
import { Icon, type IconName } from '../../components/ui/Icon';
import { SectionHeading } from '../../components/landing/SectionHeading';
import { FinalCta } from '../../components/landing/FinalCta';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const AUDIENCES = [
  {
    tag: 'MEMBERS',
    problem: 'Finding a gym means calling around, visiting in person and guessing at prices. Good coaches are found by word of mouth.',
    solution: 'Search every partner gym on one map, compare packages side by side, book a coach and carry your membership on your phone.',
  },
  {
    tag: 'GYMS',
    problem: 'Members live in notebooks and spreadsheets. Reception can’t tell quickly who has paid, and new customers can’t find you online.',
    solution: 'A verified profile, package management, member records and a reception desk that checks live membership status in seconds.',
  },
  {
    tag: 'COACHES',
    problem: 'Great trainers have no simple way to show their expertise, share availability or get paid for sessions without chasing clients.',
    solution: 'A professional profile, an availability calendar and confirmed, paid bookings — with DIVE-IN handling verification.',
  },
];

const PRINCIPLES: Array<{ icon: IconName; t: string; d: string }> = [
  { icon: 'sparkle', t: 'Simple first', d: 'One clear journey from search to front desk. We add features only when the core works.' },
  { icon: 'shield', t: 'Verified, not assumed', d: 'Payments count only after the provider confirms them. Reception checks the live record, never a screenshot.' },
  { icon: 'dumbbell', t: 'Gyms stay in control', d: 'Owners set their prices, staff and rules. DIVE-IN provides the tools, not the management.' },
  { icon: 'pin', t: 'Built in Kigali', d: 'Mobile Money first, neighbourhood by neighbourhood, tested with local gyms before we scale.' },
];

const ROADMAP = [
  { s: 'Stage 1', t: 'Foundations', d: 'Finalise pricing, partner terms, payment flows and staff permissions.' },
  { s: 'Stage 2', t: 'Core platform', d: 'Authentication, database, gym profiles, packages and booking actions.' },
  { s: 'Stage 3', t: 'Payments', d: 'Integrate and test MoMo and bank-card providers with server-side verification.' },
  { s: 'Stage 4', t: 'Reception & reports', d: 'Reception check-in, owner reporting, security and backup testing.' },
  { s: 'Stage 5', t: 'Private pilot', d: 'Launch with selected Kigali gyms, gather feedback and improve.' },
  { s: 'Stage 6', t: 'Public launch', d: 'Open the public website, then Android and iOS apps.' },
];

// Founder is real; the other three are fictional placeholders — replace before launch.
const TEAM = [
  { name: 'Billy Mugabo', role: 'Founder & CEO', bio: 'Founded DIVE-IN to make gyms and coaches in Kigali easier to find, compare and join, all in one place.' },
  { name: 'Aimée Uwamahoro', role: 'Head of Partnerships', bio: 'Onboards pilot gyms across Kigali and makes sure every owner stays in control of their business.' },
  { name: 'Kevin Ishimwe', role: 'Product & Engineering', bio: 'Leads the platform, payments and security. Believes a payment isn’t real until the provider says so.' },
  { name: 'Diane Mukeshimana', role: 'Community & Coaches', bio: 'Certified strength coach who verifies trainer profiles and runs the DIVE-IN coach community.' },
];

const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

/** The roadmap stage we are in now (0-based). */
const CURRENT_STAGE = 1;

export default function About() {
  useDocumentTitle('About');
  return (
    <>
      {/* hero */}
      <section className="pt-12 pb-20 lg:pt-[72px] lg:pb-28">
        <div className="wrap grid grid-cols-1 items-end gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
          <div>
            <motion.div className="eyebrow mb-7 flex items-center gap-2.5" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE_DIVE }}>
              <span className="h-0.5 w-7 bg-gold" />
              About DIVE-IN
            </motion.div>
            <h1 className="disp m-0 text-[54px] sm:text-[72px] lg:text-[104px]">
              <WordStagger delay={0.1} lines={['Fitness in Kigali,', { text: 'easier to reach', className: 'text-gold' }]} />
            </h1>
            <motion.p
              className="lead mt-8 max-w-[560px] !text-[19px]"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE_DIVE, delay: 0.1 + 6 * WORD_STAGGER }}
            >
              DIVE-IN Fitness Hub connects people looking for gyms and coaches with the gyms and trainers who serve them — one platform to discover, book, pay and
              train, with each role getting the tools it needs.
            </motion.p>
          </div>
          <motion.div className="grid grid-cols-2 gap-4" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE_DIVE, delay: 0.4 }}>
            <Photo src="/images/about-kigali.webp" alt="Member training with dumbbells" caption="Photo · Kigali gym" className="h-[300px] rounded-[28px] sm:h-[380px]" eager />
            <Photo src="/images/about-class.webp" alt="Battle-rope workout" caption="Photo · class" className="mt-12 h-[300px] rounded-[28px] sm:h-[380px]" eager />
          </motion.div>
        </div>
      </section>

      {/* problem / solution */}
      <section className="border-t border-line-soft bg-section py-20 sm:py-32">
        <div className="wrap">
          <SectionHeading
            className="mb-14"
            eyebrow="Why DIVE-IN"
            title={
              <>
                Three groups.
                <br />
                One missing link.
              </>
            }
            lead="Customers, gyms and coaches all want the same thing: less friction between wanting to train and actually training."
          />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {AUDIENCES.map((a, i) => (
              <Reveal key={a.tag} delay={i * 0.1} lift className="card hover-gold flex flex-col !rounded-[26px] p-7 sm:p-8">
                <span className="text-xs font-bold tracking-[.16em] text-gold">FOR {a.tag}</span>
                <div className="mt-6 text-xs font-bold tracking-[.14em] text-faint">THE PROBLEM</div>
                <p className="mt-2 mb-0 text-[15px] leading-relaxed text-muted">{a.problem}</p>
                <div className="mt-6 border-t border-line pt-6 text-xs font-bold tracking-[.14em] text-success">WHAT DIVE-IN DOES</div>
                <p className="mt-2 mb-0 text-[16px] leading-relaxed text-text">{a.solution}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* principles */}
      <section className="py-20 sm:py-32">
        <div className="wrap">
          <SectionHeading center eyebrow="Our principles" title={<>How we build</>} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.t} delay={Math.min(i, 2) * 0.1} lift className="card hover-gold p-7">
                <span className="mb-7 grid h-[60px] w-[60px] place-items-center rounded-[18px] border border-line-3 bg-ink text-gold">
                  <Icon name={p.icon} size={24} />
                </span>
                <h3 className="disp m-0 mb-3 text-[30px]">{p.t}</h3>
                <p className="m-0 text-[15px] leading-relaxed text-muted">{p.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* roadmap */}
      <section className="border-y border-line-soft bg-section py-20 sm:py-32">
        <div className="wrap">
          <SectionHeading
            className="mb-16"
            eyebrow="Roadmap"
            title={
              <>
                From prototype
                <br />
                to pilot.
              </>
            }
            lead="We build in stages, validate with Kigali partners, then expand. No scaling an untested process."
          />
          <div className="relative">
            {/* spine */}
            <motion.span
              aria-hidden
              className="absolute top-2 bottom-2 left-[21px] w-0.5 origin-top bg-line lg:top-[21px] lg:right-0 lg:bottom-auto lg:left-0 lg:h-0.5 lg:w-full lg:origin-left"
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 1.6, ease: 'easeInOut' }}
            />
            <ol className="m-0 grid list-none grid-cols-1 gap-8 p-0 lg:grid-cols-6 lg:gap-5">
              {ROADMAP.map((r, i) => {
                const state = i < CURRENT_STAGE ? 'done' : i === CURRENT_STAGE ? 'now' : 'next';
                return (
                  <Reveal as="li" key={r.s} delay={i * 0.08} className="relative flex gap-5 lg:flex-col lg:gap-6">
                    <span
                      className={`relative z-[1] grid h-11 w-11 flex-none place-items-center rounded-full border text-sm font-bold ${
                        state === 'done' ? 'border-gold bg-gold text-gold-ink' : state === 'now' ? 'border-gold bg-ink text-gold' : 'border-line-3 bg-ink text-muted'
                      }`}
                    >
                      {state === 'done' ? <Icon name="check" size={18} strokeWidth={2.6} /> : i + 1}
                      {state === 'now' && <span className="absolute inset-0 animate-ping rounded-full border border-gold opacity-40" />}
                    </span>
                    <div>
                      <div className={`text-xs font-bold tracking-[.14em] ${state === 'now' ? 'text-gold' : 'text-faint'}`}>
                        {r.s.toUpperCase()}
                        {state === 'now' ? ' · NOW' : ''}
                      </div>
                      <h3 className="disp m-0 mt-2 mb-2 text-[26px]">{r.t}</h3>
                      <p className="m-0 text-sm leading-relaxed text-muted">{r.d}</p>
                    </div>
                  </Reveal>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* team */}
      <section className="py-20 sm:py-32">
        <div className="wrap">
          <SectionHeading
            className="mb-14"
            eyebrow="Team"
            title={
              <>
                The people
                <br />
                behind DIVE-IN.
              </>
            }
            lead="A small Kigali team of fitness people and builders. Want to join the pilot? We’d love to hear from you."
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((m, i) => (
              <Reveal as="article" key={m.name} delay={Math.min(i, 2) * 0.1} lift className="card hover-gold overflow-hidden">
                <div className="relative grid h-[220px] place-items-center overflow-hidden border-b border-line" style={{ background: 'linear-gradient(140deg,#2B2318 0%,#151515 60%,#0B0B0B 100%)' }}>
                  <span className="disp text-[96px] text-gold">{initials(m.name)}</span>
                  <span className="absolute top-3.5 left-3.5 rounded-full bg-[rgba(14,14,14,.8)] px-3 py-1.5 text-[11px] font-bold tracking-[.1em] text-gold uppercase">{m.role}</span>
                </div>
                <div className="p-5">
                  <div className="text-lg font-bold">{m.name}</div>
                  <p className="mt-2 mb-0 text-[13px] leading-relaxed text-muted">{m.bio}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <FinalCta
        title={
          <>
            Let’s build it
            <br />
            <span className="text-gold">together.</span>
          </>
        }
        text="Join as a member, list your gym for the pilot, or get in touch."
        primary={{ to: '/register', label: 'Create free account' }}
        secondary={{ to: '/contact', label: 'Contact us' }}
      />
    </>
  );
}
