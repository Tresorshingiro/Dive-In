import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { NEIGHBOURHOODS, type GymSummary } from '@dive/shared';
import { useFetch } from '../../hooks/useFetch';
import { locate, locationAlreadyAllowed } from '../../hooks/usePublicData';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { EASE_DIVE } from '../../components/motion/Reveal';
import { GymMap, type UserLocation } from '../../components/map/GymMap';
import { Icon } from '../../components/ui/Icon';
import { Photo } from '../../components/ui/Photo';
import { rwf } from '../../lib/format';

const km = (d: number) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`);

export default function FindGyms() {
  useDocumentTitle('Find gyms');
  const [params, setParams] = useSearchParams();
  const area = params.get('area') ?? 'All';
  const q = params.get('q') ?? '';
  const [input, setInput] = useState(q);
  const [me, setMe] = useState<UserLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const mapBox = useRef<HTMLDivElement>(null);

  // debounce typing into the URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (input !== q) setParams((p) => { input ? p.set('q', input) : p.delete('q'); return p; }, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [input, q, setParams]);

  const nearMe = async (silent = false) => {
    setLocating(true);
    setLocErr('');
    try {
      setMe(await locate());
      setParams((p) => { p.delete('area'); return p; }, { replace: true });
    } catch (e) {
      if (!silent) setLocErr((e as Error).message);
    } finally {
      setLocating(false);
    }
  };

  // Already allowed location for this site before? Show what's near straight away.
  useEffect(() => {
    void locationAlreadyAllowed().then((ok) => {
      if (ok) void nearMe(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = useMemo(() => {
    const s = new URLSearchParams({ limit: '50' });
    if (q) s.set('q', q);
    if (area !== 'All') s.set('neighbourhood', area);
    if (me) {
      s.set('lat', String(me.lat));
      s.set('lng', String(me.lng));
    }
    return `/gyms?${s}`;
  }, [q, area, me]);

  const { data, loading, error } = useFetch<{ gyms: GymSummary[] }>(query);
  const all = useFetch<{ gyms: GymSummary[] }>('/gyms?limit=50');
  const gyms = data?.gyms ?? [];
  const areas = useMemo(() => {
    const present = new Set((all.data?.gyms ?? []).map((g) => g.neighbourhood));
    return ['All', ...NEIGHBOURHOODS.filter((n) => present.has(n))];
  }, [all.data]);
  const nearestId = me && gyms.length ? gyms.reduce((a, b) => ((b.distanceKm ?? Infinity) < (a.distanceKm ?? Infinity) ? b : a)).id : null;

  const setArea = (a: string) => setParams((p) => { a === 'All' ? p.delete('area') : p.set('area', a); return p; }, { replace: true });
  const showOnMap = (id: string) => {
    setSelected(id);
    // On phones the map sits below the list.
    if (window.matchMedia('(max-width: 979px)').matches) mapBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section className="pt-10 pb-20 lg:pt-14">
      <div className="wrap">
        <div className="eyebrow mb-4">Find gyms</div>
        <h1 className="disp m-0 text-[48px] sm:text-[64px] lg:text-[88px]">
          Every gym in <span className="text-gold">Kigali.</span>
        </h1>

        <div className="mt-8 flex flex-col gap-3 rounded-3xl border border-line-2 bg-field p-2.5 sm:flex-row">
          <label className="flex h-14 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-line bg-ink px-[18px]">
            <Icon name="search" size={20} strokeWidth={2} className="shrink-0 text-dim" />
            <span className="sr-only">Search gyms</span>
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Gym name, neighbourhood or training style"
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium text-text outline-none placeholder:text-[#6b675f]"
            />
          </label>
          <button type="button" onClick={() => nearMe()} disabled={locating} className="btn btn-gold !h-14 !rounded-2xl">
            <Icon name="pin" />
            {locating ? 'Locating…' : me ? 'Update my location' : 'Gyms near me'}
          </button>
        </div>
        {locErr && <p className="mt-2 text-[13px] text-warning" role="alert">{locErr}</p>}

        <div className="mt-5 flex flex-wrap gap-2.5" role="group" aria-label="Filter by area">
          {areas.map((a) => (
            <button key={a} type="button" className="chip" aria-pressed={area === a} onClick={() => setArea(a)}>
              {a}
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-4">
            <div className="text-sm text-muted" aria-live="polite">
              {loading ? 'Searching…' : error ? '' : `${gyms.length} gym${gyms.length === 1 ? '' : 's'}${area !== 'All' ? ` in ${area}` : ''}${q ? ` matching “${q}”` : ''}${me ? ' · closest first' : ''}`}
            </div>
            {error && <p className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error">{error.message}</p>}
            <AnimatePresence mode="popLayout" initial={false}>
              {gyms.map((g) => {
                const isNearest = g.id === nearestId;
                return (
                  <motion.div key={g.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.4, ease: EASE_DIVE }}>
                    <motion.div whileHover={{ y: -8 }} transition={{ duration: 0.4, ease: EASE_DIVE }} className="relative">
                      <Link
                        to={`/gyms/${g.slug}`}
                        className={`hover-gold flex gap-[18px] rounded-[22px] border bg-surface-2 p-3.5 text-text no-underline ${isNearest ? 'border-gold-line' : selected === g.id ? 'border-gold' : 'border-line'}`}
                      >
                        <Photo src={g.coverUrl} alt={g.name} caption="Photo · gym" className="h-[112px] w-[110px] flex-none rounded-2xl sm:w-[132px]">
                          {isNearest && <span className="absolute top-2 left-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-gold-ink">NEAREST</span>}
                        </Photo>
                        <div className="flex min-w-0 flex-1 flex-col justify-between py-1 pr-10">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="truncate text-lg font-bold">{g.name}</span>
                              {g.verified && <span className="shrink-0 text-[10px] font-bold tracking-[.1em] text-success">VERIFIED</span>}
                            </div>
                            <div className="mt-1.5 truncate text-[13px] text-muted">{g.neighbourhood} · {g.tags.join(' · ')}</div>
                            {g.distanceKm !== undefined && (
                              <div className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-chalk"><Icon name="pin" size={13} className="text-locate" /> {km(g.distanceKm)} away</div>
                            )}
                          </div>
                          <span className="text-sm text-soft">{g.fromPriceRwf ? <>From <strong className="text-text">{rwf(g.fromPriceRwf)}</strong> / month</> : 'See packages'}</span>
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={() => showOnMap(g.id)}
                        className="absolute top-3.5 right-3.5 grid h-9 w-9 place-items-center rounded-full border border-line-2 bg-ink text-chalk transition-colors hover:border-gold hover:text-gold"
                        aria-label={`Show ${g.name} on the map`}
                        title="Show on map"
                      >
                        <Icon name="pin" size={16} />
                      </button>
                    </motion.div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {!loading && !error && gyms.length === 0 && (
              <div className="rounded-[22px] border border-dashed border-line-2 p-8 text-center text-muted">
                No gyms match. <button type="button" className="text-gold" onClick={() => { setInput(''); setArea('All'); }}>Clear filters</button>
              </div>
            )}
          </div>

          <div ref={mapBox} className="relative isolate h-[460px] overflow-hidden rounded-[28px] border border-line bg-[#0b0b0b] lg:sticky lg:top-[100px] lg:h-[calc(100vh-130px)]">
            <GymMap
              gyms={gyms.length ? gyms : (all.data?.gyms ?? [])}
              area={area}
              user={me}
              selectedId={selected}
              onSelect={setSelected}
              onLocate={() => nearMe()}
              locating={locating}
            />
            {!me && (
              <div className="pointer-events-none absolute bottom-7 left-4 z-[500] rounded-full border border-line-2 bg-[rgba(14,14,14,.85)] px-4 py-2.5 text-[13px] text-chalk">
                Tap a pin to see the gym · <span className="text-locate">Locate me</span> to find the nearest
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
