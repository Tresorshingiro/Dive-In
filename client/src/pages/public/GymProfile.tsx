import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { GymProfile as Gym, MyMembership, PackageView } from '@dive/shared';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Reveal, EASE_DIVE } from '../../components/motion/Reveal';
import { GymMap } from '../../components/map/GymMap';
import { Icon } from '../../components/ui/Icon';
import { Photo } from '../../components/ui/Photo';
import { StatusPill } from '../../components/ui/StatusPill';
import { CheckoutSheet } from '../../components/checkout/CheckoutSheet';
import { NotFound } from './Placeholder';
import { durationLabel, longDate, rwf, WEEKDAYS } from '../../lib/format';

export default function GymProfile() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const { data, error, loading } = useFetch<{ gym: Gym }>(`/gyms/${encodeURIComponent(slug)}`);
  const mine = useFetch<{ memberships: MyMembership[] }>(user?.role === 'MEMBER' ? '/me/memberships' : null);
  const gym = data?.gym;
  useDocumentTitle(gym?.name ?? 'Gym');

  const existing = useMemo(
    () => mine.data?.memberships.find((m) => m.gym.id === gym?.id && (m.status === 'ACTIVE' || m.status === 'AWAITING_PAYMENT')) ?? null,
    [mine.data, gym],
  );
  // ?package=<id> opens the sheet (also used to come back after logging in)
  const [picked, setPicked] = useState<PackageView | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const fromUrl = gym?.packages.find((p) => p.id === params.get('package')) ?? null;
  const open = picked ?? fromUrl;
  const close = () => {
    setPicked(null);
    if (params.has('package')) setParams((p) => { p.delete('package'); return p; }, { replace: true });
  };

  if (loading && !gym) return <div className="min-h-[70vh]" />;
  if (error?.status === 404) return <NotFound />;
  if (error || !gym) return <p className="wrap py-28 text-error">{error?.message ?? 'Could not load this gym.'}</p>;

  const cover = (gym.photos[photoIdx] ?? gym.photos[0])?.url ?? null;
  const today = WEEKDAYS[(new Date().getDay() + 6) % 7][0];

  return (
    <>
      {/* hero */}
      <section className="relative pt-6 pb-14">
        <div className="wrap">
          <Link to="/gyms" className="mb-6 inline-flex items-center gap-2 text-sm text-muted no-underline hover:text-text">
            <Icon name="arrowRight" size={14} className="rotate-180" /> All gyms
          </Link>
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE_DIVE }}>
            <Photo key={cover ?? 'none'} src={cover} alt={gym.photos[photoIdx]?.caption ?? gym.name} caption="Photo · gym floor" eager className="h-[300px] rounded-[32px] sm:h-[420px]">
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <div className="absolute right-6 bottom-6 left-6 sm:right-10 sm:bottom-10 sm:left-10">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="inline-flex h-8 items-center gap-2 rounded-full bg-[rgba(14,14,14,.8)] px-3.5 text-xs font-bold tracking-[.1em] text-success">
                    <Icon name="check" size={14} strokeWidth={2.6} /> VERIFIED PARTNER
                  </span>
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[rgba(14,14,14,.8)] px-3.5 text-[13px] text-chalk">
                    <Icon name="pin" size={14} /> {gym.neighbourhood}
                  </span>
                </div>
                <h1 className="disp m-0 text-[52px] sm:text-[80px] lg:text-[104px]">{gym.name}</h1>
                <div className="mt-2 text-[15px] text-chalk">{gym.tags.join(' · ')}</div>
              </div>
            </Photo>
          </motion.div>
          {gym.photos.length > 1 && (
            <div className="scroll-hide mt-4 flex gap-3 overflow-x-auto pb-1" role="tablist" aria-label="Gym photos">
              {gym.photos.map((p, i) => (
                <button
                  key={p.url}
                  type="button"
                  role="tab"
                  aria-selected={i === photoIdx}
                  aria-label={`Photo ${i + 1} of ${gym.photos.length}`}
                  onClick={() => setPhotoIdx(i)}
                  className={`relative h-20 w-28 flex-none overflow-hidden rounded-2xl border-2 transition-all sm:h-24 sm:w-36 ${i === photoIdx ? 'border-gold' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {existing && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-line bg-gold-deep px-5 py-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <StatusPill status={existing.status} size="sm" />
                <span className="text-chalk">
                  {existing.status === 'ACTIVE' ? `Your ${existing.package.name} membership runs until ${longDate(existing.endsAt)}.` : `Your ${existing.package.name} membership is waiting for payment.`}
                </span>
              </div>
              <Link to={`/app/cards/${existing.id}`} className="text-sm font-semibold text-gold no-underline">View card →</Link>
            </div>
          )}
        </div>
      </section>

      {/* packages */}
      <section className="border-t border-line-soft bg-section py-16 sm:py-24">
        <div className="wrap">
          <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow mb-4">Packages</div>
              <h2 className="disp m-0 text-[42px] sm:text-[56px]">Pick your plan.</h2>
            </div>
            <p className="m-0 max-w-[420px] text-[15px] text-muted">
              {gym.diveCheckoutEnabled ? 'Pay securely online. Your card activates as soon as payment is verified.' : `${gym.name} collects payment at the front desk. Reserve online, pay at reception.`}
            </p>
          </Reveal>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {gym.packages.map((p, i) => {
              const featured = p.durationDays >= 28 && p.durationDays <= 31;
              return (
                <Reveal key={p.id} delay={Math.min(i, 3) * 0.08} lift className={`flex flex-col rounded-[26px] border p-7 ${featured ? 'border-gold-line bg-gold-deep' : 'hover-gold border-line bg-surface'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-[.14em] text-muted uppercase">{durationLabel(p.durationDays)}</span>
                    {featured && <span className="rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold text-gold-ink">POPULAR</span>}
                  </div>
                  <h3 className="disp mt-4 mb-1 text-[32px]">{p.name}</h3>
                  <div className="disp text-[40px] text-gold">{rwf(p.priceRwf)}</div>
                  <ul className="m-0 mt-5 mb-7 flex list-none flex-col gap-2 p-0 text-sm text-chalk">
                    {p.perks.map((perk) => (
                      <li key={perk} className="flex items-center gap-2"><Icon name="check" size={15} className="text-gold" />{perk}</li>
                    ))}
                  </ul>
                  <button type="button" className={`btn mt-auto w-full ${featured ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setPicked(p)}>
                    {existing?.status === 'ACTIVE' ? 'Renew with this' : 'Choose'}
                  </button>
                </Reveal>
              );
            })}
          </div>
          {gym.packages.length === 0 && <p className="text-muted">This gym hasn’t published packages yet.</p>}
        </div>
      </section>

      {/* about + hours + map */}
      <section className="py-16 sm:py-24">
        <div className="wrap grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
          <div>
            <Reveal>
              <div className="eyebrow mb-4">About</div>
              <p className="lead m-0 !text-[19px]">{gym.description ?? 'More details coming soon.'}</p>
            </Reveal>
            {gym.amenities.length > 0 && (
              <Reveal delay={0.1} className="mt-8 flex flex-wrap gap-2">
                {gym.amenities.map((a) => (
                  <span key={a} className="rounded-full border border-line bg-surface px-4 py-2 text-sm text-chalk">{a}</span>
                ))}
              </Reveal>
            )}
            {gym.trainers.length > 0 && (
              <Reveal delay={0.15} className="mt-12">
                <div className="eyebrow mb-5">Coaches at {gym.name}</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {gym.trainers.map((t) => (
                    <div key={t.id} className="card flex items-center gap-4 !rounded-[20px] p-3">
                      <Photo src={t.photoUrl} alt={t.fullName} className="h-16 w-16 flex-none rounded-2xl" />
                      <div className="min-w-0">
                        <div className="truncate font-bold">{t.fullName}</div>
                        <div className="truncate text-[13px] text-muted">{t.specialties.join(' · ')}</div>
                      </div>
                      <span className="ml-auto flex items-center gap-1 pr-2 text-xs font-semibold text-gold"><Icon name="lock" size={13} /> Pass</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            )}
          </div>
          <div className="flex flex-col gap-5">
            {gym.openingHours && (
              <Reveal className="card p-6">
                <div className="mb-4 flex items-center gap-2 font-bold"><Icon name="clock" size={18} className="text-gold" /> Opening hours</div>
                <dl className="m-0 grid gap-2 text-sm">
                  {WEEKDAYS.map(([k, label]) => (
                    <div key={k} className={`flex justify-between ${k === today ? 'font-semibold text-gold' : 'text-chalk'}`}>
                      <dt>{label}</dt>
                      <dd className="m-0">{gym.openingHours?.[k]?.replace('-', ' – ') ?? 'Closed'}</dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            )}
            <Reveal delay={0.1} className="relative isolate h-[260px] overflow-hidden rounded-[24px] border border-line">
              <GymMap gyms={[{ id: gym.id, slug: '', name: gym.name, neighbourhood: gym.neighbourhood, tags: [], lat: gym.lat, lng: gym.lng, coverUrl: null, fromPriceRwf: null, verified: true }]} area={gym.neighbourhood} interactive={false} />
            </Reveal>
            <div className="text-sm text-muted">
              {gym.address && <div className="flex items-center gap-2"><Icon name="pin" size={15} /> {gym.address}</div>}
              {gym.phone && <a href={`tel:${gym.phone}`} className="mt-2 flex items-center gap-2 text-chalk no-underline"><Icon name="phone" size={15} /> {gym.phone}</a>}
            </div>
          </div>
        </div>
      </section>

      <CheckoutSheet gym={gym} pkg={open} existing={existing} onClose={close} />
    </>
  );
}
