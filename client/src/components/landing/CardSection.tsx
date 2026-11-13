import { useState } from 'react';
import { Reveal } from '../motion/Reveal';
import { StatusPill } from '../ui/StatusPill';
import { CardFront, CardReceptionView, type CardData } from '../MembershipCard';

const POINTS = [
  { n: '1', t: 'Pay securely', d: 'Mobile Money or card through a trusted payment provider.' },
  { n: '2', t: 'Activated only when verified', d: 'Your card goes live after the provider confirms payment — no fake references.' },
  { n: '3', t: 'Checked live at reception', d: 'Staff look up your live record by name or membership number, so a screenshot is never enough.' },
];

function sampleExpiry() {
  const d = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function CardSection() {
  const [flipped, setFlipped] = useState(false);
  const data: CardData = { memberName: 'Samuel Habineza', gymName: 'Iron House', plan: 'Monthly', expires: sampleExpiry(), number: 'DV-0000-0001', status: 'ACTIVE' };

  return (
    <section id="card" className="border-y border-line-soft bg-section py-20 sm:py-32">
      <div className="wrap grid grid-cols-1 items-center gap-16 lg:grid-cols-2 lg:gap-[72px]">
        <Reveal className="w-full max-w-[500px] justify-self-center">
          <button
            type="button"
            className="flipwrap block w-full cursor-pointer border-0 bg-transparent p-0 text-left text-text"
            data-flipped={flipped}
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? 'Show the card front' : 'Show what reception sees'}
          >
            <div className="flip h-[280px] sm:h-[312px]">
              <div className="face">
                <CardFront data={data} />
              </div>
              <div className="face face-back">
                <CardReceptionView data={data} />
              </div>
            </div>
          </button>
          <div className="mt-[18px] text-center text-xs tracking-[.06em] text-faint">
            <span className="hidden [@media(hover:hover)]:inline">HOVER TO SEE WHAT RECEPTION SEES</span>
            <span className="[@media(hover:hover)]:hidden">TAP TO SEE WHAT RECEPTION SEES</span>
          </div>
        </Reveal>

        <div>
          <Reveal className="eyebrow mb-[18px]">Digital membership card</Reveal>
          <Reveal as="h2" className="disp m-0 mb-7 text-[42px] sm:text-[52px] lg:text-[76px]">
            Your card lives
            <br />
            in your pocket.
          </Reveal>
          <div className="flex flex-col gap-[22px]">
            {POINTS.map((p, i) => (
              <Reveal key={p.n} delay={i * 0.1} className="flex gap-[18px]">
                <span className="disp grid h-11 w-11 flex-none place-items-center rounded-[14px] border border-line-3 text-gold">{p.n}</span>
                <div>
                  <div className="text-[17px] font-bold">{p.t}</div>
                  <div className="mt-1 text-[15px] leading-relaxed text-muted">{p.d}</div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.25} className="mt-8 flex flex-wrap gap-2.5">
            <StatusPill status="ACTIVE" />
            <StatusPill status="AWAITING_PAYMENT" />
            <StatusPill status="EXPIRED" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
