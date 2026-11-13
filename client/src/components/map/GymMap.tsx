import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link } from 'react-router';
import { KIGALI_CENTER, type GymSummary } from '@dive/shared';
import { distanceKm } from '../../hooks/usePublicData';
import { Icon } from '../ui/Icon';

export interface UserLocation {
  lat: number;
  lng: number;
  /** metres, from the browser */
  accuracy?: number;
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const km = (d: number) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`);

function gymIcon(name: string, state: 'on' | 'dim' | 'idle', nearest: number | null) {
  return L.divIcon({
    className: `gym-pin ${state === 'on' ? 'is-on' : state === 'dim' ? 'is-dim' : ''} ${nearest !== null ? 'is-nearest' : ''}`,
    html: `<div class="gym-pin__inner"><span class="gym-pin__label">${escape(name)}${nearest !== null ? `<em>Nearest · ${km(nearest)}</em>` : ''}</span><span class="gym-pin__dot"><span class="gym-pin__ping"></span></span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

const youIcon = L.divIcon({ className: '', html: '<div class="you-pin" title="You are here"><span></span></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

/** Fits the view whenever the set of points of interest changes. */
function FitTo({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const key = JSON.stringify(points);
  useEffect(() => {
    if (points.length === 0) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (points.length === 1) map.flyTo(points[0], 15, { animate: !reduce, duration: 0.9 });
    else map.flyToBounds(L.latLngBounds(points), { padding: [70, 70], maxZoom: 15, animate: !reduce, duration: 0.9 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** Brings a gym chosen from outside the map (e.g. "Show on map") into view. */
function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.flyTo(target, Math.max(map.getZoom(), 15), { animate: !reduce, duration: 0.7 });
  }, [target, map]);
  return null;
}

/** Locate button floating on the map (top-right). */
function LocateControl({ onLocate, locating, located }: { onLocate: () => void; locating: boolean; located: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) L.DomEvent.disableClickPropagation(ref.current);
  }, []);
  return (
    <div ref={ref} className="absolute top-3 right-3 z-[1000]">
      <button
        type="button"
        onClick={onLocate}
        disabled={locating}
        className="flex h-10 items-center gap-2 rounded-full border border-line-2 bg-[rgba(14,14,14,.9)] px-3.5 text-[13px] font-semibold text-text shadow-lg transition-colors hover:border-gold disabled:opacity-60"
        aria-label={located ? 'Re-centre on my location' : 'Show my location'}
      >
        <span className={`h-2.5 w-2.5 rounded-full bg-locate ${locating ? 'animate-pulse' : ''}`} />
        {locating ? 'Locating…' : located ? 'My location' : 'Locate me'}
      </button>
    </div>
  );
}

function directionsUrl(g: GymSummary, user?: UserLocation | null) {
  const p = new URLSearchParams({ api: '1', destination: `${g.lat},${g.lng}` });
  if (user) p.set('origin', `${user.lat},${user.lng}`);
  return `https://www.google.com/maps/dir/?${p}`;
}

export function GymMap({
  gyms,
  area,
  user,
  className = '',
  interactive = true,
  selectedId,
  onSelect,
  onLocate,
  locating = false,
}: {
  gyms: GymSummary[];
  area: string;
  user?: UserLocation | null;
  className?: string;
  interactive?: boolean;
  /** Controlled selection (e.g. from a "Show on map" button). */
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Shows a locate button on the map. */
  onLocate?: () => void;
  locating?: boolean;
}) {
  const [innerSel, setInnerSel] = useState<string | null>(null);
  const sel = selectedId !== undefined ? selectedId : innerSel;
  const select = (id: string | null) => {
    setInnerSel(id);
    onSelect?.(id);
  };

  // Distance from the user to every gym, and the closest one.
  const withDistance = useMemo(
    () => gyms.map((g) => ({ g, d: user ? (g.distanceKm ?? distanceKm(user, g)) : null })),
    [gyms, user],
  );
  const nearest = useMemo(() => {
    if (!user) return null;
    return withDistance.filter((x) => x.d !== null).sort((a, b) => a.d! - b.d!)[0] ?? null;
  }, [withDistance, user]);

  // What the map frames: you + the closest gyms, or the chosen area.
  const points = useMemo(() => {
    if (user && area === 'All') {
      const close = withDistance.filter((x) => x.d !== null).sort((a, b) => a.d! - b.d!).slice(0, 3);
      return [[user.lat, user.lng] as [number, number], ...close.map(({ g }) => [g.lat, g.lng] as [number, number])];
    }
    const hl = area === 'All' ? gyms : gyms.filter((g) => g.neighbourhood === area);
    return [...hl.map((g) => [g.lat, g.lng] as [number, number]), ...(user ? [[user.lat, user.lng] as [number, number]] : [])];
  }, [gyms, area, user, withDistance]);

  const selected = withDistance.find((x) => x.g.id === sel) ?? null;
  const flyTarget = useMemo<[number, number] | null>(() => (selected && selectedId !== undefined ? [selected.g.lat, selected.g.lng] : null), [selected?.g.id, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MapContainer
      center={[KIGALI_CENTER.lat, KIGALI_CENTER.lng]}
      zoom={13}
      scrollWheelZoom={false}
      dragging={interactive}
      zoomControl={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      keyboard={interactive}
      className={`dive-map h-full w-full ${className}`}
      attributionControl
    >
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' maxZoom={19} />

      {withDistance.map(({ g }) => {
        const state = g.id === sel ? 'on' : area === 'All' ? 'idle' : g.neighbourhood === area ? 'on' : 'dim';
        const isNearest = nearest?.g.id === g.id;
        return (
          <Marker
            key={`${g.id}-${state}-${isNearest ? nearest!.d!.toFixed(2) : ''}`}
            position={[g.lat, g.lng]}
            icon={gymIcon(g.name, state, isNearest ? nearest!.d : null)}
            zIndexOffset={g.id === sel ? 2000 : isNearest ? 1500 : state === 'on' ? 1000 : 0}
            title={`${g.name}, ${g.neighbourhood}`}
            keyboard={interactive}
            interactive={interactive && !!g.slug}
            eventHandlers={interactive && g.slug ? { click: () => select(g.id) } : {}}
          />
        );
      })}

      {selected && interactive && (
        <Popup
          key={selected.g.id}
          position={[selected.g.lat, selected.g.lng]}
          offset={[0, -38]}
          className="gym-popup"
          maxWidth={300}
          minWidth={260}
          eventHandlers={{ remove: () => select(null) }}
        >
          <div className="w-[260px] overflow-hidden rounded-[18px]">
            <div className="relative h-[120px] bg-[repeating-linear-gradient(135deg,#191919_0_14px,#1e1e1e_14px_28px)]">
              {selected.g.coverUrl && <img src={selected.g.coverUrl} alt="" className="h-full w-full object-cover" />}
              {nearest?.g.id === selected.g.id && <span className="absolute top-2.5 left-2.5 rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold text-gold-ink">NEAREST TO YOU</span>}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[16px] font-bold text-text">{selected.g.name}</div>
                  <div className="mt-0.5 text-[12px] text-muted">{selected.g.neighbourhood} · {selected.g.tags.join(' · ')}</div>
                </div>
                {selected.g.verified && <span className="mt-0.5 shrink-0 text-[10px] font-bold tracking-[.1em] text-success">VERIFIED</span>}
              </div>
              <div className="mt-3 flex items-center justify-between text-[13px]">
                <span className="text-soft">{selected.g.fromPriceRwf ? <>From <strong className="text-text">RWF {selected.g.fromPriceRwf.toLocaleString('en-US')}</strong>/mo</> : 'See packages'}</span>
                {selected.d !== null && <span className="flex items-center gap-1 font-semibold text-chalk"><Icon name="pin" size={13} />{km(selected.d)}</span>}
              </div>
              <div className="mt-3.5 grid grid-cols-2 gap-2">
                <Link to={`/gyms/${selected.g.slug}`} className="btn btn-gold !h-10 !px-3 !text-[13px] no-underline">View gym</Link>
                <a href={directionsUrl(selected.g, user)} target="_blank" rel="noreferrer" className="btn btn-ghost !h-10 !px-3 !text-[13px] no-underline">Directions</a>
              </div>
            </div>
          </div>
        </Popup>
      )}

      {user && (
        <>
          {user.accuracy && user.accuracy < 3000 && (
            <Circle center={[user.lat, user.lng]} radius={user.accuracy} pathOptions={{ color: '#5AA9FF', weight: 1, opacity: 0.5, fillColor: '#5AA9FF', fillOpacity: 0.08 }} interactive={false} />
          )}
          <Marker position={[user.lat, user.lng]} icon={youIcon} title="You are here" interactive={false} zIndexOffset={2500} />
        </>
      )}

      {onLocate && interactive && <LocateControl onLocate={onLocate} locating={locating} located={!!user} />}
      <FitTo points={points} />
      <FlyTo target={flyTarget} />
    </MapContainer>
  );
}
