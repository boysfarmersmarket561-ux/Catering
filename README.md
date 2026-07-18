# Catering — The Boys Farmers Market

A catering menu and quote-request web app for **The Boys Farmers Market**, a gourmet market in Delray Beach, FL.

Customers browse the full catering menu (231 items across 8 categories), add items to a quote cart at the price tier they want, and submit an event enquiry with their details. Staff get an admin console for editing menu copy and pricing without a code deploy.

---

## Table of contents

- [Status](#status)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Routes](#routes)
- [The menu data model](#the-menu-data-model)
- [How the quote flow works](#how-the-quote-flow-works)
- [Admin console](#admin-console)
- [Architecture notes](#architecture-notes)
- [Known limitations](#known-limitations)
- [Deployment](#deployment)
- [Project layout](#project-layout)

---

## Status

**Working prototype / front-end complete.** The full customer-facing experience is built and functional. There is **no backend** — no database, no API routes, no server functions. All state lives in the browser's `localStorage`.

This matters most for the quote flow. Read [Known limitations](#known-limitations) before putting this in front of real customers; there is one issue there that will lose orders.

---

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | [TanStack Start](https://tanstack.com/start) v1 (SSR, file-based routing) |
| Routing | TanStack Router — file-based, routes auto-generated into `src/routeTree.gen.ts` |
| Build | Vite 8 |
| Server output | Nitro (Node preset) |
| UI | React 19 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Components | shadcn/ui on Radix primitives (`src/components/ui/`) |
| Icons | lucide-react |
| Toasts | sonner |
| Language | TypeScript 5.8 |

The app is **server-rendered** — `src/server.ts` is a custom SSR entry that wraps the TanStack handler with error capture and a branded 500 page.

---

## Getting started

```bash
npm install
npm run dev
```

The dev server starts on **http://localhost:3000** (Vite will pick the next free port if 3000 is taken).

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build (Nitro server output to `.output/`) |
| `npm run build:dev` | Production build in development mode |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint across the project |
| `npm run format` | Prettier write |

### Environment

No environment variables are required to run the app locally. `.env.local` currently holds only `VERCEL_OIDC_TOKEN`, which is injected by Vercel tooling and is not read anywhere in application code.

`.env*` is gitignored and has never been committed.

---

## Routes

| Path | Page | What it does |
| --- | --- | --- |
| `/` | Home | Hero with business tagline, headline stats, and a grid of the 8 categories. Each card deep-links into `/menu` at that category's anchor. |
| `/menu` | Menu browser | The core experience. Full catalogue with live text search and category filtering. Each item shows its price tiers; clicking a tier adds that line to the quote cart. |
| `/quote` | Quote builder | Cart review (adjust quantity, remove lines, running subtotal) plus an event-details form. Submitting produces a reference number and offers "email a copy" and "print" actions. |
| `/contact` | Contact | Business details — address, phone (click-to-call), fax, bakery email, store hours — plus an embedded Google Map and an "about the market" blurb. |
| `/admin` | Admin console | Passcode-gated menu editor and quote inbox. Marked `noindex`, and disallowed in `robots.txt`. |
| `/sitemap.xml` | Sitemap | Server handler emitting an XML sitemap for the four public routes. |

Site chrome (header, nav, footer, cart indicator) lives in `src/components/site-chrome.tsx` and is mounted from the root route.

---

## The menu data model

The catalogue is a static JSON file, `src/data/menu.json`, typed and re-exported through `src/data/menu.ts`.

The hierarchy is **category → section → item → price tiers**:

```ts
MenuData
  business: { name, tagline, address, phone, fax, website, bakery_email }
  categories: MenuCategory[]
    name, page?, sections: MenuSection[]
      name, note?, items: MenuItem[]
        name, description?, size?, serves?, prices: Price[]
          label, amount, unit
```

A single item can carry **multiple price tiers** — e.g. a platter offered in small/medium/large — and each tier is independently addable to the cart. Tiers are tracked by `priceIndex`, so the same item at two different sizes stays as two separate cart lines.

### Price units

`platter` · `per_person` · `per_lb` · `per_foot` · `each` · `per_kabob` · `per_pastry` · `per_pieces` · `unpriced`

**71 of the 231 items carry no price** and render as **"Price on request"**. They can still be added to a quote (with a null unit amount), are excluded from the subtotal, and set a `hasUnpriced` flag that the UI surfaces next to the total. In the data these are represented as an empty `prices` array rather than the `unpriced` unit — that union member is currently unused by the catalogue, though the admin editor offers it.

### Current catalogue

| Category | Sections | Items |
| --- | ---: | ---: |
| Fresh Fruit | 5 | 15 |
| Fresh Vegetable Platters | 2 | 6 |
| Cheese | 2 | 5 |
| Wine Menu | 8 | 24 |
| Appetizers & Platters | 8 | 42 |
| Main Entrees | 8 | 57 |
| Seafood | 2 | 7 |
| Desserts | 10 | 75 |
| **Total** | **45** | **231** |

Items are identified by a stable slug of `category__section__name` (`itemId()` in `src/data/menu.ts`), which is what the cart and the admin overlay key against.

---

## How the quote flow works

1. **Browse** — customer searches or filters on `/menu`.
2. **Add** — clicking a price tier calls `addLine()`, writing to `localStorage` under `boys-quote-cart-v1`. The header cart indicator updates live via a custom `boys-cart-updated` event.
3. **Review** — `/quote` lists the lines with quantity steppers and a running subtotal. Unpriced items are held out of the maths.
4. **Submit** — the form requires name and email, and rejects an empty cart. On submit, `saveQuote()` writes the request to `localStorage` under `boys-quote-requests-v1` and the customer sees a confirmation with an 8-character reference.
5. **Follow-up** — the confirmation screen offers a `mailto:` link that pre-fills the full order as an email body to the bakery address, plus a print button.

> **Important:** step 4 is local-only. See [Known limitations](#known-limitations).

---

## Admin console

`/admin` provides two tabs:

- **Menu editor** — search/flatten all 231 items, edit name, description, size, serves, and price tiers. Edits are stored as a **sparse overlay** (`boys-menu-overlay-v1`) rather than mutating `menu.json`, so only changed fields are kept and a one-click reset restores the shipped catalogue.
- **Quote inbox** — lists submitted quote requests with the ability to delete.

The overlay design is genuinely nice: `applyOverlay()` merges edits over the base data at read time, so the source catalogue stays pristine and "reset to default" is trivial.

The editor is searchable, filterable and sortable, with an edit dialog for each item and per-tier price editing. The dashboard also shows catalogue stats — priced vs unpriced counts, cheapest and priciest items, per-category badges.

**Access is a client-side passcode gate only.** The passcode is a hardcoded constant in `src/routes/admin.tsx`, it is printed on the login screen itself, and the unlocked state is a single `sessionStorage` flag. The source comments acknowledge this is a placeholder.

---

## Architecture notes

Everything is client-side. There is no database, no API layer, and no server functions — the only server-side code is the SSR entry, the error middleware, and the sitemap handler.

State is `localStorage` under four keys, each with a versioned suffix so the shape can be migrated later:

| Key | Holds |
| --- | --- |
| `boys-menu-overlay-v1` | Admin menu edits (sparse overrides) |
| `boys-quote-cart-v1` | The active cart |
| `boys-quote-requests-v1` | Submitted quote requests |
| `boys-admin-auth-v1` | Admin unlock flag (`sessionStorage`) |

Cross-component reactivity is handled with custom DOM events (`boys-menu-updated`, `boys-cart-updated`, `boys-quotes-updated`) plus the native `storage` event, so changes propagate across components *and* across browser tabs without a state library. All readers guard on `typeof window === "undefined"` to stay SSR-safe.

---

## Known limitations

These are real and worth addressing before launch. Listed roughly by severity.

### 1. Quote submissions never reach the business

This is the big one. `saveQuote()` writes to the **customer's own** `localStorage`. Nothing is transmitted anywhere. The admin quote inbox reads that same browser-local key — so staff opening `/admin` will only ever see quotes submitted from *their own browser*, never a customer's.

As it stands, a customer can complete the entire flow, receive a reference number, and the business will never learn the order exists. The only thing that actually reaches the business is if the customer voluntarily clicks "Email a copy" on the confirmation screen.

The confirmation form also states *"We'll email a confirmation and follow-up within one business day"* — that promise is not currently backed by anything.

**Fix:** add a server function or API route that persists the quote and notifies the business (email/webhook/DB).

### 2. Admin passcode is hardcoded in client source

The passcode is a plain-text constant in `src/routes/admin.tsx`, shipped in the client bundle, **displayed on the login screen**, and now present in this repository's history. Anyone who can read the source or the bundle can open the admin console; the `sessionStorage` flag is trivially settable from devtools regardless.

The practical exposure is limited today only because the console exposes nothing but that same browser's own `localStorage` — there is no server-side data to reach. That stops being true the moment limitation #1 is fixed, so auth should land alongside it.

**Fix:** move to real server-side auth. Rotate the current passcode — treat it as public.

### 3. Admin menu edits are not published

Menu edits write to the editing browser's `localStorage`. They are invisible to customers and to other staff devices, and they vanish if site data is cleared. The admin editor is currently a preview tool, not a CMS.

**Fix:** persist the overlay server-side.

### 4. Sitemap emits relative URLs

`BASE_URL` in `src/routes/sitemap[.]xml.ts` is an empty string, so the sitemap outputs paths rather than absolute URLs. The sitemap spec requires absolute URLs, and crawlers will reject it as-is. Set it to the production origin.

### 5. Placeholder and hardcoded content

- **Social links go nowhere** — the header's Facebook and Instagram icons point at the bare `facebook.com` / `instagram.com` homepages (`site-chrome.tsx`).
- **Homepage stats are literals**, not derived from the data: `230+ / 8 / 7` in `index.tsx`, and "Search all 230+ items…" in the menu search placeholder. The real item count is 231, so these drift the moment the catalogue changes.
- **Store hours are hardcoded in three places** (`site-chrome.tsx` twice, `contact.tsx` once) rather than living in `menu.json` alongside the rest of the business details.
- `business.website` exists in the data but is never rendered anywhere.

### 6. Minor

- **`@tanstack/react-query` is wired up but entirely unused** — a `QueryClient` is created and provided in `router.tsx` / `__root.tsx`, but there is not a single query or mutation in the app. Dead scaffolding, though useful to keep if a backend is coming.
- `zod` and `react-hook-form` are installed but unused — the quote form uses plain `useState` with manual validation. Worth adopting when the form starts hitting a real endpoint.
- Item identity is derived from names (`category__section__name`), so renaming an item in the admin editor orphans its own overlay entry.
- `vite-tsconfig-paths` is redundant on Vite 8 — the config can use the native `resolve.tsconfigPaths: true` and drop the plugin. It logs a warning on every dev start.
- There is no test suite.

---

## Deployment

The build produces a Nitro Node server in `.output/`. The target is **Vercel** — `.vercel/project.json` records the framework as `tanstack-start` on Node 24.x. There is no `vercel.json`; the defaults are used.

Because all data is browser-local, deployment currently requires no database, no secrets, and no runtime configuration — but that also means nothing persists server-side. Resolving limitation #1 will introduce the first real infrastructure dependency.

---

## Project layout

```
src/
├── routes/               # File-based routes
│   ├── __root.tsx        # Root layout + site chrome
│   ├── index.tsx         # Home
│   ├── menu.tsx          # Menu browser page
│   ├── quote.tsx         # Cart + quote form
│   ├── contact.tsx       # Contact details
│   ├── admin.tsx         # Passcode-gated admin console
│   └── sitemap[.]xml.ts  # Sitemap server handler
├── components/
│   ├── menu-browser.tsx  # Search, filter, add-to-quote
│   ├── cart-indicator.tsx
│   ├── site-chrome.tsx   # Header, nav, footer
│   └── ui/               # shadcn/ui primitives
├── data/
│   ├── menu.json         # The catalogue (source of truth)
│   └── menu.ts           # Types + helpers (itemId, formatPrice…)
├── lib/
│   ├── menu-store.ts     # Overlay, cart, and quote state
│   ├── error-capture.ts  # SSR error capture
│   └── error-page.ts     # Branded 500 page
├── server.ts             # SSR entry with error handling
├── start.ts              # Request middleware
└── styles.css            # Tailwind v4 + theme tokens
```

---

## Business details

**The Boys Farmers Market** — Gourmet Catering
14378 S. Military Trail, Delray Beach, FL 33484
(561) 496-0810 Ext. 1 · [boysfarmersmarket.com](https://boysfarmersmarket.com)
