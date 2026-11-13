import { useEffect, useState } from 'react';
import type { GymSummary, PublicConfig, TrainerSummary } from '@dive/shared';
import { api } from '../api/client';
import { FALLBACK_CONFIG, FALLBACK_GYMS, FALLBACK_TRAINERS } from '../lib/fallbackData';

export interface PublicData {
  gyms: GymSummary[];
  trainers: TrainerSummary[];
  config: PublicConfig;
  /** true when the API answered; false means fallback samples are shown */
  live: boolean;
  loading: boolean;
}

/** Gyms, coaches and prices for the public pages, with an offline fallback. */
export function usePublicData(): PublicData {
  const [state, setState] = useState<PublicData>({ gyms: FALLBACK_GYMS, trainers: FALLBACK_TRAINERS, config: FALLBACK_CONFIG, live: false, loading: true });

  useEffect(() => {
    const ac = new AbortController();
    Promise.all([
      api<{ gyms: GymSummary[] }>('/gyms?limit=50', { signal: ac.signal }),
      api<{ trainers: TrainerSummary[] }>('/trainers?limit=12', { signal: ac.signal }),
      api<PublicConfig>('/config', { signal: ac.signal }),
    ])
      .then(([g, t, c]) =>
        setState({
          gyms: g.gyms.length ? g.gyms : FALLBACK_GYMS,
          // coaches with photos first
          trainers: [...t.trainers].sort((a, b) => Number(!!b.photoUrl) - Number(!!a.photoUrl)),
          config: c,
          live: true,
          loading: false,
        }),
      )
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setState((s) => ({ ...s, loading: false }));
      });
    return () => ac.abort();
  }, []);

  return state;
}

/** Browser geolocation as a promise (with accuracy in metres). */
export function locate(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Location is not available in this browser'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'Location permission was denied — allow it in your browser settings' : 'Could not get your location')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 },
    );
  });
}

/** True when the visitor already allowed location for this site, so we can locate without a prompt. */
export async function locationAlreadyAllowed() {
  try {
    const s = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    return s?.state === 'granted';
  } catch {
    return false;
  }
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
