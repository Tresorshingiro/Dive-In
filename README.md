# DIVE-IN Fitness Hub

Find gyms and coaches in Kigali, buy a membership, book a trainer, and show a digital membership card at reception — one platform with five role areas.

**Stack:** React + Vite + Tailwind + framer-motion + react-leaflet (`client/`) · Express + Prisma + PostgreSQL (`server/`) · shared zod schemas (`shared/`) · Stripe (test mode) behind a provider interface · Vitest + Supertest.

Scope documents are in `docs/` (deck, presentation guide, landing-page mockup).

---

## 1. Setup

Requirements: **Node 20+**, **PostgreSQL 14+** running locally.

```bash
npm install                          # all three workspaces
cp server/.env.example server/.env   # then edit it (below)
npm run db:migrate                   # creates the dive_fitness database if needed + applies migrations
npm run db:seed                      # ⚠ wipes the database and loads demo data
npm run dev                          # API http://localhost:4000 · web http://localhost:5173
```

In `server/.env`:

| Variable | What to put |
|---|---|
| `DATABASE_URL` | your Postgres URL, e.g. `postgresql://postgres:<password>@localhost:5432/dive_fitness` |
| `TEST_DATABASE_URL` | a **separate** database for tests; its name must contain `test` (e.g. `…/dive_fitness_test`) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MOCK_PAYMENT_WEBHOOK_SECRET` | long random strings: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `STRIPE_SECRET_KEY` | Stripe **test** key `sk_test_…` (a live key is refused outside production) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` printed by `stripe listen` (see below) |
| `PAYMENT_PROVIDER` | `stripe` (default) or `mock` (no Stripe account needed) |

### Payments (Stripe test mode)

1. In a second terminal: `stripe login`, then `stripe listen --forward-to localhost:4000/api/webhooks/stripe`, and copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`.
2. Test card `4242 4242 4242 4242` (any future date, any CVC). Declined: `4000 0000 0000 0002`.

A payment becomes **PAID only** through a signed provider webhook or a server-to-server status check with the provider (the return page does this, so it also works without `stripe listen`). Nothing the browser sends can mark a payment paid. Stripe takes cards only; Mobile Money (MTN MoMo / Flutterwave) plugs into the same `PaymentProvider` interface later.

With `PAYMENT_PROVIDER=mock`, checkout opens a built-in test payment page whose result arrives as an HMAC-signed webhook through the same verification path.

---

## 2. Demo accounts

Password for all: **`DiveDemo2026`**

| Role | Email | Where |
|---|---|---|
| Member | `member@demo.dive.rw` (Samuel Habineza) | `/app` |
| Member with a Coach Access Pass + booked session | `sarah@demo.dive.rw` | `/app/coaching` |
| Gym owner (Iron House) | `owner@demo.dive.rw` | `/gym` |
| Receptionist (Iron House) | `reception@demo.dive.rw` | `/gym/reception` |
| Receptionist (Pulse Studio) | `reception.pulse@demo.dive.rw` | `/gym/reception` |
| Trainer | `trainer@demo.dive.rw` (Eric) | `/trainer` |
| Gym awaiting approval | `owner.pending@demo.dive.rw` | `/gym` |
| Admin | `admin@demo.dive.rw` | **`/admin/login`** (footer link) |

**Admin sign-in is password-only for now.** Two-factor sign-in with an authenticator app (TOTP) is built but switched off. To turn it back on, set `ADMIN_MFA_ENABLED=true` in `server/.env` and restart: admins then scan a QR code on their next login and enter a 6-digit code at every sign-in (a lost phone is fixed by another admin under Users → Reset 2FA).

---

## 3. What each role can do

| Role | Area | Features |
|---|---|---|
| **Visitor** | `/`, `/gyms`, `/coaches`, `/about`, `/contact` | landing page, gym search (list + map + near me), gym profiles & packages, basic coach profiles, contact form |
| **Member** | `/app` | buy/renew memberships (online or reserve-and-pay-at-desk), digital card (no QR), Coach Access Pass, book & pay sessions, message coaches, payments, notifications |
| **Gym owner** | `/gym` | overview, reception desk, members (record desk payments, cancel), packages & prices, profile + map pin, photos, linked trainers, staff accounts, payments & reports (charts, CSV), activity log, DIVE-IN partner plan |
| **Receptionist** | `/gym/reception` | search own gym's members by name or number, live status, record check-in. No money, prices, settings or other gyms |
| **Trainer** | `/trainer` | profile & photo, weekly availability + days off, sessions (mark done / cancel with refund), messages, earnings |
| **DIVE-IN admin** | `/admin` | approve/reject/suspend gyms, verify trainers, users (suspend, reset password, reset 2FA, create admins), payments (refund, resolve), platform prices, contact inbox, audit log, platform reports |

---

## 4. Business rules (where they live)

| Rule | Implementation |
|---|---|
| Paid only after server-side verification | `server/src/modules/payments/payments.service.ts` → `applyVerified` (the only path to PAID; checks amount + currency) |
| Webhooks authenticated | Stripe signature / HMAC (mock); events stored once in `payment_events` |
| No duplicate payments | `Idempotency-Key` header required; unique `(user_id, idempotency_key)`; parallel retries return the same checkout; an older open checkout is cancelled at the provider |
| No duplicate memberships / bookings | partial unique indexes (one live membership per member+gym; one live booking per trainer slot) in `prisma/migrations/20261112000000_init` |
| No double check-ins | per-membership advisory lock + 2-minute window |
| Card has no QR; reception checks the live record | `server/src/modules/gym/reception.service.ts` → `entryDecision` |
| Coach Access Pass and session fee are separate payments | `server/src/modules/coaching/coaching.service.ts` |
| Full coach details only with a pass | enforced by the API (`coachProfile`), not hidden in the browser |
| Optional 5% commission, per-gym opt-in | `gyms.commission_opt_in`, rate in `platform_config` |
| 1-month free trial, partner plan prices | `platform_config` (admin → Prices & settings); trial starts on approval |
| Role & gym isolation | `requireRole`, `requireGymScope` (`server/src/middleware`) |
| Audit log | `audit_logs`, written for auth, payments, approvals, prices, staff, check-in refusals, refunds… |

Auth: short-lived JWT access cookie + rotating refresh cookie (httpOnly, SameSite=Lax); reusing an old refresh token revokes the session family; cross-site POSTs are rejected; staff and new admins start with a temporary password they must change.

---

## 5. Tests

```bash
npm test          # runs server/tests against TEST_DATABASE_URL (wiped + reseeded per file)
```

73 tests:

- **payments.test.ts** — PENDING until verified · forged/unsigned webhooks rejected · signed webhook body not trusted (provider re-checked) · amount mismatch never PAID · declines · other members can't touch my payment · refunds · desk payments · renewals
- **duplicates.test.ts** — Idempotency-Key required · 5 parallel retries → 1 payment · key reuse refused · old checkout cancelled · DB-level one-live-membership · webhook delivered twice processed once · no double extension · desk payment idempotency · 3-way booking race → 1 winner · held slots · DB-level one-booking-per-slot · double-tap check-in
- **permissions.test.ts** — full role × endpoint matrix (29 endpoints × 6 roles) · gym isolation · reception data minimisation · admin sign-in with two-factor off (default) and on · temporary passwords · suspension ends sessions · refresh-token reuse · cross-site POSTs
- **units.test.ts** — TOTP RFC 6238 vectors · reception rules · membership numbers · Kigali time · validation

Tests always use the mock payment provider (never Stripe) and refuse to run against a database whose name doesn't contain `test`.

---

## 6. Scripts

| Command | |
|---|---|
| `npm run dev` | API + web with reload |
| `npm test` | test suite |
| `npm run typecheck` | TypeScript, all workspaces |
| `npm run build` | production builds (`server/dist`, `client/dist`) |
| `npm run db:migrate` / `db:seed` / `db:reset` / `db:studio` | Prisma |
| `npm run images` | regenerate `client/public/images/*.webp` from `client/assets-src/photos` |

## 7. Going live — still to do

- A payment provider that can pay out to a Rwandan business (MTN MoMo / Flutterwave) — add a `PaymentProvider` implementation; Stripe can't open Rwandan merchant accounts.
- Real email/SMS delivery for notifications (currently in-app only) and a password-reset-by-email flow.
- Production hosting: HTTPS, `NODE_ENV=production`, managed Postgres with backups, file storage for `server/uploads/` (or S3-compatible), process manager, monitoring.
- Final prices, partner terms, terms of service and privacy policy (the Contact FAQ notes these are pending).
