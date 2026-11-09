# WasteLoop

A multi-stream food and organic waste exchange marketplace, built for CSE 412 against the WasteLoop SRS.

WasteLoop connects **providers** (households, restaurants, grocery stores, caterers, event organisers) who have surplus food or organic waste with **takers** (farmers, waste-to-energy plants, recyclers/buyers, charities) who can use it.

> WasteLoop is a **connection and coordination platform only**. It does not operate vehicles, hold funds, certify food safety, or process waste.

## Status

| Milestone | Scope | State |
|---|---|---|
| 1 | Scaffold, Tailwind, shadcn/ui, next-intl (bn + en), Supabase clients, proxy, env template | ✅ Done |
| 2 | Migrations, enums, tables, PostGIS, indexes, `listings_public`, RLS, `is_admin()`, `get_listing_detail()`, seed | ✅ Done |
| 3 | Auth, roles, profiles, deactivation (FR-1.x) | ✅ Done |
| 4 | Listings wizard, photos, lifecycle, `ml/` seam (FR-3.x) | ⏳ |
| 5 | Browse, filters, distance, map, saved interests (FR-4.1–4.4) | ⏳ |
| 6 | Requests, messaging, pickups, state machine (FR-5.x, FR-6.1–6.3) | ⏳ |
| 7 | Payments (mock), receipts (FR-7.1–7.3) | ⏳ |
| 8 | Ratings, reviews, reporting (FR-8.x) | ⏳ |
| 9 | Notifications, preferences, realtime, cron (FR-9.x, FR-3.5, FR-6.2) | ⏳ |
| 10 | Impact tracking (FR-10.x) | ⏳ |
| 11 | Admin dashboard and audit log (FR-11.1–11.3) | ⏳ |
| 12 | Organisation verification and badges (FR-2.x) | ⏳ |
| 13 | Polish, accessibility, full traceability, deployment guide | ⏳ |

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript strict |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix) |
| Database | Supabase Postgres + PostGIS |
| Auth / Storage / Realtime | Supabase (`@supabase/ssr`, cookie sessions) |
| Hosting | Vercel |
| Maps | Leaflet + OpenStreetMap, Nominatim geocoding (server-side, rate-limited) |
| Forms | react-hook-form + zod |
| i18n | next-intl, Bangla (default) and English |
| Dates | date-fns |
| Tests | Node's built-in test runner (`node:test`) with native TypeScript |

## Getting started

Requirements: Node 20.9+ to build and run the app. Node 22.18+ to run the tests, which use Node's native TypeScript support.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase keys
npm run dev                  # http://localhost:3000
```

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit and database tests in `tests/` |

### Supabase Auth settings

In the Supabase dashboard under **Authentication → URL Configuration**:

- **Site URL**: your deployment URL (for local work, `http://localhost:3000`).
- **Redirect URLs**: add `http://localhost:3000/**` and `https://<your-domain>/**`. For Vercel preview deployments, also add `https://*-<team>.vercel.app/**`.

Sign-up confirmation and password-reset e-mails land on [`/auth/confirm`](src/app/auth/confirm/route.ts). That route accepts both Supabase's default PKCE link (`?code=`) and the token-hash link that Supabase recommends for server-side rendering. To use the token-hash style, set the **Confirm signup** template link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`, and the **Reset password** template link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`.
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` from the migrations |

### Database

The schema lives in hand-written SQL migrations in [`supabase/migrations/`](supabase/migrations/), applied in numeric order:

| File | Contents |
|---|---|
| `001_extensions.sql` | PostGIS and pgcrypto in the `extensions` schema |
| `002_enums.sql` | All enums (mirrored in [`src/lib/domain.ts`](src/lib/domain.ts), with a compile-time check that they match) |
| `003_profiles_roles.sql` | `profiles`, `user_roles`, `organisations`, `is_admin()` and role helpers, sign-up trigger |
| `004_listings.sql` | `listings`, `listing_photos`, `saved_interests`, GIST indexes |
| `005_exchange.sql` | `requests`, `messages`, `pickups`, `transactions`, `reviews` and their integrity triggers |
| `006_trust_notifications_impact.sql` | `reports`, `notifications`, `notification_preferences`, `impact_records`, `admin_audit_log` |
| `007_public_views.sql` | `listings_public`, `profiles_public`, `get_listing_detail()`, landing-page counters |
| `008_rls.sql` | Grants and RLS policies for every table |
| `009_storage.sql` | `listing-photos` (public) and `verification-docs` (private) buckets and policies |

[`supabase/seed.sql`](supabase/seed.sql) creates eight demo accounts (password `WasteLoop#2026`) and 20 listings across Dhaka, in every stream, offer type and status. It also includes completed exchanges with reviews, a paid sale with a receipt, impact records, a verification queue and an open report.

| Account | Role |
|---|---|
| `admin@wasteloop.test` | Administrator |
| `shapla@wasteloop.test`, `nirob@wasteloop.test`, `utsob@wasteloop.test` | Providers |
| `sobuj@wasteloop.test` | Farmer |
| `biopower@wasteloop.test` | Waste-to-energy plant |
| `purnota@wasteloop.test` | Recycler |
| `annadan@wasteloop.test` | Charity (also a provider) |

**How address privacy works (SRS §4.4).** The exact pickup address and point are stored on `listings`, and RLS lets only the listing owner, a taker whose request was accepted, and admins read those rows. Everyone else reads `listings_public`, which omits the address and snaps the pickup point to a ~500 m grid, or calls `get_listing_detail()`, which returns the exact address only to those three viewers. [`tests/db/privacy.test.ts`](tests/db/privacy.test.ts) proves this for anonymous, wrong-user and authorised callers.

**How the database is tested.** `npm test` applies the real migrations and seed to PGlite, Postgres 18 compiled to WebAssembly, on top of a small shim of the schemas Supabase provides ([`tests/db/supabase-shim.sql`](tests/db/supabase-shim.sql)). Each query runs as an anonymous visitor, as a specific signed-in user, or as the table owner, the same way PostgREST runs it, with RLS in force. No Docker or Supabase project is needed.

### Environment variables

All variables are listed and explained in [`.env.example`](.env.example). Only `NEXT_PUBLIC_*` values reach the browser. `SUPABASE_SERVICE_ROLE_KEY` is read only by [`src/lib/supabase/admin.ts`](src/lib/supabase/admin.ts), which imports `server-only`, so importing it from client code fails the build.

## Project structure

```
src/
  app/            (public)/ (app)/ (admin)/ api/   route groups
  components/     ui/ (shadcn)  layout/  listings/  map/  exchange/  admin/
  i18n/           locale config and next-intl request config
  lib/
    supabase/     client.ts  server.ts  middleware.ts  admin.ts  database.types.ts
    design/       streams.ts (WASTE_STREAM_STYLES)  status.ts
    domain.ts     enums mirrored from Postgres
    routes.ts     route guard rules shared by the proxy and layouts
  messages/       en.json  bn.json
  proxy.ts        session refresh and route guard (Next 16's renamed middleware)
supabase/
  migrations/     NNN_*.sql
  seed.sql
scripts/          gen-db-types.ts (types from migrations)
tests/            unit tests; db/ runs migrations + RLS tests in PGlite
```

## Visual design

The palette in [`src/app/globals.css`](src/app/globals.css) is the only set of colours the app uses. The default Tailwind palette is removed (`--color-*: initial`), so classes like `bg-green-500` produce no CSS. Each colour has one job:

| Colour | Job |
|---|---|
| Loop green | Brand, primary actions, verified badges, success, impact figures |
| Deep navy | Header, nav, footer, admin shell, body text, dark-mode base |
| Burgundy | Money only: prices, for-sale badges, payment flow, receipts |
| Warm grey | Borders, secondary and muted text, disabled and expired items |
| Paper | Page background (white is reserved for raised cards) |
| Harvest amber | Reserved and pending states only |
| Stream colours | Listing type chips and map pins only, via [`WASTE_STREAM_STYLES`](src/lib/design/streams.ts) |

Fonts: Inter for Latin script and Hind Siliguri for Bangla (applied on `:lang(bn)`), weights 400 and 500 only.

## Requirement traceability

Every FR ID from the SRS maps to the file(s) that implement it. This table grows each milestone and is completed in milestone 13.

| FR | Requirement | Implemented in |
|---|---|---|
| §4.2 | Usability: mobile-first, large touch targets, plain language | [`src/components/ui/button.tsx`](src/components/ui/button.tsx) (44px default), [`src/components/layout/`](src/components/layout/) |
| §4.3 | Reliability: failures degrade, not crash | `error.tsx` + `loading.tsx` in each route group, [`src/app/global-error.tsx`](src/app/global-error.tsx) |
| §4.7 | Bangla and English, Bangla default | [`src/i18n/`](src/i18n/), [`src/messages/`](src/messages/), [`src/components/layout/language-switcher.tsx`](src/components/layout/language-switcher.tsx), [`tests/i18n.test.ts`](tests/i18n.test.ts) |
| §4.4 | Exact address revealed only after acceptance; coarse public location | [`004_listings.sql`](supabase/migrations/004_listings.sql), [`007_public_views.sql`](supabase/migrations/007_public_views.sql) (`listings_public`, `get_listing_detail`), [`008_rls.sql`](supabase/migrations/008_rls.sql), [`tests/db/privacy.test.ts`](tests/db/privacy.test.ts) |
| FR-1.1 | Registration, login, logout, password reset | [`src/lib/actions/auth.ts`](src/lib/actions/auth.ts), [`src/app/(public)/(auth)/`](src/app/(public)/(auth)/), [`src/components/auth/`](src/components/auth/), [`src/app/auth/confirm/route.ts`](src/app/auth/confirm/route.ts), [`src/lib/validation/auth.ts`](src/lib/validation/auth.ts), [`tests/validation.test.ts`](tests/validation.test.ts), [`tests/db/account.test.ts`](tests/db/account.test.ts) |
| FR-1.2 | Multiple roles per user, chosen at sign-up and editable; admin never self-granted | [`003_profiles_roles.sql`](supabase/migrations/003_profiles_roles.sql) (`user_roles`, `handle_new_user`), [`src/components/account/role-picker.tsx`](src/components/account/role-picker.tsx), [`src/lib/actions/account.ts`](src/lib/actions/account.ts) (`updateRolesAction`), [`tests/db/integrity.test.ts`](tests/db/integrity.test.ts) |
| FR-1.x | Profile editing; language saved to the profile and restored at login | [`src/app/(app)/settings/page.tsx`](src/app/(app)/settings/page.tsx), [`src/components/settings/`](src/components/settings/), [`src/app/actions/locale.ts`](src/app/actions/locale.ts), [`src/lib/validation/profile.ts`](src/lib/validation/profile.ts) |
| FR-1.x | Deactivation and data-removal request | [`010_account.sql`](supabase/migrations/010_account.sql), [`src/lib/actions/account.ts`](src/lib/actions/account.ts) (`deactivateAccountAction`), [`src/components/settings/deactivate-account.tsx`](src/components/settings/deactivate-account.tsx), [`tests/db/account.test.ts`](tests/db/account.test.ts) |
| — | Role-aware dashboard | [`src/app/(app)/dashboard/page.tsx`](src/app/(app)/dashboard/page.tsx) |
| FR-5.3 | Messaging opens only after acceptance | [`005_exchange.sql`](supabase/migrations/005_exchange.sql) (`is_accepted_request_party`), [`008_rls.sql`](supabase/migrations/008_rls.sql), [`tests/db/privacy.test.ts`](tests/db/privacy.test.ts) |
| FR-6.1 | Pickup inside the availability window | [`005_exchange.sql`](supabase/migrations/005_exchange.sql) (`pickups_validate_window`), [`tests/db/integrity.test.ts`](tests/db/integrity.test.ts) |
| FR-7.2 | Sequential receipt numbers | [`005_exchange.sql`](supabase/migrations/005_exchange.sql) (`receipt_number_seq`, `transactions_validate`) |
| FR-7.3 | Free and donation listings never charged | [`004_listings.sql`](supabase/migrations/004_listings.sql) (`listings_price_only_for_sale`), [`005_exchange.sql`](supabase/migrations/005_exchange.sql) (`transactions_only_for_sale` + composite FK), [`tests/db/integrity.test.ts`](tests/db/integrity.test.ts) |
| FR-11.3 | Append-only admin audit log | [`006_trust_notifications_impact.sql`](supabase/migrations/006_trust_notifications_impact.sql), [`008_rls.sql`](supabase/migrations/008_rls.sql), [`tests/db/integrity.test.ts`](tests/db/integrity.test.ts) |
| — | RLS on every table; `is_admin()` from `user_roles` | [`008_rls.sql`](supabase/migrations/008_rls.sql), [`src/lib/auth.ts`](src/lib/auth.ts), [`tests/db/integrity.test.ts`](tests/db/integrity.test.ts) |

## Deferred — Phase 2 (ML)

These SRS requirements are deliberately not built in this phase. Each one gets a stub in `src/lib/ml/` (milestone 4) that is already called from its real code path, returns `null` today, and has a working rule-based fallback, so turning on its flag is the only change needed.

| FR | Feature | Fallback in this phase |
|---|---|---|
| FR-3.6 | Photo → waste category | Manual category picker |
| FR-3.7 | Quantity / resource-value estimation | Provider enters quantity |
| FR-3.8 | Freshness indicator | Availability window only |
| FR-4.5 | Personalised recommendations | Sort by distance, then posting freshness |
| FR-4.6 | Supply/demand forecasting | Not shown |
| FR-6.4 | Route clustering | Left out of the UI |
| FR-6.5 | Completion-likelihood score | Not shown |
| FR-7.4 | Fair price suggestion | Recent median price per kg for the material (≥ 5 samples), otherwise nothing |
| FR-11.4 | Anomaly detection | Admin review of reports |
| FR-11.5 | Content screening | Manual user reports only |

## Decisions

Choices made where the brief was ambiguous or the toolchain had changed.

1. **Next.js 16 `proxy.ts` instead of `middleware.ts`.** Next 16 renamed the middleware convention to Proxy. [`src/proxy.ts`](src/proxy.ts) delegates to [`src/lib/supabase/middleware.ts`](src/lib/supabase/middleware.ts), so the file layout in the brief still holds.
2. **Cache Components is off.** Nearly every route depends on the session cookie and the locale cookie (even `<html lang>`). Under Cache Components every such read must sit behind a Suspense boundary. Request-time rendering is simpler here and just as fast. Heavy pages still stream with Suspense.
3. **Tailwind v4: tokens mapped in CSS, not `tailwind.config.ts`.** Tailwind v4 configures the theme in CSS. The `wl` colours are declared in `@theme` in `globals.css`, which produces exactly the class names the brief asks for (`bg-wl-paper`, `text-wl-ink`, …). There is no `tailwind.config.ts`.
4. **shadcn/ui semantic tokens are aliases.** shadcn components use names like `bg-primary` and `border-border`. These are mapped onto `wl` tokens in `globals.css`, so the components follow the palette without forking every file. The secondary (outline) button uses `wl-grey-200` border and `wl-grey-700` text as specified, and a `money` variant exists for payment actions.
5. **Dark-mode greys and status colours.** The brief's `.dark` block does not redefine the grey scale, amber, red or success colours. On navy, `grey-700` text and amber/red states would be unreadable. The dark block remaps them to values already in the dark palette, or `color-mix()` blends of existing tokens. No new hues are introduced.
6. **Bold maps to weight 500.** Only weights 400 and 500 are loaded, so `font-bold` and `font-semibold` render at 500.
7. **No English fallbacks inside shadcn components.** The dialog and sheet close buttons take a required `closeLabel` prop, so an untranslated "Close" cannot reach Bangla screen readers.
8. **Locale lives in a cookie (`NEXT_LOCALE`), not the URL.** Bangla is the default. The switcher sets the cookie, and from milestone 3 also saves `profiles.locale`, which is restored on login.
9. **next-intl alias instead of its plugin.** `next.config.ts` sets the `next-intl/config` alias directly. For the features used here, that alias is all `createNextIntlPlugin` adds, but the plugin eagerly loads the native `@swc/core` binary, which Windows Application Control blocks on the development machine.
10. **Tests use `node:test` rather than Vitest.** Vitest 5 depends on the native `rolldown` binary (blocked by the same policy) and its WebAssembly fallback cannot read non-ASCII project paths. Node's built-in runner with native TypeScript type stripping needs no native code. [`tests/support/resolve-hooks.mjs`](tests/support/resolve-hooks.mjs) adds the `@/` alias. `tsconfig.json` sets `erasableSyntaxOnly` and `verbatimModuleSyntax` so that the compiler rejects TypeScript that Node cannot strip.
11. **Non-admins get a 404 from `/admin`, not a 403.** The `(admin)` layout calls `is_admin()` and returns "not found", so admin pages are not advertised.
12. **Public read models are owner-privileged views.** `listings_public` and `profiles_public` are intentionally not `security_invoker`. They must show safe columns of rows that RLS hides from the caller. Supabase's linter will flag them as "security definer views"; that is expected. They never select the exact address, exact point, phone or e-mail.
13. **A request has no `completed` status.** The `request_status` enum in the brief stops at `accepted`. An exchange is complete when its pickup reaches `completed` (both handover confirmations). The request stays `accepted`.
14. **Two reminder columns.** `pickups` has `reminder_24h_sent_at` and `reminder_2h_sent_at` instead of a single `reminder_sent_at`, because FR-6.2 sends reminders at both 24 h and 2 h.
15. **Admins cannot read private messages.** The brief says messages are visible only to the two parties, so admin access to message bodies is excluded. Admins still see requests, pickups and payments.
16. **FR-7.3 is declarative.** `transactions.offer_type` is pinned to `for_sale` by a CHECK constraint and tied to the listing by a composite foreign key on `(listing_id, offer_type)`. A charge on a free or donation listing cannot be stored at all, and a listing with a payment cannot be switched to free.
17. **`price_amount` is the price of the whole listing,** not a per-unit price. Transactions must equal it exactly.
18. **Supporting enums.** `quantity_unit`, `report_target`, `report_status` and `impact_side` are enums too, so the database rejects invalid values.
19. **One organisation per user,** submitted for verification by its owner. Editing an approved organisation's legal details sends it back to `pending`.
20. **Expired listings disappear immediately.** `listings_public` hides `available` listings whose window has passed, even before the hourly expiry cron flips them to `expired`.
21. **Writes deferred to their milestones, with the DB already locked down.** Clients have no write access to `transactions` (milestone 7), `impact_records` (milestone 6) or other users' `notifications` (milestone 9). Request and pickup *transition* guards (who may accept, withdraw, confirm) are added as triggers with the state machine in milestone 6.
22. **Database types are generated from the migrations.** No Supabase project or CLI is required: `npm run db:types` ([`scripts/gen-db-types.ts`](scripts/gen-db-types.ts)) introspects the migrated PGlite database and writes the same shape as `supabase gen types`. Table-function result fields are typed nullable, because `get_listing_detail()` deliberately returns `NULL` for withheld fields.
23. **Trusted-operation flag.** `SECURITY DEFINER` functions that must bypass the owner-facing listing guard (for example, the view counter) call `begin_trusted_op()`, which sets a transaction-local setting. Clients cannot execute it or set the flag through the API.
24. **`/auth/confirm` is a Route Handler.** The brief reserves Route Handlers for webhooks and cron. An e-mail confirmation or recovery link can only issue a GET, so this auth callback is the one exception. Every other auth step is a Server Action.
25. **Validation messages are codes, not text.** Zod schemas in `src/lib/validation/` report codes such as `emailInvalid`. The same schema runs in the browser and in the Server Action, and the UI renders `validation.<code>` in the active language. Server Actions likewise return `formErrors.<code>`, never raw Supabase messages, which are English-only and can leak details.
26. **No account enumeration.** Registration and "forgot password" show the same "check your inbox" result whether or not the e-mail address already has an account.
27. **Deactivation is reversible; erasure is not.** Deactivating pauses the user's live listings, withdraws their pending requests, hides their profile and signs them out. Logging in again reactivates the account (paused listings stay paused). Ticking "delete my data" also files a `data_removal_requests` row, which an admin actions in milestone 11 by deleting the auth user. That deletion cascades, and the request row survives with `user_id` set to `NULL` as the compliance record. Suspended users are signed straight back out at login.
28. **Typed confirmation for deactivation** accepts either `DEACTIVATE` or `নিষ্ক্রিয়`, so it works whatever keyboard the user has.
29. **Phone numbers** must be Bangladeshi mobiles (`01[3-9]XXXXXXXX`, with or without `+880`), and are stored normalised as `+8801XXXXXXXXX`.
30. **Theme preference is per browser.** The light / dark / system choice is stored by `next-themes` in the browser. Language follows the user across devices via `profiles.locale`, because it also controls the language of their notifications.
31. **Profile coordinates come with the map.** The settings page edits the text area name ("Mirpur, Dhaka"). Picking the coarse point on a map (`profiles.approx_point`) arrives with the Leaflet map in milestone 5.

## Payments

_Written in milestone 7: the `PaymentProvider` interface, the mock provider, and where SSLCommerz or bKash would plug in._

## Deployment (Vercel + Supabase)

_Written in milestone 13._
