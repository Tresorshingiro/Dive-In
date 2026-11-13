import { motion, useReducedMotion } from 'framer-motion';
import { useState, type FormEvent } from 'react';
import { WordStagger, WORD_STAGGER } from '../motion/WordStagger';
import { RotatingWord } from '../motion/RotatingWord';
import { EASE_DIVE } from '../motion/Reveal';
import { Icon } from '../ui/Icon';
import { Photo } from '../ui/Photo';
import { CardFront } from '../MembershipCard';

type Tab = 'gyms' | 'trainers';

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, ease: EASE_DIVE, delay },
});

export function Hero({
  onSearch,
  onNearMe,
  locating,
  locateError,
}: {
  onSearch: (tab: Tab, q: string) => void;
  onNearMe: (q: string) => void;
  locating: boolean;
  locateError: string | null;
}) {
  const [tab, setTab] = useState<Tab>('gyms');
  const [q, setQ] = useState('');
  const reduce = useReducedMotion();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(tab, q.trim());
  };

  // headline words: Find, your, [word], Dive-In, in.  → paragraph etc. follow the 130ms rhythm
  const after = (n: number) => 0.05 + n * WORD_STAGGER;

  return (
    <section id="top" className="relative pt-12 pb-20 lg:pt-[72px] lg:pb-24">
      <div className="wrap grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
        <div>
          <motion.div className="eyebrow mb-7 flex items-center gap-2.5" {...fadeUp(0)}>
            <span className="h-0.5 w-7 bg-gold" />
            Kigali, Rwanda · Gyms · Coaches · Memberships
          </motion.div>

          <h1 className="disp m-0 text-[54px] sm:text-[72px] lg:text-[112px]">
            <WordStagger
              delay={0.1}
              lines={[
                'Find your',
                { node: <RotatingWord words={['gym.', 'coach.', 'rhythm.']} /> },
                { text: 'Dive in.', className: 'text-dim' },
              ]}
            />
          </h1>

          <motion.p className="mt-7 mb-9 max-w-[520px] text-[17px] leading-[1.6] text-soft sm:text-[19px]" {...fadeUp(after(5))}>
            Discover gyms near you, compare packages, book a trainer and walk in with a digital membership card — all in one place.
          </motion.p>

          <motion.form onSubmit={submit} className="max-w-[580px] rounded-3xl border border-line-2 bg-field p-2.5" {...fadeUp(after(6))} role="search">
            <div className="flex gap-1 px-0.5 pt-0.5 pb-2.5" role="tablist" aria-label="Search for">
              {(['gyms', 'trainers'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} className="tab" onClick={() => setTab(t)}>
                  {t === 'gyms' ? 'Gyms' : 'Trainers'}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2.5">
              <label className="flex h-14 min-w-0 flex-[1_1_260px] items-center gap-2.5 rounded-2xl border border-line bg-ink px-[18px]">
                <Icon name="search" size={20} strokeWidth={2} className="shrink-0 text-dim" />
                <span className="sr-only">Search</span>
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={tab === 'gyms' ? 'Neighbourhood or gym name' : 'Coach name or specialty'}
                  className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium text-text outline-none placeholder:text-[#6b675f]"
                />
              </label>
              {tab === 'trainers' ? (
                <button type="submit" className="btn btn-gold !h-14 !rounded-2xl max-sm:flex-1">
                  <Icon name="search" />
                  Search
                </button>
              ) : (
                <button type="button" onClick={() => onNearMe(q.trim())} disabled={locating} className="btn btn-gold !h-14 !rounded-2xl max-sm:flex-1">
                  <Icon name="pin" />
                  {locating ? 'Locating…' : 'Near me'}
                </button>
              )}
            </div>
            {locateError && <p className="px-2 pt-2.5 text-[13px] text-warning">{locateError} — showing all of Kigali instead.</p>}
          </motion.form>

          <motion.div className="mt-7 flex flex-wrap items-center gap-[22px] text-[13px] text-dim" {...fadeUp(after(8))}>
            {['Free to join', 'Pay with Mobile Money or card', 'Verified partner gyms'].map((t) => (
              <span key={t} className="flex items-center gap-2">
                <Icon name="check" size={16} className="text-gold" />
                {t}
              </span>
            ))}
          </motion.div>
        </div>

        {/* hero art */}
        <div className="relative h-[460px] sm:h-[520px] lg:h-[640px]">
          <motion.div className="absolute top-0 right-0 h-[88%] w-[86%] lg:w-[82%]" {...fadeUp(after(2))}>
            <Photo src="/images/hero.webp" alt="Athlete doing a pull-up in a dark gym" caption="Photo 01 · Hero — athlete mid-lift" eager className="h-full w-full rounded-[32px]">
              <div className="pointer-events-none absolute inset-0 rounded-[32px] bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </Photo>
          </motion.div>

          {/* rotating badge */}
          <motion.div className="absolute top-[6%] left-[4%] hidden h-[132px] w-[132px] sm:block" {...fadeUp(after(5))}>
            <motion.svg
              width="132"
              height="132"
              viewBox="0 0 132 132"
              aria-hidden="true"
              animate={reduce ? undefined : { rotate: 360 }}
              transition={{ duration: 18, ease: 'linear', repeat: Infinity }}
            >
              <defs>
                <path id="badgeCircle" d="M66 66m-50 0a50 50 0 1 1 100 0a50 50 0 1 1-100 0" />
              </defs>
              <circle cx="66" cy="66" r="64" fill="#0E0E0E" stroke="#2A2A2A" />
              <text style={{ font: '700 11.5px Inter,sans-serif', letterSpacing: '3.2px', fill: 'var(--color-gold)' }}>
                <textPath href="#badgeCircle">DISCOVER • BOOK • PAY • TRAIN •</textPath>
              </text>
            </motion.svg>
            <div className="absolute inset-0 grid place-items-center text-text">
              <Icon name="arrowUpRight" size={30} strokeWidth={2} />
            </div>
          </motion.div>

          {/* floating membership card */}
          <motion.div className="absolute bottom-[4%] left-0 w-[300px] sm:w-[340px]" {...fadeUp(after(4))}>
            <motion.div
              className="h-[190px] sm:h-[210px]"
              initial={{ rotate: -7 }}
              animate={reduce ? { rotate: -7 } : { y: [0, -16, 0], rotate: [-7, -5, -7] }}
              transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity }}
            >
              <CardFront size="sm" data={{ memberName: 'Samuel Habineza', gymName: 'Iron House', plan: 'Monthly', expires: '', number: 'DV-0000-0001', status: 'ACTIVE' }} />
            </motion.div>
          </motion.div>

          {/* toast */}
          <motion.div
            className="absolute right-[4%] bottom-0 flex items-center gap-3 rounded-[18px] bg-text px-[18px] py-3.5 text-[#111] shadow-[0_24px_50px_-20px_rgba(0,0,0,.8)]"
            initial={{ opacity: 0, y: 14, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 14, delay: 1.5, opacity: { duration: 0.35, ease: 'easeOut', delay: 1.5 } }}
            role="presentation"
          >
            <span className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-gold text-gold-ink">
              <Icon name="calendarCheck" strokeWidth={2.4} />
            </span>
            <span>
              <span className="block text-[13px] font-bold">Session confirmed</span>
              <span className="block text-xs text-[#555]">Coach Eric · Strength · Sat 8:00</span>
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
