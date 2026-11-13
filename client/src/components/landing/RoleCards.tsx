import { Link } from 'react-router';
import { Reveal } from '../motion/Reveal';
import { Icon } from '../ui/Icon';
import { SectionHeading } from './SectionHeading';

const ROLES = [
  { tag: 'MEMBERS', t: 'Members', items: ['Find and compare gyms', 'Book coach sessions', 'Digital membership card'], cta: 'Join free', to: '/register?role=MEMBER' },
  { tag: 'GYM OWNERS & RECEPTION', t: 'Gyms', items: ['Profile, packages and members', 'Staff and reception check-in', 'Payments and reports'], cta: 'Open gym portal', to: '/login' },
  { tag: 'TRAINERS', t: 'Coaches', items: ['Profile and specialties', 'Set availability', 'Manage booked sessions'], cta: 'Open trainer portal', to: '/login' },
];

export function RoleCards() {
  return (
    <section className="py-20 sm:py-32">
      <div className="wrap">
        <SectionHeading
          center
          eyebrow="One platform"
          title={
            <>
              Built for everyone
              <br />
              on the gym floor.
            </>
          }
        />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {ROLES.map((r, i) => (
            <Reveal key={r.t} delay={i * 0.1} lift className="h-full">
              <Link
                to={r.to}
                className="card hover-gold flex h-full min-h-[300px] flex-col gap-[22px] !rounded-[26px] p-8 text-text no-underline lg:min-h-[340px]"
              >
                <span className="text-xs font-bold tracking-[.16em] text-gold">{r.tag}</span>
                <h3 className="disp m-0 text-[44px]">{r.t}</h3>
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[15px] text-soft">
                  {r.items.map((it) => (
                    <li key={it} className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 flex-none rounded-full bg-gold" />
                      {it}
                    </li>
                  ))}
                </ul>
                <span className="mt-auto flex items-center gap-2 text-[15px] font-semibold">
                  {r.cta}
                  <Icon name="arrowRight" size={16} strokeWidth={2.4} />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
