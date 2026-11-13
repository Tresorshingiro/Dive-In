import { Fragment } from 'react';
import { Marquee } from '../motion/Marquee';

const AREAS = ['Kacyiru', 'Kimihurura', 'Remera', 'Nyarutarama', 'Kicukiro', 'Gisozi'];

export function NeighbourhoodMarquee() {
  return (
    <section aria-label="Neighbourhoods" className="overflow-hidden border-y border-line-soft py-[26px]">
      <Marquee duration={28}>
        {[...AREAS, ...AREAS].map((a, i) => (
          <Fragment key={i}>
            <span className="disp outline-text whitespace-nowrap px-7 text-[44px] sm:text-[64px]">{a}</span>
            <span className="disp text-[44px] text-gold sm:text-[64px]" aria-hidden>
              •
            </span>
          </Fragment>
        ))}
      </Marquee>
    </section>
  );
}
