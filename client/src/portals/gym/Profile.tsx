import L from 'leaflet';
import { useEffect, useState, type FormEvent } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { DAY_KEYS, NEIGHBOURHOODS, fieldErrors, gymProfileSchema } from '@dive/shared';
import { api, ApiError } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { WEEKDAYS } from '../../lib/format';
import { ErrorNote, Flash, PageHead, Skeleton, Toggle } from '../ui';
import { useGym } from './GymLayout';

interface Profile {
  name: string; description: string | null; neighbourhood: string; address: string | null; phone: string | null; email: string | null;
  lat: number; lng: number; openingHours: Record<string, string>; tags: string[]; amenities: string[];
  diveCheckoutEnabled: boolean; commissionOptIn: boolean; slug: string;
}

const pinIcon = L.divIcon({ className: 'gym-pin is-on', html: '<div class="gym-pin__inner"><span class="gym-pin__dot"><span class="gym-pin__ping"></span></span></div>', iconSize: [0, 0], iconAnchor: [0, 0] });

function Picker({ lat, lng, onPick }: { lat: number; lng: number; onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))) });
  return <Marker position={[lat, lng]} icon={pinIcon} draggable eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onPick(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))); } }} />;
}

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function Profile() {
  useDocumentTitle('Gym profile');
  const { reload } = useGym();
  const { data } = useFetch<{ profile: Profile }>('/gym/profile');
  const [f, setF] = useState<Profile | null>(null);
  const [tags, setTags] = useState('');
  const [amen, setAmen] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data && !f) {
      setF({ ...data.profile, openingHours: Object.fromEntries(DAY_KEYS.map((d) => [d, data.profile.openingHours[d] ?? ''])) });
      setTags(data.profile.tags.join(', '));
      setAmen(data.profile.amenities.join(', '));
    }
  }, [data, f]);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  if (!f) return <Skeleton h={500} />;
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setF((s) => (s ? { ...s, [k]: v } : s));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const body = { ...f, description: f.description ?? '', address: f.address ?? '', phone: f.phone ?? '', email: f.email ?? '', tags: list(tags), amenities: list(amen) };
    const parsed = gymProfileSchema.safeParse(body);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setErr('Please fix the highlighted fields');
      return;
    }
    setErrors({});
    setErr('');
    setBusy(true);
    try {
      const r = await api<{ profile: Profile }>('/gym/profile', { method: 'PUT', body: body });
      setF({ ...r.profile, openingHours: Object.fromEntries(DAY_KEYS.map((d) => [d, r.profile.openingHours[d] ?? ''])) });
      setSaved(true);
      reload();
    } catch (e2) {
      if (e2 instanceof ApiError && e2.fields) setErrors(e2.fields);
      setErr(e2 instanceof ApiError ? e2.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const text = (k: 'name' | 'address' | 'phone' | 'email', label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="field-label" htmlFor={`gp-${k}`}>{label}</label>
      <input id={`gp-${k}`} className="field" value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} aria-invalid={!!errors[k]} {...props} />
      {errors[k] && <p className="field-error">{errors[k]}</p>}
    </div>
  );

  return (
    <form onSubmit={save} noValidate>
      <PageHead
        eyebrow="Gym profile"
        title="Gym profile"
        actions={<><Flash show={saved} /><a href={`/gyms/${f.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost !h-11">View public page</a><button type="submit" className="btn btn-gold !h-11" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></>}
      >
        What members see before they join. Changes go live as soon as you save.
      </PageHead>
      <div className="mb-6"><ErrorNote message={err} /></div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="card flex flex-col gap-4 p-6">
          <h2 className="disp m-0 text-[26px]">Basics</h2>
          {text('name', 'Gym name')}
          <div>
            <label className="field-label" htmlFor="gp-desc">Description</label>
            <textarea id="gp-desc" className="field" maxLength={1500} value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="What makes your gym different? Equipment, atmosphere, who it’s for." />
          </div>
          <div>
            <label className="field-label" htmlFor="gp-tags">Training styles <span className="font-normal text-faint">(comma separated, up to 6)</span></label>
            <input id="gp-tags" className="field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Strength, Cardio, HIIT" aria-invalid={!!errors.tags} />
            {errors.tags && <p className="field-error">{errors.tags}</p>}
          </div>
          <div>
            <label className="field-label" htmlFor="gp-amen">Amenities <span className="font-normal text-faint">(comma separated)</span></label>
            <input id="gp-amen" className="field" value={amen} onChange={(e) => setAmen(e.target.value)} placeholder="Showers, Parking, Lockers" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {text('phone', 'Phone', { type: 'tel', placeholder: '078 123 4567' })}
            {text('email', 'Email', { type: 'email' })}
          </div>
        </section>

        <section className="card flex flex-col gap-4 p-6">
          <h2 className="disp m-0 text-[26px]">Location</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="gp-area">Neighbourhood</label>
              <select id="gp-area" className="field" value={f.neighbourhood} onChange={(e) => set('neighbourhood', e.target.value)}>
                {NEIGHBOURHOODS.map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            {text('address', 'Street address', { placeholder: 'KG 7 Ave' })}
          </div>
          <div>
            <span className="field-label">Map pin <span className="font-normal text-faint">— click the map or drag the pin to your entrance</span></span>
            <div className="relative isolate h-[300px] overflow-hidden rounded-2xl border border-line">
              <MapContainer center={[f.lat, f.lng]} zoom={15} scrollWheelZoom={false} className="dive-map h-full w-full">
                <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
                <Picker lat={f.lat} lng={f.lng} onPick={(lat, lng) => setF((s) => (s ? { ...s, lat, lng } : s))} />
              </MapContainer>
            </div>
            <p className="mt-2 text-xs text-faint tabular-nums">{f.lat}, {f.lng}</p>
            {(errors.lat || errors.lng) && <p className="field-error">{errors.lat ?? errors.lng}</p>}
          </div>
        </section>

        <section className="card p-6">
          <h2 className="disp m-0 mb-1 text-[26px]">Opening hours</h2>
          <p className="mt-0 mb-4 text-[13px] text-muted">Format 05:30-22:00. Leave empty if closed.</p>
          <div className="grid gap-2.5">
            {WEEKDAYS.map(([k, label]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] items-center gap-3">
                <label htmlFor={`h-${k}`} className="text-sm text-chalk">{label}</label>
                <div>
                  <input id={`h-${k}`} className="field !h-11" placeholder="Closed" value={f.openingHours[k] ?? ''} onChange={(e) => set('openingHours', { ...f.openingHours, [k]: e.target.value.replace(/\s/g, '').replace('–', '-') })} aria-invalid={!!errors[`openingHours.${k}`]} />
                  {errors[`openingHours.${k}`] && <p className="field-error">{errors[`openingHours.${k}`]}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card flex flex-col gap-4 p-6">
          <h2 className="disp m-0 text-[26px]">Payments</h2>
          <Toggle
            checked={f.diveCheckoutEnabled}
            onChange={(v) => setF((s) => (s ? { ...s, diveCheckoutEnabled: v, commissionOptIn: v ? s.commissionOptIn : false } : s))}
            label="Members pay online through DIVE-IN"
            hint="Card now, Mobile Money soon. Cards activate automatically once the payment provider confirms. Off = members reserve online and pay at your front desk."
          />
          <Toggle
            checked={f.commissionOptIn}
            disabled={!f.diveCheckoutEnabled}
            onChange={(v) => set('commissionOptIn', v)}
            label="DIVE-IN commission on online payments"
            hint="Proposed 5% of memberships paid through DIVE-IN, only if you agree to the partner terms. Payments at your desk are never charged."
          />
        </section>
      </div>
    </form>
  );
}
