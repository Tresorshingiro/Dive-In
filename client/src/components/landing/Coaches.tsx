import { Link } from 'react-router';
import type { PublicConfig, TrainerSummary } from '@dive/shared';
import { Reveal } from '../motion/Reveal';
import { Icon } from '../ui/Icon';
import { Photo } from '../ui/Photo';
import { SectionHeading } from './SectionHeading';

export function Coaches({ trainers, config, query, clearQuery }: { trainers: TrainerSummary[]; config: PublicConfig; query: string; clearQuery: () => void }) {
  const q = query.toLowerCase();
  const list = (q ? trainers.filter((t) => [t.fullName, t.headline ?? '', ...t.specialties].some((s) => s.toLowerCase().includes(q))) : trainers).slice(0, 4);

  return (
    <section id="coaches" className="py-20 sm:py-32">
      <div className="wrap">
        <SectionHeading
          className="mb-14"
          eyebrow="Coaches"
          title={
            <>
              Train with
              <br />
              someone who knows.
            </>
          }
          lead="Browse coach profiles for free. Unlock full profiles, availability, messaging and booking with a Coach Access Pass."
        />

        {query && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm">
            <span className="text-chalk">
              Coaches matching <strong className="text-text">“{query}”</strong> · {list.length} found
            </span>
            <button type="button" onClick={clearQuery} className="text-gold hover:text-gold-hi">
              Clear
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((c, i) => (
            <Reveal as="article" key={c.id} delay={Math.min(i, 2) * 0.1} lift className="card hover-gold overflow-hidden">
              <Photo src={c.photoUrl} alt={`Coach ${c.fullName}`} caption="Photo · coach" className="h-[260px] !rounded-none !border-0">
                <span className="absolute top-3.5 left-3.5 rounded-full bg-[rgba(14,14,14,.8)] px-3 py-1.5 text-[11px] font-bold tracking-[.1em] text-gold uppercase">
                  {c.specialties[0] ?? 'Coach'}
                </span>
              </Photo>
              <div className="p-5">
                <div className="text-lg font-bold">{c.fullName}</div>
                <div className="mt-1 text-[13px] text-muted">{c.gyms[0] ? `${c.gyms[0].name} · ${c.gyms[0].neighbourhood}` : (c.headline ?? 'Independent coach')}</div>
                <div className="mt-[18px] flex items-center justify-between border-t border-line pt-4">
                  {/* decorative only — real availability is never sent without a pass */}
                  <span className="locked-blur text-[13px] text-chalk" aria-hidden>
                    Mon · Wed · Fri 6–8am
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-gold">
                    <Icon name="lock" size={14} />
                    Locked
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
          {list.length === 0 && <p className="col-span-full text-muted">No coaches match that search yet.</p>}
        </div>

        <Reveal className="mt-7 flex flex-wrap items-center justify-between gap-7 rounded-[28px] border border-gold-line bg-gold-deep px-6 py-7 sm:px-9 sm:py-8">
          <div className="flex items-center gap-[22px]">
            <span className="grid h-[60px] w-[60px] flex-none place-items-center rounded-[18px] bg-gold text-gold-ink">
              <Icon name="user" size={26} />
            </span>
            <div>
              <div className="disp text-[30px] sm:text-[34px]">Coach Access Pass</div>
              <div className="mt-1.5 text-[15px] text-soft">
                Full coach profiles, availability, messaging and booking for {config.coachPass.days} days. Session fees are paid separately to book.
              </div>
              <div className="mt-1 text-[13px] text-faint">Optional and only for coaches — gym membership prices are set by each gym.</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-[22px]">
            <div>
              <span className="disp text-[40px] text-gold sm:text-[44px]">RWF {config.coachPass.priceRwf.toLocaleString('en-US')}</span>
              <span className="text-sm text-muted"> / {config.coachPass.days} days</span>
            </div>
            <Link className="btn btn-gold" to="/coaches">
              Browse coaches
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
