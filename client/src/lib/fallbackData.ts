import type { GymSummary, PublicConfig, TrainerSummary } from '@dive/shared';

/** Shown only if the API can't be reached, so the public site never renders empty. Mirrors the seed. */
export const FALLBACK_GYMS: GymSummary[] = [
  { id: 'f1', slug: 'core-lab', name: 'Core Lab', neighbourhood: 'Kicukiro', tags: ['Boxing', 'Mobility'], lat: -1.9721, lng: 30.1035, coverUrl: '/images/gym-8.webp', fromPriceRwf: 55000, verified: true },
  { id: 'f2', slug: 'hilltop-fitness', name: 'Hilltop Fitness', neighbourhood: 'Nyarutarama', tags: ['Pool', 'Sauna'], lat: -1.9363, lng: 30.1036, coverUrl: '/images/gym-5.webp', fromPriceRwf: 80000, verified: true },
  { id: 'f3', slug: 'iron-house', name: 'Iron House', neighbourhood: 'Kacyiru', tags: ['Strength', 'Cardio'], lat: -1.9437, lng: 30.0794, coverUrl: '/images/gym-1.webp', fromPriceRwf: 60000, verified: true },
  { id: 'f4', slug: 'motion-club', name: 'Motion Club', neighbourhood: 'Gisozi', tags: ['Yoga', 'Pilates'], lat: -1.9247, lng: 30.0607, coverUrl: '/images/gym-10.webp', fromPriceRwf: 45000, verified: true },
  { id: 'f5', slug: 'pulse-studio', name: 'Pulse Studio', neighbourhood: 'Kimihurura', tags: ['HIIT', 'Classes'], lat: -1.953, lng: 30.0905, coverUrl: '/images/gym-9.webp', fromPriceRwf: 65000, verified: true },
  { id: 'f6', slug: 'summit-strength', name: 'Summit Strength', neighbourhood: 'Remera', tags: ['Powerlifting'], lat: -1.9575, lng: 30.1127, coverUrl: '/images/gym-6.webp', fromPriceRwf: 50000, verified: true },
];

export const FALLBACK_TRAINERS: TrainerSummary[] = [
  { id: 't1', fullName: 'Eric Niyonzima', photoUrl: '/images/coach-1.webp', headline: 'Strength coach', specialties: ['Strength'], gyms: [{ name: 'Iron House', neighbourhood: 'Kacyiru' }], verified: true },
  { id: 't2', fullName: 'Aline Mukamana', photoUrl: '/images/coach-2.webp', headline: 'HIIT and conditioning', specialties: ['HIIT'], gyms: [{ name: 'Pulse Studio', neighbourhood: 'Kimihurura' }], verified: true },
  { id: 't3', fullName: 'Jean-Paul Habimana', photoUrl: '/images/coach-3.webp', headline: 'Boxing coach', specialties: ['Boxing'], gyms: [{ name: 'Core Lab', neighbourhood: 'Kicukiro' }], verified: true },
  { id: 't4', fullName: 'Patrick Mugisha', photoUrl: '/images/coach-4.webp', headline: 'Powerlifting', specialties: ['Powerlifting'], gyms: [{ name: 'Summit Strength', neighbourhood: 'Remera' }], verified: true },
];

export const FALLBACK_CONFIG: PublicConfig = {
  coachPass: { priceRwf: 5000, days: 30 },
  gymPlans: [
    { id: 'MONTHLY', label: 'Monthly', priceRwf: 30000, months: 1 },
    { id: 'QUARTERLY', label: '3 months', priceRwf: 85000, months: 3 },
    { id: 'SEMIANNUAL', label: '6 months', priceRwf: 160000, months: 6 },
    { id: 'ANNUAL', label: 'Annual', priceRwf: 300000, months: 12 },
  ],
  trialDays: 30,
  commissionPercent: 5,
};
