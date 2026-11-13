import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Marquee } from '../motion/Marquee';
import { Reveal } from '../motion/Reveal';

const WORDS = ['Discover', 'Book', 'Pay', 'Train'];

export function FinalCta({
  title = (
    <>
      Ready to
      <br />
      <span className="text-gold">dive in?</span>
    </>
  ),
  text = 'Create a free account and find a gym in Kigali today.',
  primary = { to: '/register', label: 'Create free account' },
  secondary = { to: '/#gyms', label: 'Browse gyms' },
}: {
  title?: ReactNode;
  text?: string;
  primary?: { to: string; label: string };
  secondary?: { to: string; label: string };
}) {
  return (
    <section className="relative overflow-hidden py-24 sm:py-[140px]">
      <div className="pointer-events-none absolute top-1/2 left-0 w-full -translate-y-1/2 overflow-hidden" aria-hidden>
        <Marquee reverse duration={36}>
          {[...WORDS, ...WORDS].map((w, i) => (
            <span key={i} className="disp whitespace-nowrap px-10 text-[140px] text-[#161616] sm:text-[220px]">
              {w}
            </span>
          ))}
        </Marquee>
      </div>
      <Reveal className="wrap relative text-center">
        <h2 className="disp m-0 text-[clamp(64px,12vw,168px)]">{title}</h2>
        <p className="mx-auto mt-[26px] mb-10 max-w-[520px] text-[19px] leading-[1.6] text-soft">{text}</p>
        <div className="flex flex-wrap justify-center gap-3.5">
          <Link className="btn btn-gold !h-[58px] !px-8" to={primary.to}>
            {primary.label}
          </Link>
          <Link className="btn btn-ghost !h-[58px] !px-8" to={secondary.to}>
            {secondary.label}
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
