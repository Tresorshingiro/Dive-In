import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router';
import type { PublicConfig } from '@dive/shared';
import { Reveal, EASE_DIVE } from '../motion/Reveal';
import { Icon } from '../ui/Icon';
import { Photo } from '../ui/Photo';

const INCLUDES = ['Verified gym profile', 'Packages & pricing', 'Member records', 'Reception check-in', 'Trainer profiles', 'Payments & reports'];
const PER: Record<number, string> = { 1: 'month', 3: '3 months', 6: '6 months', 12: 'year' };

export function PartnerPricing({ config }: { config: PublicConfig }) {
  const [planId, setPlanId] = useState(config.gymPlans[0]?.id ?? 'MONTHLY');
  const plan = config.gymPlans.find((p) => p.id === planId) ?? config.gymPlans[0];
  const trialLabel = config.trialDays === 30 ? '1 MONTH FREE TRIAL' : `${config.trialDays}-DAY FREE TRIAL`;

  return (
    <section id="partners" className="border-t border-line-soft bg-section py-20 sm:py-32">
      <div className="wrap grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
        <div>
          <Reveal className="eyebrow mb-[18px]">For gym owners</Reveal>
          <Reveal as="h2" className="disp m-0 mb-6 text-[42px] sm:text-[52px] lg:text-[76px]">
            Put your gym
            <br />
            on the map.
          </Reveal>
          <Reveal as="p" delay={0.1} className="lead m-0 mb-8 max-w-[480px]">
            A digital profile, packages, members, trainers and a reception check-in desk — you stay in control of your gym, DIVE-IN gives you the tools.
          </Reveal>
          <Reveal delay={0.2}>
            <Photo src="/images/gym-owner.webp" alt="Gym owner on the gym floor" caption="Photo 06 · Gym owner at front desk" className="h-[260px] rounded-3xl" />
          </Reveal>
        </div>

        <Reveal delay={0.1} className="rounded-[30px] border border-line-2 bg-ink p-6 sm:p-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] font-bold tracking-[.14em] text-muted">PARTNER PLAN</span>
            <span className="inline-flex h-[30px] items-center rounded-full bg-gold px-3 text-xs font-bold text-gold-ink">{trialLabel}</span>
          </div>

          <div className="mt-[26px] mb-[30px] grid grid-cols-2 gap-1.5 rounded-[26px] border border-line bg-field p-1.5 sm:flex sm:rounded-full" role="group" aria-label="Billing period">
            {config.gymPlans.map((p) => (
              <button key={p.id} type="button" className="tab flex-[1_1_auto] !px-3.5" aria-pressed={p.id === planId} onClick={() => setPlanId(p.id)}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-baseline gap-3" aria-live="polite">
            <span className="relative inline-block overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={plan.id}
                  className="disp inline-block text-[56px] sm:text-[72px] lg:text-[88px]"
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.5, ease: EASE_DIVE }}
                >
                  RWF {plan.priceRwf.toLocaleString('en-US')}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="text-base text-muted">/ {PER[plan.months] ?? `${plan.months} months`}</span>
          </div>
          <div className="mt-1.5 text-xs text-faint">Proposed pricing — to be confirmed with pilot gyms.</div>

          <ul className="m-0 mt-7 mb-8 grid list-none grid-cols-1 gap-3.5 border-t border-line p-0 pt-7 text-[15px] text-chalk sm:grid-cols-2">
            {INCLUDES.map((inc) => (
              <li key={inc} className="flex items-start gap-2.5">
                <Icon name="check" className="mt-0.5 flex-none text-gold" strokeWidth={2.4} />
                {inc}
              </li>
            ))}
          </ul>
          <Link className="btn btn-gold !h-[58px] w-full" to="/register?role=GYM_OWNER">
            List your gym
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
