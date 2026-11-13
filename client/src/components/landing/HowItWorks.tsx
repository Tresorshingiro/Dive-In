import { motion } from 'framer-motion';
import { Reveal } from '../motion/Reveal';
import { SectionHeading } from './SectionHeading';

const STEPS = [
  { n: '01', t: 'Discover', d: 'Search gyms by neighbourhood and explore them on a map.' },
  { n: '02', t: 'Compare', d: 'Open a gym profile — facilities, trainers, packages and prices.' },
  { n: '03', t: 'Pay', d: 'Choose a package and pay with Mobile Money or card.' },
  { n: '04', t: 'Train', d: 'Your card activates once payment is verified. Show it at reception.' },
];

export function HowItWorks() {
  return (
    <section className="py-20 sm:py-32">
      <div className="wrap">
        <SectionHeading
          className="mb-16"
          eyebrow="How it works"
          title={
            <>
              From search
              <br />
              to front desk.
            </>
          }
          lead="No more calling five gyms to ask about prices. Compare everything in one place, pay securely, and show your card at reception."
        />
        <div className="relative">
          {/* dashed connector that draws in from the left */}
          <motion.div
            aria-hidden
            className="absolute top-[34px] right-10 left-10 hidden h-0.5 origin-left lg:block"
            style={{ backgroundImage: 'repeating-linear-gradient(90deg,var(--color-gold) 0 6px,transparent 6px 14px)' }}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 2.6, ease: 'easeInOut', delay: 0.4 }}
          />
          <ol className="relative m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.n} delay={Math.min(i, 2) * 0.1} lift className="card hover-gold p-7">
                <div className="mb-7 grid h-[68px] w-[68px] place-items-center rounded-[20px] border border-line-3 bg-ink">
                  <span className="disp text-[30px] text-gold">{s.n}</span>
                </div>
                <h3 className="disp m-0 mb-3 text-[32px]">{s.t}</h3>
                <p className="m-0 text-[15px] leading-relaxed text-muted">{s.d}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
