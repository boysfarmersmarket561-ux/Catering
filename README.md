# Catering — The Boys Farmers Market

A catering menu and quote-request web app for **The Boys Farmers Market**, a gourmet market in Delray Beach, FL.

Customers browse the full catering menu (231 items across 8 categories), add items to a quote cart at the price tier they want, and submit an event enquiry with their details. The quote is saved to a real database and emailed to the business and the customer. Staff sign in to an admin portal to manage the catalogue (with photos and prices), review incoming quotes, manage other staff accounts, and edit site settings — all without a code deploy.

---

## Table of contents

- [Status](#status)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Database](#database)
- [Admin portal](#admin-portal)
- [Email](#email)
- [Testing](#testing)
- [Deployment](#deployment)
- [Known limitations / operational notes](#known-limitations--operational-notes)
- [Project layout](#project-layout)

---

## Status

**Production-ready.** The customer-facing site, the quote flow, and the admin portal all run against a real backend on **Supabase** (Postgres + Auth + Storage). Nothing customer-facing or admin-facing depends on browser `localStorage` for persistence anymore — the only remaining client-side storage is the shopping cart itself (see [Known limitations](#known-limitations--operational-notes) for the honest caveats that remain).

---

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | [TanStack Start](https://tanstack.com/start) v1 (SSR, file-based routing) |
| Routing | TanStack Router — file-based, routes auto-generated into `src/routeTree.gen.ts` |
| UI | React 19 |
| Build | Vite 8 |
| Server output | Nitro (Node preset) |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Components | shadcn/ui on Radix primitives (`src/components/ui/`) |
| Data fetching / caching | React Query v5 |
| Forms / validation | react-hook-form + zod |
| Backend | Supabase — Postgres, Auth, Storage |
| Email | Resend (default) or Microsoft Graph, selected by env var |
| Testing | Vitest |
| Deployment | Vercel |

---

## Architecture

The browser **never talks to Supabase directly** — there is no Supabase client shipped to the client bundle. Every read and write goes through **TanStack Start server functions** (`src/server/*.ts`), which use the Supabase **secret key** server-side only. This is the sole privilege boundary the app relies on.

As defence in depth, **Row Level Security is enabled on every table** (`categories`, `sections`, `items`, `price_tiers`, `quotes`, `quote_lines`, `settings`) with **no policies defined** — i.e. deny-all. Even if a client somehow obtained a publishable-key connection, it could read or write nothing. All real access happens through the secret-key server functions, which bypass RLS by design.

Admin sessions are real **Supabase Auth** users. Sign-in issues HTTP-only, `SameSite=Lax` cookies (access + refresh token); every admin server function calls `requireAdmin()`, which validates the access cookie and transparently refreshes it from the refresh cookie when expired. There is no client-side passcode or `sessionStorage` flag anywhere in this version.

---

## Data model

The catalogue is relational: **categories → sections → items → price tiers**, each level carrying its own `sort_order` and `active` flag, plus optional `image_path` (items and categories) for photos stored in Supabase Storage.

Quotes are a separate, independent record: **`quotes`** (customer info, reference, status, `email_status`) has many **`quote_lines`**. Each quote line **snapshots** the item name, category name, section name, tier label, unit, and unit amount *at the time of submission* — it does not just point at the item. `quote_lines.item_id` is a nullable foreign key with **`ON DELETE SET NULL`**, so deleting or renaming a catalogue item later never corrupts historical quotes: the line keeps its snapshot text even after the item is gone. Category/section/item deletion cascades (`ON DELETE CASCADE`) down through the catalogue tree.

There is a single-row **`settings`** table (`id = 1`) holding store hours, social links, the notification email address, and the site origin used by the sitemap.

---

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

The dev server starts on **http://localhost:3000** (Vite will pick the next free port if 3000 is taken).

### Environment variables

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL. |
| `SUPABASE_SECRET_KEY` | Server-only Supabase secret key (service role). Never sent to the client. |
| `SUPABASE_PUBLISHABLE_KEY` | Public Supabase key. Currently unused by any client code but kept for parity with `.env.example` / future direct-client use. |
| `EMAIL_PROVIDER` | `resend` or `graph` — selects the `EmailSender` implementation. |
| `EMAIL_FROM` | From-address used by the Resend sender. |
| `RESEND_API_KEY` | API key for Resend. Required when `EMAIL_PROVIDER=resend`. |
| `SITE_ORIGIN` | Production origin (e.g. `https://boysfarmersmarket.com`), used as a fallback for the sitemap when `settings.site_origin` isn't set. |
| `AZURE_TENANT_ID` | Microsoft Entra tenant ID, for Graph email. |
| `AZURE_CLIENT_ID` | App registration client ID, for Graph email. |
| `AZURE_CLIENT_SECRET` | App registration client secret, for Graph email. |
| `GRAPH_SENDER_MAILBOX` | Mailbox to send-as via Microsoft Graph. |

`.env*` is gitignored.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build (Nitro server output to `.output/`) |
| `npm run preview` | Preview the production build locally |
| `npm test` | Runs unit tests (`vitest run`) |
| `npm run seed` | Imports `src/data/menu.json` into a fresh database |
| `npm run lint` | ESLint across the whole project |
| `npm run format` | Prettier write |

> **`npm run lint` lints the whole repo and is slow (minutes).** Prefer `npx eslint <files>` on just the files you touched during day-to-day work.

---

## Database

Migrations live in `supabase/migrations/`. Apply them with:

```bash
npx supabase db push
# or, if you don't have the DB password to hand:
npx supabase db query --linked -f supabase/migrations/<file>.sql
```

`npm run seed` (`scripts/seed-menu.ts`) imports `src/data/menu.json` — the historical source of the catalogue — into whatever database `SUPABASE_URL`/`SUPABASE_SECRET_KEY` point at. It is **safely re-runnable**: it wipes and reimports the catalogue tables (categories/sections/items/price_tiers) every time, but it **never touches `quotes` or `quote_lines`**. Only run it against a database you intend to reset the catalogue on.

---

## Admin portal

Sign in at **`/admin`**. There is no public sign-up — accounts are invite-only:

- Create additional staff accounts from the **Staff** tab (needs an existing admin session).
- Create the very first admin account directly in the Supabase dashboard (Authentication → Users), or with the Supabase CLI/API using the secret key.

The portal has four tabs:

| Tab | What it does |
| --- | --- |
| **Catalogue** | Full CRUD over categories, sections, items, and price tiers, including photo upload (Supabase Storage) and drag-to-reorder. |
| **Quotes** | Inbox of submitted quote requests, with an "Email failed" badge when the notification email didn't go out (the quote itself is still saved — see [Email](#email)). |
| **Staff** | Add, disable, delete, and reset the password of staff accounts. |
| **Settings** | Store hours, social links, notification email, and site origin. |

Staff management has guardrails: you cannot disable or delete your own account, and you cannot disable or delete the last remaining active admin account — both are enforced server-side, not just in the UI.

---

## Email

Email sending is behind a small `EmailSender` interface (`src/lib/email/types.ts`) with two implementations, chosen at runtime by `EMAIL_PROVIDER`:

- **Resend** (`src/lib/email/resend.ts`) — the default. Resend's sandbox sender (`onboarding@resend.dev`) only delivers to the email address on the Resend account itself; sending to arbitrary customer addresses requires **verifying your own sending domain** in Resend and setting `EMAIL_FROM` to an address on it.
- **Microsoft Graph** (`src/lib/email/graph.ts`) — set up is documented in [`docs/runbooks/azure-email-setup.md`](docs/runbooks/azure-email-setup.md).

A quote is **always saved to the database before email is attempted**. If sending the notification or confirmation email fails for any reason, the quote is still committed with `email_status = "failed"`, which surfaces as an **"Email failed" badge** in the admin Quotes tab — so a mail outage can never silently lose an order, only delay the business finding out about it by email.

---

## Testing

```bash
npm test
```

runs the unit test suite (33 tests across 9 files as of this writing) — no external services required.

Separately, **`tests/integration/db.test.ts`** exercises real schema behaviour (cascades, quote-line snapshot survival, `quotes.reference` uniqueness) against a **local** Supabase instance. These are **opt-in** and skip cleanly (via `describe.skipIf`) when the required env vars aren't set, so `npm test` stays green without Docker:

```bash
npx supabase start   # requires Docker
TEST_SUPABASE_URL=http://127.0.0.1:54321 TEST_SUPABASE_SECRET_KEY=<from `supabase start` output> npx vitest run
```

These env vars are deliberately named `TEST_*`, distinct from `SUPABASE_URL`/`SUPABASE_SECRET_KEY`, so the production credentials can never accidentally point the integration tests at the live database.

---

## Deployment

Deployed on **Vercel**. Set every environment variable from [Getting started](#getting-started) in the Vercel project settings — there is no `vercel.json`; framework defaults are used (Node 24.x, `tanstack-start` framework preset).

`SITE_ORIGIN` (or the `site_origin` column in the `settings` table, which takes precedence) drives the absolute URLs emitted by `/sitemap.xml`.

---

## Known limitations / operational notes

Kept short and honest — these are real, current, and worth knowing before you hit an incident:

- **Catalogue reorder isn't transactional.** `reorder()` in `src/server/admin-catalog.ts` writes each row's new `sort_order` sequentially. If it fails partway through, the affected rows are left in a partially-applied order — this self-corrects the next time that list is reordered, but a mid-failure can leave things visually out of order until then.
- **The quote rate limiter is per-server-instance, in memory** (`src/lib/rate-limit.server.ts`), not distributed. On a multi-instance deployment each instance tracks its own counters, so the effective limit scales with instance count rather than being a hard global cap.
- **Resend requires domain verification before real customers can receive mail.** Until a sending domain is verified, only the Resend account owner's own address will actually receive email — everyone else's `send()` calls will fail (and get recorded as `email_status = "failed"`, per the design above — the quote itself is never lost).
- **The old admin passcode from the previous prototype is in git history.** It was never used by this version's auth, but must be treated as public and should not be reused anywhere.

---

## Project layout

```
src/
├── routes/                    # File-based routes
│   ├── __root.tsx             # Root layout + site chrome
│   ├── index.tsx               # Home
│   ├── menu.tsx                # Menu browser page
│   ├── quote.tsx                # Cart + quote form
│   ├── contact.tsx              # Contact details
│   ├── admin.tsx                 # Admin portal (auth-gated)
│   └── sitemap[.]xml.ts          # Sitemap server handler
├── components/
│   ├── menu-browser.tsx        # Search, filter, add-to-quote
│   ├── cart-indicator.tsx
│   ├── site-chrome.tsx          # Header, nav, footer
│   ├── admin/                   # Catalogue tree, quote inbox, staff manager, settings form
│   └── ui/                      # shadcn/ui primitives
├── data/
│   ├── menu.json                # Historical catalogue source, used by scripts/seed-menu.ts
│   └── menu.ts                  # Types + `baseMenu` (business info)
├── lib/
│   ├── menu-store.ts            # Cart state (localStorage)
│   ├── catalog-types.ts         # Shared catalogue types + formatters
│   ├── admin-auth.server.ts     # Admin session cookies
│   ├── email/                   # EmailSender + Resend/Graph implementations
│   ├── rate-limit.server.ts     # In-memory per-instance rate limiting
│   ├── error-capture.ts         # SSR error capture
│   └── error-page.ts            # Branded 500 page
├── server/                      # TanStack Start server functions (catalog, quotes, admin-*)
├── server.ts                    # SSR entry with error handling
├── start.ts                     # Request middleware
└── styles.css                   # Tailwind v4 + theme tokens

supabase/
└── migrations/                  # Schema, RLS, indexes

scripts/
└── seed-menu.ts                 # Seeds a fresh database from src/data/menu.json

tests/
├── *.test.ts                    # Unit tests
└── integration/db.test.ts       # Opt-in DB integration tests (needs local Supabase)
```

---

## Business details

**The Boys Farmers Market** — Gourmet Catering
14378 S. Military Trail, Delray Beach, FL 33484
(561) 496-0810 Ext. 1 · [boysfarmersmarket.com](https://boysfarmersmarket.com)
