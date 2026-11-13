import type { ReactNode } from 'react';
import { Reveal } from '../motion/Reveal';

/** Eyebrow + big condensed headline (+ optional lead paragraph on the right). */
export function SectionHeading({ eyebrow, title, lead, center = false, className = '' }: { eyebrow: string; title: ReactNode; lead?: ReactNode; center?: boolean; className?: string }) {
  if (center)
    return (
      <Reveal className={`mb-14 text-center ${className}`}>
        <div className="eyebrow mb-[18px]">{eyebrow}</div>
        <h2 className="disp m-0 text-[42px] sm:text-[52px] lg:text-[76px]">{title}</h2>
      </Reveal>
    );
  return (
    <div className={`grid grid-cols-1 items-end gap-6 lg:grid-cols-2 lg:gap-12 ${className}`}>
      <Reveal>
        <div className="eyebrow mb-[18px]">{eyebrow}</div>
        <h2 className="disp m-0 text-[42px] sm:text-[52px] lg:text-[76px]">{title}</h2>
      </Reveal>
      {lead && (
        <Reveal as="p" delay={0.1} className="lead m-0 max-w-[460px]">
          {lead}
        </Reveal>
      )}
    </div>
  );
}
