# WasteLoop

A multi-stream food and organic waste exchange marketplace, built for CSE 412 against the WasteLoop SRS.

WasteLoop connects **providers** (households, restaurants, grocery stores, caterers, event organisers) who have surplus food or organic waste with **takers** (farmers, waste-to-energy plants, recyclers/buyers, charities) who can use it.

> WasteLoop is a **connection and coordination platform only**. It does not operate vehicles, hold funds, certify food safety, or process waste.

## Status

| Milestone | Scope | State |
|---|---|---|
| 1 | Scaffold, Tailwind, shadcn/ui, next-intl (bn + en), Supabase clients, proxy, env template | ✅ Done |
| 2 | Migrations, enums, tables, PostGIS, indexes, `listings_public`, RLS, `is_admin()`, `get_listing_detail()`, seed | ⏳ |
| 3 | Auth, roles, profiles, deactivation (FR-1.x) | ⏳ |
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
| `npm test` | Unit tests in `tests/` |

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
tests/
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
11. **`(admin)` route group arrives in milestone 2.** Its layout must call `is_admin()`, which is defined by the milestone 2 migrations. Until then the proxy still redirects anonymous users away from `/admin/*`, and no admin pages exist.

## Payments

_Written in milestone 7: the `PaymentProvider` interface, the mock provider, and where SSLCommerz or bKash would plug in._

## Deployment (Vercel + Supabase)

_Written in milestone 13._
