import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { NEIGHBOURHOODS, type GymSummary } from '@dive/shared';
import { distanceKm } from '../../hooks/usePublicData';
import { Reveal, EASE_DIVE } from '../motion/Reveal';
import { Icon } from '../ui/Icon';
import { Photo } from '../ui/Photo';
import { GymMap } from '../map/GymMap';

export function GymsNearYou({
  gyms,
  live,
  area,
  setArea,
  query,
  clearQuery,
  user,
  onLocate,
  locating,
}: {
  gyms: GymSummary[];
  live: boolean;
  area: string;
  setArea: (a: string) => void;
  query: string;
  clearQuery: () => void;
  user: { lat: number; lng: number } | null;
  onLocate: () => void;
  locating: boolean;
}) {
  const areas = useMemo(() => {
    const present = new Set(gyms.map((g) => g.neighbourhood));
    return ['All', ...NEIGHBOURHOODS.filter((n) => present.has(n))];
  }, [gyms]);

  const withDistance = useMemo(
    () =>
      gyms.map((g) => ({ ...g, distanceKm: user ? Math.round(distanceKm(user, g) * 10) / 10 : g.distanceKm })).sort((a, b) => (user ? (a.distanceKm ?? 0) - (b.distanceKm ?? 0) : 0)),
    [gyms, user],
  );

  const shown = useMemo(() => {
    const q = query.toLowerCase();
    let list = withDistance.filter((g) => area === 'All' || g.neighbourhood === area);
    if (q) list = list.filter((g) => [g.name, g.neighbourhood, ...g.tags].some((s) => s.toLowerCase().includes(q)));
    return area === 'All' && !q ? list.slice(0, 4) : list;
  }, [withDistance, area, query]);

  return (
    <section id="gyms" className="border-t border-line-soft bg-section py-20 sm:py-32">
      <div className="wrap">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <div className="eyebrow mb-[18px]">Gyms near you</div>
            <h2 className="disp m-0 text-[42px] sm:text-[52px] lg:text-[76px]">
              Your city.
              <br />
              Every gym.
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="flex flex-wrap gap-2.5" role="group" aria-label="Filter by area">
            {areas.map((a) => (
              <button key={a} type="button" className="chip" aria-pressed={area === a} onClick={() => setArea(a)}>
                {a}
              </button>
            ))}
          </Reveal>
        </div>

        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-4">
            {query && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm">
                <span className="text-chalk">
                  Results for <strong className="text-text">“{query}”</strong>
                </span>
                <button type="button" onClick={clearQuery} className="text-gold hover:text-gold-hi">
                  Clear
                </button>
              </div>
            )}
            <AnimatePresence mode="popLayout" initial={false}>
              {shown.map((g) => (
                <motion.div
                  key={g.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.45, ease: EASE_DIVE }}
                >
                  <motion.div whileHover={{ y: -8 }} transition={{ duration: 0.4, ease: EASE_DIVE }}>
                    <Link
                      to={`/gyms/${g.slug}`}
                      className="hover-gold flex gap-[18px] rounded-[22px] border border-line bg-surface-2 p-3.5 text-text no-underline"
                    >
                      <Photo src={g.coverUrl} alt={`${g.name} gym floor`} caption="Photo · gym floor" className="h-[112px] w-[110px] flex-none rounded-2xl sm:w-[132px]" />
                      <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
                        <div>
                          <div className="flex items-center justify-between gap-2.5">
                            <span className="truncate text-lg font-bold">{g.name}</span>
                            {g.verified && <span className="shrink-0 text-[11px] font-bold tracking-[.1em] text-success">VERIFIED</span>}
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5 truncate text-[13px] text-muted">
                            <Icon name="pin" size={14} strokeWidth={2} className="shrink-0" />
                            <span className="truncate">
                              {g.neighbourhood} · {g.tags.join(' · ')}
                              {g.distanceKm !== undefined ? ` · ${g.distanceKm} km` : ''}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-soft">
                            {g.fromPriceRwf ? (
                              <>
                                From <strong className="text-text">RWF {g.fromPriceRwf.toLocaleString('en-US')}</strong> / month
                              </>
                            ) : (
                              'See packages'
                            )}
                          </span>
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-text text-[#111]">
                            <Icon name="arrowRight" size={16} strokeWidth={2.4} />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>
            {shown.length === 0 && (
              <div className="rounded-[22px] border border-dashed border-line-2 p-8 text-center text-muted">
                No gyms match yet. Try another area or{' '}
                <button type="button" className="text-gold" onClick={() => { clearQuery(); setArea('All'); }}>
                  show all
                </button>
                .
              </div>
            )}
            <Link to="/gyms" className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-gold no-underline hover:text-gold-hi">
              See all gyms <Icon name="arrowRight" size={15} strokeWidth={2.4} />
            </Link>
            {!live && <div className="text-xs tracking-[.04em] text-faint">Sample listings — start the API to load gyms from the database.</div>}
          </div>

          <Reveal delay={0.1} className="relative isolate min-h-[420px] overflow-hidden rounded-[28px] border border-line bg-[#0b0b0b] lg:min-h-[560px]">
            <div className="absolute inset-0">
              <GymMap gyms={gyms} area={area} user={user} onLocate={onLocate} locating={locating} />
            </div>
            <div className="pointer-events-none absolute bottom-7 left-4 z-[500] flex items-center">
              <span className="flex items-center gap-2 rounded-full border border-line-2 bg-[rgba(14,14,14,.85)] px-4 py-2.5 text-[13px] text-chalk">
                <span className="h-2.5 w-2.5 rounded-full bg-locate" />
                {user ? 'You are here · tap a pin for details' : 'Tap a pin for details'}
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
