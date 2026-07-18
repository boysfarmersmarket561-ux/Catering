# Productionize The Boys Catering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser-local MVP state with a Supabase backend so quotes reach the business, staff get a real catalogue-management portal (items, images, prices, ordering, availability), and emails send via Resend now / Microsoft Graph later.

**Architecture:** Supabase Postgres + Storage + Auth behind TanStack Start server functions — the browser never talks to Supabase directly; the secret key lives server-side only and RLS is deny-all defense in depth. Customer pages load via route loaders + React Query; the admin portal is a session-gated SPA tab set backed by admin server functions. Email goes through one `EmailSender` interface with Resend and Graph implementations selected by env var.

**Tech Stack:** TanStack Start 1.168 (already installed; server functions use `.inputValidator()` + `.handler()`), React 19, React Query 5, Tailwind v4, shadcn/ui, zod 3.24, react-hook-form, `@supabase/supabase-js` v2, `@dnd-kit` (sortable), Vitest, Resend HTTP API, Microsoft Graph API.

**Spec:** `docs/superpowers/specs/2026-07-18-productionize-catering-design.md`

---

## Prerequisites (human, one-time)

The engineer needs these before Task 2; ask the user for them if missing:

1. A Supabase project (https://supabase.com/dashboard → New project). Record:
   - Project URL (`https://<ref>.supabase.co`)
   - **Secret** API key (`sb_secret_…`) and **publishable** key (`sb_publishable_…`) from Project Settings → API keys. (These supersede the legacy `service_role`/`anon` JWTs; use the new keys.)
2. A Resend account + API key (https://resend.com → API Keys). For real from-addresses, verify the business domain under Resend → Domains; until then use `onboarding@resend.dev` as the from address (delivers only to the account owner's email — fine for testing).
3. Later (Phase 4): Azure tenant admin access to create an app registration.

## Environment variables

All server-side only (never `VITE_`-prefixed — nothing here may reach the client bundle). Vite/Nitro loads `.env` / `.env.local` into `process.env` for server code in dev; on Vercel set them in Project Settings → Environment Variables.

```bash
# .env.example (create in Task 1; commit it — real values go in .env.local, which is gitignored)
SUPABASE_URL=https://YOUR-REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EMAIL_PROVIDER=resend            # resend | graph
EMAIL_FROM="The Boys Catering <onboarding@resend.dev>"
RESEND_API_KEY=re_...
SITE_ORIGIN=https://example.com  # production origin, used by sitemap fallback
# Phase 4 (Microsoft Graph):
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
GRAPH_SENDER_MAILBOX=
```

## File structure

**New files**

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/<ts>_init.sql` | Schema, enums, RLS, storage bucket |
| `scripts/seed-menu.ts` | One-time import of `src/data/menu.json` + settings row |
| `src/lib/catalog-types.ts` | Shared catalogue types + price formatting (client-safe) |
| `src/lib/catalog-map.ts` | Pure DB-rows → `CatalogCategory[]` mapper (client-safe, testable) |
| `src/lib/quote-lines.ts` | Pure quote-line resolver: requested lines × DB items → snapshots/subtotal |
| `src/lib/quote-reference.ts` | 8-char reference generator |
| `src/lib/rate-limit.server.ts` | In-memory per-key throttle |
| `src/lib/supabase.server.ts` | `supabaseAdmin()` / `supabaseAuthClient()` / image URL helpers |
| `src/lib/admin-auth.server.ts` | Cookie session: sign-in, `requireAdmin()`, sign-out |
| `src/lib/image-resize.ts` | Client-side canvas resize before upload |
| `src/lib/queries.ts` | React Query `queryOptions` for catalog/admin/quotes/settings |
| `src/lib/email/types.ts` | `EmailMessage`, `EmailContent`, `EmailSender` |
| `src/lib/email/resend.ts` | `createResendSender` (fetch, no SDK) |
| `src/lib/email/graph.ts` | `createGraphSender` (client-credentials + sendMail) |
| `src/lib/email/templates.ts` | Business notification + customer confirmation content |
| `src/lib/email/index.ts` | `getEmailSender(env)` provider switch |
| `src/server/catalog.ts` | Public `getCatalog` server fn |
| `src/server/quotes.ts` | Public `submitQuote` server fn + zod schema |
| `src/server/admin-auth.ts` | `adminSignIn` / `adminSignOut` / `getAdminSession` server fns |
| `src/server/admin-catalog.ts` | Admin CRUD/reorder/toggle/image server fns |
| `src/server/admin-quotes.ts` | Admin quote inbox server fns |
| `src/server/settings.ts` | `getSettings` (public) / `updateSettings` (admin) |
| `src/components/admin/login-form.tsx` | Email+password sign-in |
| `src/components/admin/sortable-list.tsx` | Generic dnd-kit vertical sortable |
| `src/components/admin/catalog-tree.tsx` | Category→section→item tree with reorder/toggle/CRUD |
| `src/components/admin/item-editor.tsx` | Item dialog: fields, tiers, image |
| `src/components/admin/image-upload.tsx` | Resize + upload widget |
| `src/components/admin/quote-inbox.tsx` | DB-backed inbox with statuses |
| `src/components/admin/settings-form.tsx` | Hours/socials/notification email |
| `vitest.config.ts`, `tests/*.test.ts` | Unit tests |

**Modified:** `package.json`, `.env.example` (new), `src/lib/menu-store.ts` (cart v2; delete overlay+quotes code), `src/components/menu-browser.tsx` (Catalog types), `src/routes/menu.tsx`, `src/routes/index.tsx`, `src/routes/quote.tsx` (RHF+zod+submitQuote), `src/routes/admin.tsx` (full rewrite), `src/routes/contact.tsx`, `src/components/site-chrome.tsx`, `src/routes/sitemap[.]xml.ts`, `README.md`.

**Deleted at cleanup:** overlay/quote-localStorage code in `menu-store.ts`; `src/data/menu.json` stays (seed source only).

**Conventions**

- Server-only modules end in `.server.ts` or live in `src/server/` — never import them from client components except via server functions.
- All admin server fns call `await requireAdmin()` first; it throws on failure.
- All server fn inputs validated with zod via `.inputValidator(Schema)` (zod 3.24 implements Standard Schema — pass the schema directly).
- Run tests with `npx vitest run` (or a single file: `npx vitest run tests/foo.test.ts`).
- Commit after every task. `npm run lint` before each commit.

---

# Phase 1 — Backend foundation

### Task 1: Tooling, dependencies, env scaffolding

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`, `.env.example`, `.env.local` (gitignored, real values)

- [ ] **Step 1: Install dependencies (pin via lockfile commit)**

```bash
npm i @supabase/supabase-js @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm i -D vitest tsx
```

- [ ] **Step 2: Add scripts to `package.json`** (into the existing `"scripts"` block)

```json
"test": "vitest run",
"seed": "tsx --env-file=.env.local scripts/seed-menu.ts"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 4: Create `.env.example`** with the exact block from "Environment variables" above. Create `.env.local` with real values from the user (Supabase URL, secret + publishable keys, Resend key). `.env*` is already gitignored — verify with `git check-ignore .env.local` (should print the path).

- [ ] **Step 5: Verify test runner works**

Run: `npx vitest run`
Expected: "No test files found" exit 0 (or passWithNoTests warning — either is fine; if it exits non-zero add `passWithNoTests: true` to the `test` block).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts .env.example
git commit -m "chore: add supabase/dnd-kit/vitest deps and env scaffolding"
```

### Task 2: Supabase schema migration

**Files:**
- Create: `supabase/migrations/<timestamp>_init.sql` (via CLI)

- [ ] **Step 1: Init supabase dir and create migration file**

```bash
npx supabase init          # creates supabase/ (say no to VS Code settings prompts)
npx supabase migration new init
```

This creates `supabase/migrations/<timestamp>_init.sql` — never invent the filename by hand.

- [ ] **Step 2: Paste the migration SQL** into that file:

```sql
create type price_unit as enum
  ('platter','per_person','per_lb','per_foot','each','per_kabob','per_pastry','per_pieces');
create type quote_status as enum ('new','contacted','won','lost','archived');
create type email_send_status as enum ('pending','sent','failed');

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_path text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table sections (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  note text,
  sort_order int not null default 0,
  active boolean not null default true
);

create table items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  name text not null,
  description text,
  size text,
  serves text,
  image_path text,
  sort_order int not null default 0,
  active boolean not null default true
);

create table price_tiers (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  label text,
  amount numeric(10,2),          -- null = price on request
  unit price_unit not null,
  sort_order int not null default 0
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status quote_status not null default 'new',
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  event_date text,
  guest_count text,
  notes text,
  email_status email_send_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  item_name text not null,
  category_name text not null,
  section_name text not null,
  tier_label text,
  unit text,
  unit_amount numeric(10,2),
  quantity int not null check (quantity > 0)
);

create table settings (
  id int primary key default 1 check (id = 1),
  notification_email text not null,
  store_hours jsonb not null default '[]'::jsonb,
  facebook_url text,
  instagram_url text,
  site_origin text
);

create index sections_category_idx on sections (category_id);
create index items_section_idx on items (section_id);
create index price_tiers_item_idx on price_tiers (item_id);
create index quote_lines_quote_idx on quote_lines (quote_id);
create index quotes_status_idx on quotes (status);

-- RLS: deny-all. All access goes through server functions using the secret key
-- (which bypasses RLS). No policies are created on purpose — anon/authenticated
-- roles can read nothing even if the Data API exposes these tables.
alter table categories enable row level security;
alter table sections enable row level security;
alter table items enable row level security;
alter table price_tiers enable row level security;
alter table quotes enable row level security;
alter table quote_lines enable row level security;
alter table settings enable row level security;

-- Public-read storage bucket for menu images (writes only via secret key).
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;
```

- [ ] **Step 3: Apply to the cloud project**

```bash
npx supabase link --project-ref <REF>   # ref from the project URL; asks for DB password
npx supabase db push
```

Expected: `Applying migration ..._init.sql... Finished supabase db push.`
Fallback if CLI/link fails: paste the SQL into Dashboard → SQL Editor → Run, and note in the commit message that the migration was applied manually.

- [ ] **Step 4: Verify** in Dashboard → Table Editor: 7 tables exist, each shows the RLS-enabled shield; Storage shows a public `menu-images` bucket.

Troubleshooting: if later `.from()` queries error with "relation … does not exist in schema cache" or permission denied, check Dashboard → Settings → Data API (schema `public` must be exposed) — since 2026 new tables are not always auto-granted; the secret-key client normally retains full access via default privileges.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: supabase schema — catalogue, quotes, settings, storage bucket"
```

### Task 3: Catalogue types + price formatting (TDD)

**Files:**
- Create: `src/lib/catalog-types.ts`
- Test: `tests/format-tier.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/format-tier.test.ts
import { describe, expect, it } from "vitest";
import { formatTier, isPricedItem, type CatalogItem } from "@/lib/catalog-types";

describe("formatTier", () => {
  it("formats amount with unit suffix", () => {
    expect(formatTier({ amount: 34.99, unit: "per_person" })).toBe("$34.99 /person");
    expect(formatTier({ amount: 12.5, unit: "per_lb" })).toBe("$12.50 /lb");
    expect(formatTier({ amount: 9, unit: "each" })).toBe("$9.00 each");
  });
  it("omits suffix for platter/per_pieces", () => {
    expect(formatTier({ amount: 60, unit: "platter" })).toBe("$60.00");
    expect(formatTier({ amount: 15, unit: "per_pieces" })).toBe("$15.00");
  });
  it("renders null amount as price on request", () => {
    expect(formatTier({ amount: null, unit: "each" })).toBe("Price on request");
  });
});

describe("isPricedItem", () => {
  const base: Omit<CatalogItem, "tiers"> = {
    id: "i1", name: "X", description: null, size: null, serves: null,
    imageUrl: null, active: true,
  };
  it("false with no tiers or only null amounts", () => {
    expect(isPricedItem({ ...base, tiers: [] })).toBe(false);
    expect(isPricedItem({ ...base, tiers: [{ id: "t", label: null, amount: null, unit: "each" }] })).toBe(false);
  });
  it("true when any tier has an amount", () => {
    expect(isPricedItem({ ...base, tiers: [{ id: "t", label: "Sm", amount: 5, unit: "each" }] })).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/format-tier.test.ts` — Expected: FAIL (cannot resolve `@/lib/catalog-types`).

- [ ] **Step 3: Implement `src/lib/catalog-types.ts`**

```ts
export type PriceUnit =
  | "platter" | "per_person" | "per_lb" | "per_foot"
  | "each" | "per_kabob" | "per_pastry" | "per_pieces";

export const PRICE_UNITS: PriceUnit[] = [
  "platter", "per_person", "per_lb", "per_foot",
  "each", "per_kabob", "per_pastry", "per_pieces",
];

export interface CatalogTier {
  id: string;
  label: string | null;
  amount: number | null; // null = price on request
  unit: PriceUnit;
}

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  size: string | null;
  serves: string | null;
  imageUrl: string | null;
  active: boolean;
  tiers: CatalogTier[];
}

export interface CatalogSection {
  id: string;
  name: string;
  note: string | null;
  active: boolean;
  items: CatalogItem[];
}

export interface CatalogCategory {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  sections: CatalogSection[];
}

export function formatUnit(unit: PriceUnit): string {
  switch (unit) {
    case "per_person": return "/person";
    case "per_lb": return "/lb";
    case "per_foot": return "/ft";
    case "each": return "each";
    case "per_kabob": return "/kabob";
    case "per_pastry": return "/pastry";
    case "per_pieces": return "";
    case "platter": return "";
  }
}

export function formatTier(t: { amount: number | null; unit: PriceUnit }): string {
  if (t.amount == null) return "Price on request";
  const amt = `$${t.amount.toFixed(2)}`;
  const unit = formatUnit(t.unit);
  return unit ? `${amt} ${unit}` : amt;
}

export function isPricedItem(item: CatalogItem): boolean {
  return item.tiers.some((t) => t.amount != null);
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/format-tier.test.ts` — Expected: PASS (5 tests).

- [ ] **Step 5: Commit** — `git add src/lib/catalog-types.ts tests/format-tier.test.ts && git commit -m "feat: catalogue types and price formatting"`

### Task 4: Supabase server client + pure row mapper (TDD)

**Files:**
- Create: `src/lib/supabase.server.ts`, `src/lib/catalog-map.ts`
- Test: `tests/catalog-map.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/catalog-map.test.ts
import { describe, expect, it } from "vitest";
import { mapCatalogRows, type DbCategoryRow } from "@/lib/catalog-map";

const rows: DbCategoryRow[] = [
  {
    id: "c2", name: "Desserts", description: null, image_path: null, sort_order: 1, active: true,
    sections: [],
  },
  {
    id: "c1", name: "Fruit", description: "Fresh", image_path: "categories/c1.jpg", sort_order: 0, active: true,
    sections: [
      {
        id: "s1", name: "Platters", note: null, sort_order: 0, active: true,
        items: [
          {
            id: "i2", name: "Hidden", description: null, size: null, serves: null,
            image_path: null, sort_order: 0, active: false, price_tiers: [],
          },
          {
            id: "i1", name: "Fruit Platter", description: null, size: "16 in", serves: "25",
            image_path: "items/i1.jpg", sort_order: 1, active: true,
            price_tiers: [
              { id: "t2", label: "Large", amount: "89.99", unit: "platter", sort_order: 1 },
              { id: "t1", label: "Small", amount: "59.99", unit: "platter", sort_order: 0 },
            ],
          },
        ],
      },
      { id: "s2", name: "Off", note: null, sort_order: 1, active: false, items: [] },
    ],
  },
];

const IMG = "https://x.supabase.co/storage/v1/object/public/menu-images";

describe("mapCatalogRows", () => {
  it("sorts by sort_order at every level and coerces numeric strings", () => {
    const out = mapCatalogRows(rows, { includeInactive: false, imageBase: IMG });
    expect(out.map((c) => c.name)).toEqual(["Fruit", "Desserts"]);
    const tiers = out[0].sections[0].items[0].tiers;
    expect(tiers.map((t) => t.label)).toEqual(["Small", "Large"]);
    expect(tiers[0].amount).toBe(59.99);
  });
  it("filters inactive items and sections when includeInactive is false", () => {
    const out = mapCatalogRows(rows, { includeInactive: false, imageBase: IMG });
    expect(out[0].sections).toHaveLength(1);
    expect(out[0].sections[0].items.map((i) => i.name)).toEqual(["Fruit Platter"]);
  });
  it("keeps inactive rows when includeInactive is true", () => {
    const out = mapCatalogRows(rows, { includeInactive: true, imageBase: IMG });
    expect(out[0].sections).toHaveLength(2);
    expect(out[0].sections[0].items).toHaveLength(2);
  });
  it("builds public image urls, null when no path", () => {
    const out = mapCatalogRows(rows, { includeInactive: false, imageBase: IMG });
    expect(out[0].imageUrl).toBe(`${IMG}/categories/c1.jpg`);
    expect(out[1].imageUrl).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/catalog-map.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/catalog-map.ts`** (pure — no env, no supabase import)

```ts
import type { CatalogCategory, PriceUnit } from "./catalog-types";

export interface DbTierRow {
  id: string; label: string | null; amount: string | number | null;
  unit: string; sort_order: number;
}
export interface DbItemRow {
  id: string; name: string; description: string | null; size: string | null;
  serves: string | null; image_path: string | null; sort_order: number;
  active: boolean; price_tiers: DbTierRow[];
}
export interface DbSectionRow {
  id: string; name: string; note: string | null; sort_order: number;
  active: boolean; items: DbItemRow[];
}
export interface DbCategoryRow {
  id: string; name: string; description: string | null; image_path: string | null;
  sort_order: number; active: boolean; sections: DbSectionRow[];
}

interface MapOpts { includeInactive: boolean; imageBase: string }

const bySort = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order;

function img(base: string, path: string | null): string | null {
  return path ? `${base}/${path}` : null;
}

export function mapCatalogRows(rows: DbCategoryRow[], opts: MapOpts): CatalogCategory[] {
  const keep = (x: { active: boolean }) => opts.includeInactive || x.active;
  return [...rows].filter(keep).sort(bySort).map((c) => ({
    id: c.id, name: c.name, description: c.description,
    imageUrl: img(opts.imageBase, c.image_path), active: c.active,
    sections: [...c.sections].filter(keep).sort(bySort).map((s) => ({
      id: s.id, name: s.name, note: s.note, active: s.active,
      items: [...s.items].filter(keep).sort(bySort).map((i) => ({
        id: i.id, name: i.name, description: i.description, size: i.size,
        serves: i.serves, imageUrl: img(opts.imageBase, i.image_path), active: i.active,
        tiers: [...i.price_tiers].sort(bySort).map((t) => ({
          id: t.id, label: t.label,
          amount: t.amount == null ? null : Number(t.amount),
          unit: t.unit as PriceUnit,
        })),
      })),
    })),
  }));
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/catalog-map.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 5: Implement `src/lib/supabase.server.ts`** (no test — thin env wiring)

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

/** Secret-key client: full access, bypasses RLS. Server-side only. */
export function supabaseAdmin(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Publishable-key client: used server-side only, for password sign-in/refresh. */
export function supabaseAuthClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function imageBaseUrl(): string {
  return `${env("SUPABASE_URL")}/storage/v1/object/public/menu-images`;
}
```

- [ ] **Step 6: Commit** — `git add src/lib/catalog-map.ts src/lib/supabase.server.ts tests/catalog-map.test.ts && git commit -m "feat: supabase server client and pure catalogue row mapper"`

### Task 5: Seed script — import menu.json + settings

**Files:**
- Create: `scripts/seed-menu.ts`

- [ ] **Step 1: Implement `scripts/seed-menu.ts`**

Notes baked into the code: legacy `Price.unit` may be the retired value `"unpriced"` — map it to `"each"` with `amount: null` (formatting only depends on the null amount). Items with an empty `prices` array get zero tiers (renders "Price on request"). The script **wipes and re-imports the catalogue** (delete categories cascades) so it is safe to re-run before launch; it never touches `quotes`.

```ts
import { createClient } from "@supabase/supabase-js";
import menu from "../src/data/menu.json";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) { console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const VALID_UNITS = new Set(["platter","per_person","per_lb","per_foot","each","per_kabob","per_pastry","per_pieces"]);

async function main() {
  console.log("Wiping catalogue…");
  await sb.from("categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  let nCat = 0, nSec = 0, nItem = 0, nTier = 0;
  for (const [ci, cat] of menu.categories.entries()) {
    const { data: c, error: ce } = await sb.from("categories")
      .insert({ name: cat.name, sort_order: ci }).select("id").single();
    if (ce) throw new Error(`category ${cat.name}: ${ce.message}`);
    nCat++;
    for (const [si, sec] of cat.sections.entries()) {
      const { data: s, error: se } = await sb.from("sections")
        .insert({ category_id: c.id, name: sec.name, note: sec.note ?? null, sort_order: si })
        .select("id").single();
      if (se) throw new Error(`section ${sec.name}: ${se.message}`);
      nSec++;
      for (const [ii, it] of sec.items.entries()) {
        const { data: item, error: ie } = await sb.from("items")
          .insert({
            section_id: s.id, name: it.name, description: it.description ?? null,
            size: it.size ?? null, serves: it.serves ?? null, sort_order: ii,
          }).select("id").single();
        if (ie) throw new Error(`item ${it.name}: ${ie.message}`);
        nItem++;
        const tiers = (it.prices ?? []).map((p, ti) => ({
          item_id: item.id,
          label: p.label ?? null,
          amount: p.amount,
          unit: VALID_UNITS.has(p.unit) ? p.unit : "each",
          sort_order: ti,
        }));
        if (tiers.length) {
          const { error: te } = await sb.from("price_tiers").insert(tiers);
          if (te) throw new Error(`tiers for ${it.name}: ${te.message}`);
          nTier += tiers.length;
        }
      }
    }
  }

  const { error: se2 } = await sb.from("settings").upsert({
    id: 1,
    notification_email: menu.business.bakery_email,
    store_hours: ["Monday – Sunday 8:30am – 6:00pm"],
    facebook_url: null,
    instagram_url: null,
    site_origin: process.env.SITE_ORIGIN ?? null,
  });
  if (se2) throw new Error(`settings: ${se2.message}`);

  console.log(`Seeded ${nCat} categories, ${nSec} sections, ${nItem} items, ${nTier} tiers.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it** — `npm run seed`
Expected: `Seeded 8 categories, 45 sections, 231 items, <N> tiers.` If counts differ from 8/45/231, stop and investigate before continuing.

- [ ] **Step 3: Spot-check** in Dashboard → Table Editor: `items` has 231 rows; a known multi-tier item (e.g. a platter with small/large) has 2+ rows in `price_tiers`; `settings` has 1 row.

- [ ] **Step 4: Commit** — `git add scripts/seed-menu.ts && git commit -m "feat: seed script importing menu.json into supabase"`

### Task 6: Public `getCatalog` server fn + query options

**Files:**
- Create: `src/server/catalog.ts`, `src/lib/queries.ts`

- [ ] **Step 1: Implement `src/server/catalog.ts`**

```ts
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin, imageBaseUrl } from "@/lib/supabase.server";
import { mapCatalogRows, type DbCategoryRow } from "@/lib/catalog-map";
import type { CatalogCategory } from "@/lib/catalog-types";

export const CATALOG_SELECT = `id,name,description,image_path,sort_order,active,
sections(id,name,note,sort_order,active,
items(id,name,description,size,serves,image_path,sort_order,active,
price_tiers(id,label,amount,unit,sort_order)))`.replace(/\n/g, "");

export const getCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogCategory[]> => {
    const { data, error } = await supabaseAdmin().from("categories").select(CATALOG_SELECT);
    if (error) throw new Error(`getCatalog: ${error.message}`);
    return mapCatalogRows((data ?? []) as unknown as DbCategoryRow[], {
      includeInactive: false,
      imageBase: imageBaseUrl(),
    });
  },
);
```

- [ ] **Step 2: Implement `src/lib/queries.ts`**

```ts
import { queryOptions } from "@tanstack/react-query";
import { getCatalog } from "@/server/catalog";

export const catalogQueryOptions = () =>
  queryOptions({ queryKey: ["catalog"], queryFn: () => getCatalog() });
```

(Admin/quotes/settings options are appended here in later tasks.)

- [ ] **Step 3: Smoke-test** — `npm run dev`, then `curl -s http://localhost:3000/menu | grep -c "Fruit"`
Expected: non-zero (page still renders — it doesn't use the DB yet; real wiring is Task 7). Confirm no server errors in the dev console.

- [ ] **Step 4: Commit** — `git add src/server/catalog.ts src/lib/queries.ts && git commit -m "feat: getCatalog server function"`

### Task 7: Customer site reads from the DB (cart v2)

**Files:**
- Modify: `src/lib/menu-store.ts` (cart section only), `src/components/menu-browser.tsx`, `src/routes/menu.tsx`, `src/routes/index.tsx`, `src/components/cart-indicator.tsx` (only if it touches `CartLine` fields — check)

This task swaps the menu page and home page onto `getCatalog` and re-keys the cart on UUIDs. The old overlay (`useMenu`, `applyOverlay`, …) and localStorage quotes (`saveQuote`, `useQuotes`, …) stay in place until the cleanup task — only the **cart** block changes now.

- [ ] **Step 1: Replace the cart block in `src/lib/menu-store.ts`**

Replace `CART_KEY`, `CartLine`, and `useCart`'s add/set/remove key logic with:

```ts
const CART_KEY = "boys-quote-cart-v2";

export interface CartLine {
  itemId: string;
  tierId: string | null;   // null = price-on-request item with no tiers
  name: string;
  category: string;
  section: string;
  tierLabel: string;       // display string, e.g. "Small — $59.99" or "Price on request"
  unitAmount: number | null;
  quantity: number;
}
```

In `useCart`, the line key everywhere becomes `(l.itemId, l.tierId)` instead of `(l.id, l.priceIndex)`:
- `addLine` dedupe: `cur.findIndex((l) => l.itemId === line.itemId && l.tierId === line.tierId)`
- `setQty(itemId: string, tierId: string | null, qty: number)` and `remove(itemId, tierId)` filter on both fields the same way.
`subtotal`/`hasUnpriced` are unchanged. Old `boys-quote-cart-v1` carts are simply ignored (different key) — acceptable, pre-launch.

- [ ] **Step 2: Rewire `src/routes/menu.tsx`** — loader + suspense query:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { catalogQueryOptions } from "@/lib/queries";
import { MenuBrowser } from "@/components/menu-browser";

export const Route = createFileRoute("/menu")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueryOptions()),
  // keep the existing head() block exactly as-is
  component: MenuPage,
});

function MenuPage() {
  const { data } = useSuspenseQuery(catalogQueryOptions());
  // keep the existing page wrapper markup, passing the new prop:
  return ( /* existing wrapper */ <MenuBrowser categories={data} /> /* … */ );
}
```

(Adapt to the file's current structure: only the data source and prop change; heading/wrapper markup stays.)

- [ ] **Step 3: Update `src/components/menu-browser.tsx`** to the Catalog types.

Interface and imports change:

```tsx
import type { CatalogCategory, CatalogItem, CatalogTier } from "@/lib/catalog-types";
import { formatTier, isPricedItem } from "@/lib/catalog-types";
// remove: imports from "@/data/menu" (MenuData, MenuItem, formatPrice, isPriced, itemId)

interface Props { categories: CatalogCategory[] }
export function MenuBrowser({ categories }: Props) {
```

Mechanical renames through the component: `data.categories` → `categories`; keys `c.name`/`sec.name` → `c.id`/`sec.id`; `it.prices` → `it.tiers`; `formatPrice(p)` → `formatTier(t)`; `isPriced(item)` → `isPricedItem(item)`; drop the `itemId(...)` derivation entirely — use `it.id`. `inCart` becomes `(id: string) => cart.some((l) => l.itemId === id)`.

The `ItemCard` add handler changes shape — replace the `onAdd` wiring with:

```tsx
onAdd={(tier) => {
  addLine({
    itemId: it.id,
    tierId: tier?.id ?? null,
    category: cat.name,
    section: sec.name,
    name: it.name,
    tierLabel: tier
      ? [tier.label, formatTier(tier)].filter(Boolean).join(" — ")
      : "Price on request",
    unitAmount: tier?.amount ?? null,
  });
  toast.success(`Added ${it.name} to your quote`);
}}
```

with `ItemCard`'s prop typed `onAdd: (tier: CatalogTier | null) => void`; the no-tier button calls `onAdd(null)`, and the tier rows map `item.tiers.map((t) => … onClick={() => onAdd(t)} … {formatTier(t)} …)` keyed by `t.id`. If `item.imageUrl` is set, render it at the top of the card:

```tsx
{item.imageUrl && (
  <img src={item.imageUrl} alt={item.name} loading="lazy"
       className="mb-4 aspect-[4/3] w-full rounded-xl object-cover" />
)}
```

Also update the search placeholder to use the live count: `` placeholder={`Search all ${categories.reduce((n, c) => n + c.sections.reduce((m, s) => m + s.items.length, 0), 0)} items…`} ``.

- [ ] **Step 4: Update `src/routes/index.tsx`** — add the same loader (`context.queryClient.ensureQueryData(catalogQueryOptions())`), read with `useSuspenseQuery`, and derive: category grid from `data` (was `baseMenu.categories`; card links keep using the same `cat-${slugify(name)}` anchors), `<Stat n={\`${itemCount}+\`} …>` and `<Stat n={String(data.length)} …>` where `itemCount` is the same reduce as above. Remove the `baseMenu` import.

- [ ] **Step 5: Fix compile fallout** — `npx tsc --noEmit`. `src/routes/quote.tsx` still references `l.id`/`l.priceIndex`/`l.priceLabel`: update its cart list to `l.itemId`/`l.tierId`/`l.tierLabel` and key `` `${l.itemId}-${l.tierId}` `` (the form itself is rebuilt in Task 12). Check `cart-indicator.tsx` — if it only uses `cart.length`/quantities it needs no change. The old admin route still compiles against legacy exports — leave it; it is fully rewritten in Task 14.

Expected: `tsc` exits clean.

- [ ] **Step 6: Manual verify** — `npm run dev`; `/menu` shows all 231 items from the DB (spot-check a multi-tier platter), search works, adding tiers updates the cart badge; `/` stats read 231+/8; `/quote` still lists lines correctly.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: customer site reads catalogue from supabase; cart keyed by uuid"`

# Phase 2 — Quote flow + Resend email

### Task 8: Reference generator + rate limiter (TDD)

**Files:**
- Create: `src/lib/quote-reference.ts`, `src/lib/rate-limit.server.ts`
- Test: `tests/quote-reference.test.ts`, `tests/rate-limit.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/quote-reference.test.ts
import { describe, expect, it } from "vitest";
import { makeReference, REFERENCE_ALPHABET } from "@/lib/quote-reference";

describe("makeReference", () => {
  it("is 8 chars from the unambiguous alphabet", () => {
    const ref = makeReference();
    expect(ref).toHaveLength(8);
    for (const ch of ref) expect(REFERENCE_ALPHABET).toContain(ch);
  });
  it("is deterministic given an injected random source", () => {
    expect(makeReference(() => 0)).toBe("AAAAAAAA");
    expect(makeReference(() => 0.999999)).toBe("99999999");
  });
});
```

```ts
// tests/rate-limit.test.ts
import { describe, expect, it } from "vitest";
import { allowRequest } from "@/lib/rate-limit.server";

describe("allowRequest", () => {
  it("allows up to the limit then blocks within the window", () => {
    const key = "t1";
    for (let i = 0; i < 5; i++) expect(allowRequest(key, 5, 1000, 0)).toBe(true);
    expect(allowRequest(key, 5, 1000, 1)).toBe(false);
  });
  it("frees slots after the window passes", () => {
    const key = "t2";
    for (let i = 0; i < 5; i++) allowRequest(key, 5, 1000, 0);
    expect(allowRequest(key, 5, 1000, 2000)).toBe(true);
  });
  it("tracks keys independently", () => {
    for (let i = 0; i < 5; i++) allowRequest("a", 5, 1000, 0);
    expect(allowRequest("b", 5, 1000, 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/quote-reference.test.ts tests/rate-limit.test.ts` — Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

```ts
// src/lib/quote-reference.ts
/** No 0/O/1/I/L to keep references phone-friendly. */
export const REFERENCE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function makeReference(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += REFERENCE_ALPHABET[Math.floor(random() * REFERENCE_ALPHABET.length)];
  }
  return out;
}
```

```ts
// src/lib/rate-limit.server.ts
/** In-memory sliding-window throttle. Per server instance — a basic bot brake,
 *  not a distributed limiter; acceptable for this app's traffic. */
const hits = new Map<string, number[]>();

export function allowRequest(
  key: string, limit = 5, windowMs = 60 * 60 * 1000, now = Date.now(),
): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
```

- [ ] **Step 4: Run to verify pass** — same command — Expected: PASS (5 tests).

- [ ] **Step 5: Commit** — `git add src/lib/quote-reference.ts src/lib/rate-limit.server.ts tests/quote-reference.test.ts tests/rate-limit.test.ts && git commit -m "feat: quote reference generator and rate limiter"`

### Task 9: Email sender interface + Resend + provider switch (TDD)

**Files:**
- Create: `src/lib/email/types.ts`, `src/lib/email/resend.ts`, `src/lib/email/index.ts`
- Test: `tests/email-provider.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/email-provider.test.ts
import { describe, expect, it } from "vitest";
import { getEmailSender } from "@/lib/email";

describe("getEmailSender", () => {
  it("returns a resend sender when configured", () => {
    const s = getEmailSender({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.c" });
    expect(typeof s.send).toBe("function");
  });
  it("defaults to resend when EMAIL_PROVIDER is unset", () => {
    const s = getEmailSender({ RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.c" });
    expect(typeof s.send).toBe("function");
  });
  it("throws when resend config is missing", () => {
    expect(() => getEmailSender({ EMAIL_PROVIDER: "resend" })).toThrow(/RESEND_API_KEY/);
  });
  it("throws on unknown provider", () => {
    expect(() => getEmailSender({ EMAIL_PROVIDER: "pigeon" })).toThrow(/Unknown EMAIL_PROVIDER/);
  });
  it("throws when graph config is missing", () => {
    expect(() => getEmailSender({ EMAIL_PROVIDER: "graph" })).toThrow(/AZURE_TENANT_ID/);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/email-provider.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/email/types.ts
export interface EmailMessage { to: string; subject: string; html: string; text: string }
export interface EmailContent { subject: string; html: string; text: string }
export interface EmailSender { send(msg: EmailMessage): Promise<void> }
```

```ts
// src/lib/email/resend.ts
import type { EmailSender } from "./types";

export function createResendSender(opts: { apiKey: string; from: string }): EmailSender {
  return {
    async send(msg) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: opts.from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text,
        }),
      });
      if (!res.ok) throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
    },
  };
}
```

```ts
// src/lib/email/index.ts
import type { EmailSender } from "./types";
import { createResendSender } from "./resend";
import { createGraphSender } from "./graph";

type Env = Record<string, string | undefined>;

function req(env: Env, name: string): string {
  const v = env[name];
  if (!v) throw new Error(`${name} is required for EMAIL_PROVIDER=${env.EMAIL_PROVIDER ?? "resend"}`);
  return v;
}

export function getEmailSender(env: Env = process.env): EmailSender {
  const provider = env.EMAIL_PROVIDER ?? "resend";
  if (provider === "resend") {
    return createResendSender({ apiKey: req(env, "RESEND_API_KEY"), from: req(env, "EMAIL_FROM") });
  }
  if (provider === "graph") {
    return createGraphSender({
      tenantId: req(env, "AZURE_TENANT_ID"),
      clientId: req(env, "AZURE_CLIENT_ID"),
      clientSecret: req(env, "AZURE_CLIENT_SECRET"),
      mailbox: req(env, "GRAPH_SENDER_MAILBOX"),
    });
  }
  throw new Error(`Unknown EMAIL_PROVIDER: ${provider}`);
}
```

Also create a stub `src/lib/email/graph.ts` now so the import compiles (real implementation in Task 19):

```ts
// src/lib/email/graph.ts
import type { EmailSender } from "./types";

export interface GraphConfig { tenantId: string; clientId: string; clientSecret: string; mailbox: string }

export function createGraphSender(cfg: GraphConfig): EmailSender {
  void cfg;
  return {
    async send() { throw new Error("Graph sender not implemented yet — see Phase 4"); },
  };
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/email-provider.test.ts` — Expected: PASS (5 tests). (The graph test passes because config validation happens in `getEmailSender` before the stub is returned.)

- [ ] **Step 5: Commit** — `git add src/lib/email tests/email-provider.test.ts && git commit -m "feat: swappable email sender with resend implementation"`

### Task 10: Email templates (TDD)

**Files:**
- Create: `src/lib/email/templates.ts`
- Test: `tests/email-templates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/email-templates.test.ts
import { describe, expect, it } from "vitest";
import { businessNotificationEmail, customerConfirmationEmail, type QuoteEmailData } from "@/lib/email/templates";

const data: QuoteEmailData = {
  reference: "ABCD2345",
  customerName: "Pat Jones", customerEmail: "pat@example.com", customerPhone: "561-555-0100",
  eventDate: "2026-08-01", guestCount: "40", notes: "Nut allergy at table 2",
  lines: [
    { itemId: "i1", itemName: "Fruit Platter", categoryName: "Fresh Fruit", sectionName: "Platters",
      tierLabel: "Large", unit: "platter", unitAmount: 89.99, quantity: 2 },
    { itemId: "i2", itemName: "Carving Station", categoryName: "Main Entrees", sectionName: "Stations",
      tierLabel: null, unit: null, unitAmount: null, quantity: 1 },
  ],
  subtotal: 179.98, hasUnpriced: true,
};

describe("businessNotificationEmail", () => {
  const m = businessNotificationEmail(data);
  it("subject carries reference and customer", () => {
    expect(m.subject).toContain("ABCD2345");
    expect(m.subject).toContain("Pat Jones");
  });
  it("body lists lines, prices, unpriced flag and contact details", () => {
    for (const part of ["Fruit Platter", "$89.99", "× 2", "Carving Station", "Price on request",
                        "$179.98", "pat@example.com", "561-555-0100", "Nut allergy"]) {
      expect(m.text).toContain(part);
      expect(m.html).toContain(part.replace("×", "&times;"));
    }
  });
});

describe("customerConfirmationEmail", () => {
  const m = customerConfirmationEmail(data);
  it("subject carries the reference", () => { expect(m.subject).toContain("ABCD2345"); });
  it("body includes order copy and subtotal disclaimer", () => {
    expect(m.text).toContain("Fruit Platter");
    expect(m.text).toContain("$179.98");
    expect(m.text.toLowerCase()).toContain("estimate");
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/email-templates.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/email/templates.ts`**

```ts
import type { EmailContent } from "./types";
import type { ResolvedLine } from "@/lib/quote-lines";

export interface QuoteEmailData {
  reference: string;
  customerName: string; customerEmail: string; customerPhone: string;
  eventDate: string; guestCount: string; notes: string;
  lines: ResolvedLine[];
  subtotal: number;
  hasUnpriced: boolean;
}

const money = (n: number) => `$${n.toFixed(2)}`;

function lineParts(l: ResolvedLine): { qty: string; name: string; price: string } {
  return {
    qty: `${l.quantity}`,
    name: l.tierLabel ? `${l.itemName} (${l.tierLabel})` : l.itemName,
    price: l.unitAmount == null
      ? "Price on request"
      : `${money(l.unitAmount)} ea — ${money(l.unitAmount * l.quantity)}`,
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function linesText(lines: ResolvedLine[]): string {
  return lines.map((l) => {
    const p = lineParts(l);
    return `• ${p.name} × ${p.qty} — ${p.price}`;
  }).join("\n");
}

function linesHtml(lines: ResolvedLine[]): string {
  const rows = lines.map((l) => {
    const p = lineParts(l);
    return `<tr><td style="padding:6px 12px 6px 0">${esc(p.name)} &times; ${p.qty}</td>` +
           `<td style="padding:6px 0;text-align:right">${esc(p.price)}</td></tr>`;
  }).join("");
  return `<table style="border-collapse:collapse;width:100%">${rows}</table>`;
}

function detailsText(d: QuoteEmailData): string {
  return [
    `Name: ${d.customerName}`, `Email: ${d.customerEmail}`, `Phone: ${d.customerPhone || "—"}`,
    `Event date: ${d.eventDate || "—"}`, `Guests: ${d.guestCount || "—"}`, `Notes: ${d.notes || "—"}`,
  ].join("\n");
}

function subtotalText(d: QuoteEmailData): string {
  return `Estimated subtotal: ${money(d.subtotal)}${d.hasUnpriced ? " (plus items priced on request)" : ""}`;
}

export function businessNotificationEmail(d: QuoteEmailData): EmailContent {
  const subject = `New catering quote ${d.reference} — ${d.customerName}`;
  const text = [
    `New quote request ${d.reference}`, "", linesText(d.lines), "", subtotalText(d), "",
    detailsText(d),
  ].join("\n");
  const html =
    `<h2>New quote request ${d.reference}</h2>` + linesHtml(d.lines) +
    `<p><strong>${esc(subtotalText(d))}</strong></p>` +
    `<pre style="font-family:inherit">${esc(detailsText(d))}</pre>`;
  return { subject, html, text };
}

export function customerConfirmationEmail(d: QuoteEmailData): EmailContent {
  const subject = `The Boys Farmers Market — quote request ${d.reference} received`;
  const intro =
    `Hi ${d.customerName},\n\nThanks for your catering quote request! ` +
    `Your reference is ${d.reference}. We'll follow up within one business day ` +
    `to confirm availability and final pricing.`;
  const outro =
    `The subtotal is an estimate; items priced on request are quoted when we confirm.\n\n` +
    `The Boys Farmers Market — Gourmet Catering\n14378 S. Military Trail, Delray Beach, FL 33484\n(561) 496-0810 Ext. 1`;
  const text = [intro, "", linesText(d.lines), "", subtotalText(d), "", outro].join("\n");
  const html =
    `<p>${esc(intro).replace(/\n/g, "<br>")}</p>` + linesHtml(d.lines) +
    `<p><strong>${esc(subtotalText(d))}</strong></p>` +
    `<p>${esc(outro).replace(/\n/g, "<br>")}</p>`;
  return { subject, html, text };
}
```

Note: this imports `ResolvedLine` from `@/lib/quote-lines`, created in the next task. To keep this task green on its own, create the type file first — Step 3a of Task 11 — or implement Tasks 10 and 11 together and run both test files at the end; either order is fine as long as both commits land.

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/email-templates.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add src/lib/email/templates.ts tests/email-templates.test.ts && git commit -m "feat: quote email templates"`

### Task 11: Quote line resolver (TDD) + `submitQuote` server fn

**Files:**
- Create: `src/lib/quote-lines.ts`, `src/server/quotes.ts`
- Test: `tests/quote-lines.test.ts`, `tests/quote-schema.test.ts`

- [ ] **Step 1: Write the failing resolver test**

```ts
// tests/quote-lines.test.ts
import { describe, expect, it } from "vitest";
import { resolveQuoteLines, type QuoteItemRow } from "@/lib/quote-lines";

const items: QuoteItemRow[] = [
  {
    id: "i1", name: "Fruit Platter", active: true,
    section: { name: "Platters", active: true, category: { name: "Fresh Fruit", active: true } },
    price_tiers: [{ id: "t1", label: "Large", amount: "89.99", unit: "platter" }],
  },
  {
    id: "i2", name: "Carving Station", active: true,
    section: { name: "Stations", active: true, category: { name: "Mains", active: true } },
    price_tiers: [],
  },
  {
    id: "i3", name: "Hidden", active: false,
    section: { name: "Platters", active: true, category: { name: "Fresh Fruit", active: true } },
    price_tiers: [{ id: "t3", label: null, amount: "5", unit: "each" }],
  },
];

describe("resolveQuoteLines", () => {
  it("snapshots names and prices from the DB, not the client", () => {
    const { lines, subtotal, hasUnpriced } = resolveQuoteLines(items, [
      { itemId: "i1", tierId: "t1", quantity: 2 },
      { itemId: "i2", tierId: null, quantity: 1 },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      itemName: "Fruit Platter", categoryName: "Fresh Fruit", sectionName: "Platters",
      tierLabel: "Large", unit: "platter", unitAmount: 89.99, quantity: 2,
    });
    expect(lines[1].unitAmount).toBeNull();
    expect(subtotal).toBeCloseTo(179.98);
    expect(hasUnpriced).toBe(true);
  });
  it("drops unknown items, inactive items, and unknown tiers", () => {
    const { lines } = resolveQuoteLines(items, [
      { itemId: "nope", tierId: null, quantity: 1 },
      { itemId: "i3", tierId: "t3", quantity: 1 },
      { itemId: "i1", tierId: "wrong-tier", quantity: 1 },
    ]);
    expect(lines).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/quote-lines.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/quote-lines.ts`** (pure)

```ts
export interface QuoteItemRow {
  id: string; name: string; active: boolean;
  section: { name: string; active: boolean; category: { name: string; active: boolean } };
  price_tiers: Array<{ id: string; label: string | null; amount: string | number | null; unit: string }>;
}

export interface RequestedLine { itemId: string; tierId: string | null; quantity: number }

export interface ResolvedLine {
  itemId: string; itemName: string; categoryName: string; sectionName: string;
  tierLabel: string | null; unit: string | null; unitAmount: number | null; quantity: number;
}

export function resolveQuoteLines(
  items: QuoteItemRow[], requested: RequestedLine[],
): { lines: ResolvedLine[]; subtotal: number; hasUnpriced: boolean } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const lines: ResolvedLine[] = [];
  for (const req of requested) {
    const item = byId.get(req.itemId);
    if (!item || !item.active || !item.section.active || !item.section.category.active) continue;
    let tierLabel: string | null = null, unit: string | null = null, unitAmount: number | null = null;
    if (req.tierId != null) {
      const tier = item.price_tiers.find((t) => t.id === req.tierId);
      if (!tier) continue;
      tierLabel = tier.label;
      unit = tier.unit;
      unitAmount = tier.amount == null ? null : Number(tier.amount);
    }
    lines.push({
      itemId: item.id, itemName: item.name,
      categoryName: item.section.category.name, sectionName: item.section.name,
      tierLabel, unit, unitAmount, quantity: req.quantity,
    });
  }
  const subtotal = lines.reduce((s, l) => s + (l.unitAmount ?? 0) * l.quantity, 0);
  const hasUnpriced = lines.some((l) => l.unitAmount == null);
  return { lines, subtotal, hasUnpriced };
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/quote-lines.test.ts` — Expected: PASS.

- [ ] **Step 5: Write the failing schema test**

```ts
// tests/quote-schema.test.ts
import { describe, expect, it } from "vitest";
import { SubmitQuoteSchema } from "@/server/quotes";

const valid = {
  name: "Pat", email: "pat@example.com", phone: "", eventDate: "", guestCount: "", notes: "",
  website: "", lines: [{ itemId: "3f1c2f6e-9c1a-4b0e-8f5d-2a6c9d8e7b4a", tierId: null, quantity: 1 }],
};

describe("SubmitQuoteSchema", () => {
  it("accepts a minimal valid submission", () => {
    expect(SubmitQuoteSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects a filled honeypot", () => {
    expect(SubmitQuoteSchema.safeParse({ ...valid, website: "spam.biz" }).success).toBe(false);
  });
  it("rejects empty lines, bad email, zero quantity", () => {
    expect(SubmitQuoteSchema.safeParse({ ...valid, lines: [] }).success).toBe(false);
    expect(SubmitQuoteSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(SubmitQuoteSchema.safeParse({
      ...valid, lines: [{ ...valid.lines[0], quantity: 0 }],
    }).success).toBe(false);
  });
});
```

- [ ] **Step 6: Implement `src/server/quotes.ts`**

```ts
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase.server";
import { resolveQuoteLines, type QuoteItemRow } from "@/lib/quote-lines";
import { makeReference } from "@/lib/quote-reference";
import { allowRequest } from "@/lib/rate-limit.server";
import { getEmailSender } from "@/lib/email";
import { businessNotificationEmail, customerConfirmationEmail, type QuoteEmailData } from "@/lib/email/templates";

export const SubmitQuoteSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(50).default(""),
  eventDate: z.string().trim().max(50).default(""),
  guestCount: z.string().trim().max(50).default(""),
  notes: z.string().trim().max(5000).default(""),
  website: z.string().max(0),           // honeypot — real users never fill it
  lines: z.array(z.object({
    itemId: z.string().uuid(),
    tierId: z.string().uuid().nullable(),
    quantity: z.number().int().min(1).max(999),
  })).min(1).max(200),
});

const ITEM_SELECT =
  "id,name,active,section:sections(name,active,category:categories(name,active)),price_tiers(id,label,amount,unit)";

export const submitQuote = createServerFn({ method: "POST" })
  .inputValidator(SubmitQuoteSchema)
  .handler(async ({ data }): Promise<{ reference: string }> => {
    const ip = getRequestIP() ?? "unknown";
    if (!allowRequest(`quote:${ip}`)) {
      throw new Error("Too many quote requests from this connection — please try again later.");
    }

    const sb = supabaseAdmin();
    const itemIds = [...new Set(data.lines.map((l) => l.itemId))];
    const { data: itemRows, error: itemErr } = await sb.from("items").select(ITEM_SELECT).in("id", itemIds);
    if (itemErr) throw new Error(`submitQuote items: ${itemErr.message}`);

    const { lines, subtotal, hasUnpriced } =
      resolveQuoteLines((itemRows ?? []) as unknown as QuoteItemRow[], data.lines);
    if (lines.length === 0) throw new Error("None of the requested items are available — please rebuild your quote.");

    const reference = makeReference();
    const { data: quote, error: qErr } = await sb.from("quotes").insert({
      reference, customer_name: data.name, customer_email: data.email,
      customer_phone: data.phone || null, event_date: data.eventDate || null,
      guest_count: data.guestCount || null, notes: data.notes || null,
    }).select("id").single();
    if (qErr) throw new Error(`submitQuote insert: ${qErr.message}`);

    const { error: lErr } = await sb.from("quote_lines").insert(lines.map((l) => ({
      quote_id: quote.id, item_id: l.itemId, item_name: l.itemName,
      category_name: l.categoryName, section_name: l.sectionName,
      tier_label: l.tierLabel, unit: l.unit, unit_amount: l.unitAmount, quantity: l.quantity,
    })));
    if (lErr) throw new Error(`submitQuote lines: ${lErr.message}`);

    // Quote is committed — email failures must not lose it.
    const emailData: QuoteEmailData = {
      reference, customerName: data.name, customerEmail: data.email, customerPhone: data.phone,
      eventDate: data.eventDate, guestCount: data.guestCount, notes: data.notes,
      lines, subtotal, hasUnpriced,
    };
    let emailStatus: "sent" | "failed" = "sent";
    try {
      const sender = getEmailSender();
      const { data: settings } = await sb.from("settings").select("notification_email").eq("id", 1).single();
      const notifyTo = settings?.notification_email;
      if (!notifyTo) throw new Error("settings.notification_email missing");
      const biz = businessNotificationEmail(emailData);
      await sender.send({ to: notifyTo, ...biz });
      const cust = customerConfirmationEmail(emailData);
      await sender.send({ to: data.email, ...cust });
    } catch (e) {
      console.error(`quote ${reference}: email failed`, e);
      emailStatus = "failed";
    }
    await sb.from("quotes").update({ email_status: emailStatus }).eq("id", quote.id);

    return { reference };
  });
```

- [ ] **Step 7: Run all tests** — `npx vitest run` — Expected: all pass (schema test included; importing `src/server/quotes.ts` in vitest is fine — `createServerFn` only registers the fn).

- [ ] **Step 8: Commit** — `git add src/lib/quote-lines.ts src/server/quotes.ts tests/quote-lines.test.ts tests/quote-schema.test.ts && git commit -m "feat: submitQuote server function with server-side price resolution"`

### Task 12: Rebuild the quote form on RHF + zod; wire submission

**Files:**
- Modify: `src/routes/quote.tsx`

- [ ] **Step 1: Rebuild the form section.** Keep the page's cart-review column, confirmation screen, `Field` helper, and all styling; replace the `useState` form + `saveQuote` flow:

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { submitQuote } from "@/server/quotes";
// remove: import { saveQuote } from "@/lib/menu-store"; import { baseMenu } from "@/data/menu";

const FormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Enter a valid email").max(320),
  phone: z.string().trim().max(50).default(""),
  eventDate: z.string().trim().max(50).default(""),
  guestCount: z.string().trim().max(50).default(""),
  notes: z.string().trim().max(5000).default(""),
  website: z.string().max(0).default(""), // honeypot
});
type FormValues = z.infer<typeof FormSchema>;
```

Inside the component:

```tsx
const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } =
  useForm<FormValues>({ resolver: zodResolver(FormSchema), defaultValues: {
    name: "", email: "", phone: "", eventDate: "", guestCount: "", notes: "", website: "",
  }});

const onSubmit = handleSubmit(async (values) => {
  if (cart.length === 0) { toast.error("Add at least one item to your quote first."); return; }
  try {
    const { reference } = await submitQuote({ data: {
      ...values,
      lines: cart.map((l) => ({ itemId: l.itemId, tierId: l.tierId, quantity: l.quantity })),
    }});
    setSubmitted({ ref: reference });
    clear();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Something went wrong — please try again.");
  }
});
```

Each `Input`/`Textarea` swaps `value/onChange` for `{...register("name")}` etc.; render errors under fields: `{errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}`. Add the invisible honeypot inside the form:

```tsx
<input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
       className="absolute -left-[9999px] h-0 w-0 opacity-0" {...register("website")} />
```

Submit button gets `disabled={isSubmitting}`. Note `clear()` runs **after** `setSubmitted` — the confirmation screen no longer reads the cart, so capture anything it needs first.

- [ ] **Step 2: Fix the confirmation screen.** It previously read `cart` for the mailto body — cart is now cleared on success. Capture the summary at submit time instead: extend the `submitted` state to `{ ref: string; mailtoBody: string }`, building the body from `cart` + `getValues()` *before* `clear()` (same string logic as the existing `mailtoBody()`, with `l.tierLabel` instead of `l.priceLabel`). The bakery email constant: replace `baseMenu.business.bakery_email` with the literal `"bakery@boysfarmersmarket.com"`-style value currently in `menu.json` (`business.bakery_email`) — read it from `src/data/menu.json` at the top of the file if you prefer: `import menu from "@/data/menu.json"` … `menu.business.bakery_email`. Also remove the on-screen promise mismatch: the text "We'll email a confirmation…" is now true — keep it.

- [ ] **Step 3: Typecheck + lint** — `npx tsc --noEmit && npm run lint` — Expected: clean.

- [ ] **Step 4: End-to-end verify** — `npm run dev`: add 2+ items (one unpriced), submit with your real email as customer. Expect: confirmation screen with reference; a row in `quotes` (Dashboard) with `email_status = 'sent'`; both emails arrive (with `onboarding@resend.dev` both go to the Resend account owner's inbox). Then temporarily set `RESEND_API_KEY=re_invalid`, restart dev, submit again — quote row still appears with `email_status = 'failed'`; restore the key.

- [ ] **Step 5: Commit** — `git add src/routes/quote.tsx && git commit -m "feat: quote form submits to the backend with emails"`

# Phase 3 — Admin portal

### Task 13: Admin auth — cookie sessions over Supabase Auth

**Files:**
- Create: `src/lib/admin-auth.server.ts`, `src/server/admin-auth.ts`

- [ ] **Step 1: Dashboard setup (human-verifiable):** Supabase Dashboard → Authentication → Sign In / Providers: ensure Email is enabled and **disable "Allow new users to sign up"**. Then Users → Add user → Create new user (email + password, auto-confirm on). This is the staff account.

- [ ] **Step 2: Implement `src/lib/admin-auth.server.ts`**

```ts
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { supabaseAdmin, supabaseAuthClient } from "./supabase.server";

const ACCESS_COOKIE = "boys-admin-access";
const REFRESH_COOKIE = "boys-admin-refresh";

const cookieOpts = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
});

export interface AdminSession { userId: string; email: string }

function storeSession(s: { access_token: string; refresh_token: string; expires_in: number }) {
  setCookie(ACCESS_COOKIE, s.access_token, { ...cookieOpts(), maxAge: s.expires_in });
  setCookie(REFRESH_COOKIE, s.refresh_token, { ...cookieOpts(), maxAge: 60 * 60 * 24 * 30 });
}

export async function signInAdmin(email: string, password: string): Promise<AdminSession> {
  const { data, error } = await supabaseAuthClient().auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) throw new Error("Invalid email or password");
  storeSession(data.session);
  return { userId: data.user.id, email: data.user.email ?? "" };
}

/** Returns the session or null. Refreshes transparently when the access token expired. */
export async function getAdminSessionOrNull(): Promise<AdminSession | null> {
  const access = getCookie(ACCESS_COOKIE);
  if (access) {
    const { data } = await supabaseAdmin().auth.getUser(access);
    if (data.user) return { userId: data.user.id, email: data.user.email ?? "" };
  }
  const refresh = getCookie(REFRESH_COOKIE);
  if (refresh) {
    const { data, error } = await supabaseAuthClient().auth.refreshSession({ refresh_token: refresh });
    if (!error && data.session && data.user) {
      storeSession(data.session);
      return { userId: data.user.id, email: data.user.email ?? "" };
    }
  }
  return null;
}

/** Gate for every admin server fn. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSessionOrNull();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export function signOutAdmin(): void {
  deleteCookie(ACCESS_COOKIE, { path: "/" });
  deleteCookie(REFRESH_COOKIE, { path: "/" });
}
```

- [ ] **Step 3: Implement `src/server/admin-auth.ts`**

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { signInAdmin, signOutAdmin, getAdminSessionOrNull, type AdminSession } from "@/lib/admin-auth.server";

export const adminSignIn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().trim().email(), password: z.string().min(1) }))
  .handler(async ({ data }): Promise<AdminSession> => signInAdmin(data.email, data.password));

export const adminSignOut = createServerFn({ method: "POST" }).handler(async () => {
  signOutAdmin();
  return { ok: true };
});

export const getAdminSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminSession | null> => getAdminSessionOrNull(),
);
```

- [ ] **Step 4: Typecheck** — `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 5: Commit** — `git add src/lib/admin-auth.server.ts src/server/admin-auth.ts && git commit -m "feat: admin auth with http-only cookie sessions"`

### Task 14: Admin shell rewrite — login gate + tabs

**Files:**
- Modify: `src/routes/admin.tsx` (full rewrite — the passcode gate, overlay editor, and localStorage inbox all die here)
- Create: `src/components/admin/login-form.tsx`

- [ ] **Step 1: Create `src/components/admin/login-form.tsx`**

```tsx
import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { adminSignIn } from "@/server/admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminSignIn({ data: { email, password } });
      await router.invalidate();
    } catch {
      toast.error("Invalid email or password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-24">
      <h1 className="font-display text-4xl">Staff sign in</h1>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `src/routes/admin.tsx`** as the gated shell (tabs filled by Tasks 16–18; placeholder panels are fine *within this task only* and are replaced before the phase ends):

```tsx
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { getAdminSession, adminSignOut } from "@/server/admin-auth";
import { LoginForm } from "@/components/admin/login-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — The Boys Catering" }, { name: "robots", content: "noindex" }] }),
  loader: async () => ({ session: await getAdminSession() }),
  component: AdminPage,
});

function AdminPage() {
  const { session } = Route.useLoaderData();
  const router = useRouter();
  if (!session) return <LoginForm />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-4xl">Admin console</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {session.email}
          <Button variant="outline" size="sm"
            onClick={async () => { await adminSignOut(); await router.invalidate(); }}>
            Sign out
          </Button>
        </div>
      </div>
      <Tabs defaultValue="catalogue">
        <TabsList>
          <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="catalogue">{/* <CatalogTree /> — Task 16 */}</TabsContent>
        <TabsContent value="quotes">{/* <QuoteInbox /> — Task 18 */}</TabsContent>
        <TabsContent value="settings">{/* <SettingsForm /> — Task 20 */}</TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean (deleting the old admin code also removes the last consumers of some legacy `menu-store` exports — if `tsc` now flags them as unused they stay until cleanup; if it flags *errors*, fix imports). Manual: `/admin` shows the sign-in form; wrong password toasts; correct credentials land on the tabbed shell; sign out returns to the form; cookie in devtools is `HttpOnly`.

- [ ] **Step 4: Commit** — `git add src/routes/admin.tsx src/components/admin/login-form.tsx && git commit -m "feat: session-gated admin shell replaces passcode"`

### Task 15: Admin catalogue CRUD server functions

**Files:**
- Create: `src/server/admin-catalog.ts`
- Modify: `src/lib/queries.ts`

- [ ] **Step 1: Implement `src/server/admin-catalog.ts`**

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth.server";
import { supabaseAdmin, imageBaseUrl } from "@/lib/supabase.server";
import { mapCatalogRows, type DbCategoryRow } from "@/lib/catalog-map";
import { CATALOG_SELECT } from "@/server/catalog";
import { PRICE_UNITS } from "@/lib/catalog-types";
import type { CatalogCategory } from "@/lib/catalog-types";

const Id = z.object({ id: z.string().uuid() });
const Kind = z.enum(["category", "section", "item"]);
const TABLE = { category: "categories", section: "sections", item: "items" } as const;

function fail(ctx: string, message: string): never { throw new Error(`${ctx}: ${message}`); }

export const getAdminCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogCategory[]> => {
    await requireAdmin();
    const { data, error } = await supabaseAdmin().from("categories").select(CATALOG_SELECT);
    if (error) fail("getAdminCatalog", error.message);
    return mapCatalogRows((data ?? []) as unknown as DbCategoryRow[], {
      includeInactive: true, imageBase: imageBaseUrl(),
    });
  },
);

async function nextSortOrder(table: string, filter?: { col: string; val: string }): Promise<number> {
  let q = supabaseAdmin().from(table).select("sort_order").order("sort_order", { ascending: false }).limit(1);
  if (filter) q = q.eq(filter.col, filter.val);
  const { data } = await q;
  return data?.length ? data[0].sort_order + 1 : 0;
}

export const createCategory = createServerFn({ method: "POST" })
  .inputValidator(z.object({ name: z.string().trim().min(1).max(200) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sort_order = await nextSortOrder("categories");
    const { error } = await supabaseAdmin().from("categories").insert({ name: data.name, sort_order });
    if (error) fail("createCategory", error.message);
    return { ok: true };
  });

export const updateCategory = createServerFn({ method: "POST" })
  .inputValidator(Id.extend({ name: z.string().trim().min(1).max(200).optional(), description: z.string().max(2000).nullable().optional() }))
  .handler(async ({ data: { id, ...patch } }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().from("categories").update(patch).eq("id", id);
    if (error) fail("updateCategory", error.message);
    return { ok: true };
  });

export const createSection = createServerFn({ method: "POST" })
  .inputValidator(z.object({ categoryId: z.string().uuid(), name: z.string().trim().min(1).max(200) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sort_order = await nextSortOrder("sections", { col: "category_id", val: data.categoryId });
    const { error } = await supabaseAdmin().from("sections")
      .insert({ category_id: data.categoryId, name: data.name, sort_order });
    if (error) fail("createSection", error.message);
    return { ok: true };
  });

export const updateSection = createServerFn({ method: "POST" })
  .inputValidator(Id.extend({ name: z.string().trim().min(1).max(200).optional(), note: z.string().max(2000).nullable().optional() }))
  .handler(async ({ data: { id, ...patch } }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().from("sections").update(patch).eq("id", id);
    if (error) fail("updateSection", error.message);
    return { ok: true };
  });

export const createItem = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sectionId: z.string().uuid(), name: z.string().trim().min(1).max(200) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sort_order = await nextSortOrder("items", { col: "section_id", val: data.sectionId });
    const { data: row, error } = await supabaseAdmin().from("items")
      .insert({ section_id: data.sectionId, name: data.name, sort_order }).select("id").single();
    if (error) fail("createItem", error.message);
    return { id: row.id as string };
  });

export const updateItemFn = createServerFn({ method: "POST" })
  .inputValidator(Id.extend({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    size: z.string().max(200).nullable().optional(),
    serves: z.string().max(200).nullable().optional(),
  }))
  .handler(async ({ data: { id, ...patch } }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().from("items").update(patch).eq("id", id);
    if (error) fail("updateItemFn", error.message);
    return { ok: true };
  });

export const deleteEntity = createServerFn({ method: "POST" })
  .inputValidator(Id.extend({ kind: Kind }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().from(TABLE[data.kind]).delete().eq("id", data.id);
    if (error) fail("deleteEntity", error.message);
    return { ok: true };
  });

export const setActive = createServerFn({ method: "POST" })
  .inputValidator(Id.extend({ kind: Kind, active: z.boolean() }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().from(TABLE[data.kind]).update({ active: data.active }).eq("id", data.id);
    if (error) fail("setActive", error.message);
    return { ok: true };
  });

export const reorder = createServerFn({ method: "POST" })
  .inputValidator(z.object({ kind: Kind, ids: z.array(z.string().uuid()).min(1).max(500) }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = supabaseAdmin();
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await sb.from(TABLE[data.kind]).update({ sort_order: i }).eq("id", data.ids[i]);
      if (error) fail("reorder", error.message);
    }
    return { ok: true };
  });

export const replaceTiers = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    itemId: z.string().uuid(),
    tiers: z.array(z.object({
      label: z.string().trim().max(100).nullable(),
      amount: z.number().min(0).max(100000).nullable(),
      unit: z.enum(PRICE_UNITS as [string, ...string[]]),
    })).max(20),
  }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = supabaseAdmin();
    const { error: dErr } = await sb.from("price_tiers").delete().eq("item_id", data.itemId);
    if (dErr) fail("replaceTiers delete", dErr.message);
    if (data.tiers.length) {
      const { error: iErr } = await sb.from("price_tiers").insert(
        data.tiers.map((t, i) => ({ item_id: data.itemId, label: t.label, amount: t.amount, unit: t.unit, sort_order: i })),
      );
      if (iErr) fail("replaceTiers insert", iErr.message);
    }
    return { ok: true };
  });
```

- [ ] **Step 2: Append to `src/lib/queries.ts`**

```ts
import { getAdminCatalog } from "@/server/admin-catalog";

export const adminCatalogQueryOptions = () =>
  queryOptions({ queryKey: ["admin-catalog"], queryFn: () => getAdminCatalog() });
```

- [ ] **Step 3: Typecheck + tests** — `npx tsc --noEmit && npx vitest run` — Expected: clean/pass.

- [ ] **Step 4: Commit** — `git add src/server/admin-catalog.ts src/lib/queries.ts && git commit -m "feat: admin catalogue CRUD server functions"`

### Task 16: Catalogue tree UI — reorder, toggle, create, rename, delete

**Files:**
- Create: `src/components/admin/sortable-list.tsx`, `src/components/admin/catalog-tree.tsx`
- Modify: `src/routes/admin.tsx` (mount `<CatalogTree />` in the catalogue tab)

- [ ] **Step 1: Create `src/components/admin/sortable-list.tsx`**

```tsx
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export function SortableList({ ids, onReorder, children }: {
  ids: string[]; onReorder: (ids: string[]) => void; children: React.ReactNode;
}) {
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };
  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext>
    </DndContext>
  );
}

export function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
         className="flex items-center gap-2">
      <button type="button" {...attributes} {...listeners}
              className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
              aria-label="Drag to reorder">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/admin/catalog-tree.tsx`**

```tsx
import { useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { adminCatalogQueryOptions } from "@/lib/queries";
import {
  createCategory, createItem, createSection, deleteEntity, reorder, setActive,
  updateCategory, updateSection,
} from "@/server/admin-catalog";
import { formatTier, type CatalogItem } from "@/lib/catalog-types";
import { SortableList, SortableRow } from "./sortable-list";
import { ItemEditor } from "./item-editor";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

/** Any admin mutation → invalidate admin + public catalogue caches. */
export function useAdminAction<TInput>(fn: (opts: { data: TInput }) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TInput) => fn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-catalog"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function InlineName({ value, onSave, className }: {
  value: string; onSave: (v: string) => void; className?: string;
}) {
  const [v, setV] = useState(value);
  return (
    <Input value={v} onChange={(e) => setV(e.target.value)} className={className}
      onBlur={() => { const t = v.trim(); if (t && t !== value) onSave(t); else setV(value); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
  );
}

function AddInline({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form className="flex items-center gap-2"
      onSubmit={(e) => { e.preventDefault(); const t = v.trim(); if (t) { onAdd(t); setV(""); } }}>
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="h-8 max-w-56 text-sm" />
      <Button type="submit" size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /> Add</Button>
    </form>
  );
}

export function CatalogTree() {
  const { data: categories } = useSuspenseQuery(adminCatalogQueryOptions());
  const [editing, setEditing] = useState<CatalogItem | null>(null);

  const addCategory = useAdminAction(createCategory);
  const patchCategory = useAdminAction(updateCategory);
  const addSection = useAdminAction(createSection);
  const patchSection = useAdminAction(updateSection);
  const addItem = useAdminAction(createItem);
  const del = useAdminAction(deleteEntity);
  const toggle = useAdminAction(setActive);
  const move = useAdminAction(reorder);

  const confirmDelete = (kind: "category" | "section" | "item", id: string, blast: string) => {
    if (window.confirm(`Delete ${blast}? This cannot be undone. Past quotes keep their snapshots.`)) {
      del.mutate({ kind, id });
    }
  };

  return (
    <div className="space-y-6">
      <AddInline placeholder="New category name…" onAdd={(name) => addCategory.mutate({ name })} />
      <SortableList ids={categories.map((c) => c.id)}
        onReorder={(ids) => move.mutate({ kind: "category", ids })}>
        <Accordion type="multiple" className="space-y-2">
          {categories.map((cat) => (
            <SortableRow key={cat.id} id={cat.id}>
              <AccordionItem value={cat.id} className={"rounded-xl border px-4 " + (cat.active ? "" : "opacity-50")}>
                <div className="flex items-center gap-3 py-2">
                  <InlineName value={cat.name} className="h-9 max-w-72 font-medium"
                    onSave={(name) => patchCategory.mutate({ id: cat.id, name })} />
                  <span className="text-xs text-muted-foreground">
                    {cat.sections.reduce((n, s) => n + s.items.length, 0)} items
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <Switch checked={cat.active}
                      onCheckedChange={(active) => toggle.mutate({ kind: "category", id: cat.id, active })} />
                    <Button variant="ghost" size="sm"
                      onClick={() => confirmDelete("category", cat.id,
                        `category "${cat.name}" (${cat.sections.length} sections)`)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <AccordionTrigger className="py-0" />
                  </div>
                </div>
                <AccordionContent className="space-y-4 pb-4">
                  <AddInline placeholder="New section name…"
                    onAdd={(name) => addSection.mutate({ categoryId: cat.id, name })} />
                  <SortableList ids={cat.sections.map((s) => s.id)}
                    onReorder={(ids) => move.mutate({ kind: "section", ids })}>
                    {cat.sections.map((sec) => (
                      <SortableRow key={sec.id} id={sec.id}>
                        <div className={"mb-3 rounded-lg border p-3 " + (sec.active ? "" : "opacity-50")}>
                          <div className="flex items-center gap-3">
                            <InlineName value={sec.name} className="h-8 max-w-64 text-sm"
                              onSave={(name) => patchSection.mutate({ id: sec.id, name })} />
                            <div className="ml-auto flex items-center gap-2">
                              <Switch checked={sec.active}
                                onCheckedChange={(active) => toggle.mutate({ kind: "section", id: sec.id, active })} />
                              <Button variant="ghost" size="sm"
                                onClick={() => confirmDelete("section", sec.id,
                                  `section "${sec.name}" (${sec.items.length} items)`)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-3 space-y-1">
                            <SortableList ids={sec.items.map((i) => i.id)}
                              onReorder={(ids) => move.mutate({ kind: "item", ids })}>
                              {sec.items.map((it) => (
                                <SortableRow key={it.id} id={it.id}>
                                  <div className={"flex items-center gap-3 rounded px-2 py-1.5 hover:bg-secondary/50 " + (it.active ? "" : "opacity-50")}>
                                    <span className="truncate text-sm">{it.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {it.tiers.length ? formatTier(it.tiers[0]) : "Price on request"}
                                    </span>
                                    <div className="ml-auto flex items-center gap-2">
                                      <Switch checked={it.active}
                                        onCheckedChange={(active) => toggle.mutate({ kind: "item", id: it.id, active })} />
                                      <Button variant="ghost" size="sm" onClick={() => setEditing(it)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="sm"
                                        onClick={() => confirmDelete("item", it.id, `item "${it.name}"`)}>
                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                </SortableRow>
                              ))}
                            </SortableList>
                            <AddInline placeholder="New item name…"
                              onAdd={(name) => addItem.mutate({ sectionId: sec.id, name })} />
                          </div>
                        </div>
                      </SortableRow>
                    ))}
                  </SortableList>
                </AccordionContent>
              </AccordionItem>
            </SortableRow>
          ))}
        </Accordion>
      </SortableList>
      {editing && <ItemEditor item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
```

Note: `ItemEditor` arrives in Task 17 — to keep this task compiling on its own, create a temporary `src/components/admin/item-editor.tsx` stub now (replaced next task):

```tsx
import type { CatalogItem } from "@/lib/catalog-types";
export function ItemEditor({ onClose }: { item: CatalogItem; onClose: () => void }) {
  onClose(); // stub until Task 17
  return null;
}
```

- [ ] **Step 2b: Add the dashboard stats strip** (spec §2 keeps the old console's stats). At the top of `CatalogTree`'s returned JSX, before `AddInline`:

```tsx
{(() => {
  const items = categories.flatMap((c) => c.sections.flatMap((s) => s.items));
  const priced = items.filter((i) => i.tiers.some((t) => t.amount != null)).length;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>{items.length} items ({items.filter((i) => i.active).length} live)</span>
      <span>· {priced} priced / {items.length - priced} on request</span>
      {categories.map((c) => (
        <Badge key={c.id} variant="outline">
          {c.name}: {c.sections.reduce((n, s) => n + s.items.length, 0)}
        </Badge>
      ))}
    </div>
  );
})()}
```

(`import { Badge } from "@/components/ui/badge";`)

- [ ] **Step 3: Mount in `src/routes/admin.tsx`** — `import { CatalogTree } from "@/components/admin/catalog-tree";` and replace the catalogue `TabsContent` placeholder with `<CatalogTree />`. Because it uses `useSuspenseQuery`, wrap in Suspense: `<TabsContent value="catalogue"><Suspense fallback={<p className="py-10 text-muted-foreground">Loading…</p>}><CatalogTree /></Suspense></TabsContent>` (`import { Suspense } from "react"`).

- [ ] **Step 4: Manual verify** — sign in at `/admin`: create a category, section, and item; rename inline (blur saves); drag to reorder categories and items; toggle a category off → check `/menu` in another tab no longer shows it (after reload — public cache invalidation only affects the admin browser); delete with confirm. Verify reorder persisted after a full reload.

- [ ] **Step 5: Lint + typecheck + commit**

```bash
npm run lint && npx tsc --noEmit
git add src/components/admin/ src/routes/admin.tsx
git commit -m "feat: admin catalogue tree with dnd reorder, toggles, crud"
```

### Task 17: Item editor — fields, price tiers, image upload

**Files:**
- Create: `src/lib/image-resize.ts`, `src/components/admin/image-upload.tsx`
- Replace stub: `src/components/admin/item-editor.tsx`
- Modify: `src/server/admin-catalog.ts` (add `uploadImage`, `removeImage`)

- [ ] **Step 1: Add image server fns to `src/server/admin-catalog.ts`**

```ts
const ImageKind = z.enum(["category", "item"]);

export const uploadImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    const kind = ImageKind.parse(data.get("kind"));
    const id = z.string().uuid().parse(data.get("id"));
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Missing file");
    if (file.size > 5 * 1024 * 1024) throw new Error("Image too large (max 5 MB)");
    return { kind, id, file };
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = supabaseAdmin();
    const path = `${data.kind}s/${data.id}.jpg`;
    const bytes = new Uint8Array(await data.file.arrayBuffer());
    const { error: upErr } = await sb.storage.from("menu-images")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (upErr) fail("uploadImage", upErr.message);
    const table = data.kind === "item" ? "items" : "categories";
    // cache-bust suffix so replaced images refresh in browsers
    const stored = `${path}?v=${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await sb.from(table).update({ image_path: stored }).eq("id", data.id);
    if (error) fail("uploadImage update", error.message);
    return { imageUrl: `${imageBaseUrl()}/${stored}` };
  });

export const removeImage = createServerFn({ method: "POST" })
  .inputValidator(Id.extend({ kind: ImageKind }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = supabaseAdmin();
    await sb.storage.from("menu-images").remove([`${data.kind}s/${data.id}.jpg`]);
    const table = data.kind === "item" ? "items" : "categories";
    const { error } = await sb.from(table).update({ image_path: null }).eq("id", data.id);
    if (error) fail("removeImage", error.message);
    return { ok: true };
  });
```

- [ ] **Step 2: Create `src/lib/image-resize.ts`**

```ts
/** Downscale + JPEG-compress in the browser so phone photos upload fast. */
export async function resizeImage(file: File, maxDim = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image resize failed"))), "image/jpeg", quality),
  );
}
```

- [ ] **Step 3: Create `src/components/admin/image-upload.tsx`**

```tsx
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { removeImage, uploadImage } from "@/server/admin-catalog";
import { resizeImage } from "@/lib/image-resize";
import { Button } from "@/components/ui/button";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function ImageUpload({ kind, id, imageUrl }: {
  kind: "category" | "item"; id: string; imageUrl: string | null;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(imageUrl);
  const [busy, setBusy] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-catalog"] });
    qc.invalidateQueries({ queryKey: ["catalog"] });
  };

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const blob = await resizeImage(file);
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("id", id);
      fd.set("file", new File([blob], "image.jpg", { type: "image/jpeg" }));
      const { imageUrl: url } = await uploadImage({ data: fd });
      setPreview(url);
      invalidate();
      toast.success("Photo updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {preview ? (
        <img src={preview} alt="" className="h-20 w-28 rounded-lg border object-cover" />
      ) : (
        <div className="grid h-20 w-28 place-items-center rounded-lg border border-dashed text-xs text-muted-foreground">
          No photo
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      <Button type="button" variant="outline" size="sm" disabled={busy}
        onClick={() => inputRef.current?.click()}>
        <ImagePlus className="mr-1 h-4 w-4" /> {preview ? "Replace" : "Upload"}
      </Button>
      {preview && (
        <Button type="button" variant="ghost" size="sm" disabled={busy}
          onClick={async () => { await removeImage({ data: { kind, id } }); setPreview(null); invalidate(); }}>
          <Trash2 className="mr-1 h-4 w-4" /> Remove
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Replace `src/components/admin/item-editor.tsx`**

```tsx
import { useState } from "react";
import { updateItemFn, replaceTiers } from "@/server/admin-catalog";
import { useAdminAction } from "./catalog-tree";
import { ImageUpload } from "./image-upload";
import { PRICE_UNITS, formatUnit, type CatalogItem, type PriceUnit } from "@/lib/catalog-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TierDraft { label: string; amount: string; unit: PriceUnit }

export function ItemEditor({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [size, setSize] = useState(item.size ?? "");
  const [serves, setServes] = useState(item.serves ?? "");
  const [tiers, setTiers] = useState<TierDraft[]>(
    item.tiers.map((t) => ({ label: t.label ?? "", amount: t.amount?.toFixed(2) ?? "", unit: t.unit })),
  );
  const save = useAdminAction(updateItemFn);
  const saveTiers = useAdminAction(replaceTiers);

  const patchTier = (i: number, patch: Partial<TierDraft>) =>
    setTiers((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const onSave = async () => {
    for (const t of tiers) {
      if (t.amount.trim() !== "" && Number.isNaN(Number(t.amount))) {
        toast.error(`"${t.amount}" is not a valid price`);
        return;
      }
    }
    await save.mutateAsync({
      id: item.id, name: name.trim() || item.name,
      description: description.trim() || null, size: size.trim() || null, serves: serves.trim() || null,
    });
    await saveTiers.mutateAsync({
      itemId: item.id,
      tiers: tiers.map((t) => ({
        label: t.label.trim() || null,
        amount: t.amount.trim() === "" ? null : Number(t.amount),
        unit: t.unit,
      })),
    });
    toast.success("Item saved");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Edit item</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <ImageUpload kind="item" id={item.id} imageUrl={item.imageUrl} />
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Description</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Size</Label><Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="16 in" /></div>
            <div><Label>Serves</Label><Input value={serves} onChange={(e) => setServes(e.target.value)} placeholder="20–25" /></div>
          </div>
          <div>
            <Label>Price tiers</Label>
            <p className="text-xs text-muted-foreground">Leave the price blank for “price on request”.</p>
            <div className="mt-2 space-y-2">
              {tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={t.label} placeholder="Label (Small…)" className="w-32"
                    onChange={(e) => patchTier(i, { label: e.target.value })} />
                  <Input value={t.amount} placeholder="0.00" inputMode="decimal" className="w-24"
                    onChange={(e) => patchTier(i, { amount: e.target.value })} />
                  <Select value={t.unit} onValueChange={(unit) => patchTier(i, { unit: unit as PriceUnit })}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRICE_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{formatUnit(u) || u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => setTiers((ts) => ts.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm"
                onClick={() => setTiers((ts) => [...ts, { label: "", amount: "", unit: "each" }])}>
                <Plus className="mr-1 h-4 w-4" /> Add tier
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={onSave} disabled={save.isPending || saveTiers.isPending}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4b: Category photos** (spec §2 — each category can carry a photo for its homepage card). In `catalog-tree.tsx`, at the top of each category's `AccordionContent` add:

```tsx
<ImageUpload kind="category" id={cat.id} imageUrl={cat.imageUrl} />
```

(`import { ImageUpload } from "./image-upload";`). Then in `src/routes/index.tsx`, render `cat.imageUrl` on the category card when present (same `<img … className="aspect-[4/3] w-full rounded-xl object-cover" loading="lazy">` pattern as the menu card, adapted to the card's existing layout).

- [ ] **Step 5: Manual verify** — edit an item: change name/description, add a second tier, blank a price (→ "Price on request" on `/menu`), upload a phone-size photo (appears on the admin row and the customer card), replace it, remove it. Upload a category photo and confirm it shows on the homepage card. Confirm the customer `/menu` reflects everything after reload.

- [ ] **Step 6: Lint, typecheck, commit**

```bash
npm run lint && npx tsc --noEmit
git add src/components/admin/ src/server/admin-catalog.ts src/lib/image-resize.ts
git commit -m "feat: item editor with price tiers and image upload"
```

### Task 18: Quote inbox

**Files:**
- Create: `src/server/admin-quotes.ts`, `src/components/admin/quote-inbox.tsx`
- Modify: `src/lib/queries.ts`, `src/routes/admin.tsx` (mount)

- [ ] **Step 1: Implement `src/server/admin-quotes.ts`**

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth.server";
import { supabaseAdmin } from "@/lib/supabase.server";

export interface AdminQuoteLine {
  id: string; item_name: string; category_name: string; section_name: string;
  tier_label: string | null; unit: string | null; unit_amount: string | number | null; quantity: number;
}
export interface AdminQuote {
  id: string; reference: string; status: "new" | "contacted" | "won" | "lost" | "archived";
  customer_name: string; customer_email: string; customer_phone: string | null;
  event_date: string | null; guest_count: string | null; notes: string | null;
  email_status: "pending" | "sent" | "failed"; created_at: string;
  quote_lines: AdminQuoteLine[];
}

export const listQuotes = createServerFn({ method: "GET" })
  .inputValidator(z.object({ includeArchived: z.boolean().default(false) }))
  .handler(async ({ data }): Promise<AdminQuote[]> => {
    await requireAdmin();
    let q = supabaseAdmin().from("quotes").select("*, quote_lines(*)")
      .order("created_at", { ascending: false }).limit(200);
    if (!data.includeArchived) q = q.neq("status", "archived");
    const { data: rows, error } = await q;
    if (error) throw new Error(`listQuotes: ${error.message}`);
    return (rows ?? []) as AdminQuote[];
  });

export const setQuoteStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string().uuid(),
    status: z.enum(["new", "contacted", "won", "lost", "archived"]),
  }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().from("quotes").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(`setQuoteStatus: ${error.message}`);
    return { ok: true };
  });

export const deleteQuoteFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().from("quotes").delete().eq("id", data.id);
    if (error) throw new Error(`deleteQuote: ${error.message}`);
    return { ok: true };
  });
```

- [ ] **Step 2: Append to `src/lib/queries.ts`**

```ts
import { listQuotes } from "@/server/admin-quotes";

export const adminQuotesQueryOptions = (includeArchived = false) =>
  queryOptions({
    queryKey: ["admin-quotes", includeArchived],
    queryFn: () => listQuotes({ data: { includeArchived } }),
  });
```

- [ ] **Step 3: Create `src/components/admin/quote-inbox.tsx`**

```tsx
import { useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { adminQuotesQueryOptions } from "@/lib/queries";
import { deleteQuoteFn, setQuoteStatus, type AdminQuote } from "@/server/admin-quotes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["new", "contacted", "won", "lost", "archived"] as const;

const money = (v: string | number | null) => (v == null ? null : `$${Number(v).toFixed(2)}`);

function subtotal(q: AdminQuote): { total: number; hasUnpriced: boolean } {
  let total = 0, hasUnpriced = false;
  for (const l of q.quote_lines) {
    if (l.unit_amount == null) hasUnpriced = true;
    else total += Number(l.unit_amount) * l.quantity;
  }
  return { total, hasUnpriced };
}

export function QuoteInbox() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const { data: quotes } = useSuspenseQuery(adminQuotesQueryOptions(includeArchived));
  const [open, setOpen] = useState<AdminQuote | null>(null);
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-quotes"] });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: (typeof STATUSES)[number] }) => setQuoteStatus({ data: v }),
    onSuccess: invalidate, onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteQuoteFn({ data: { id } }),
    onSuccess: invalidate, onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch checked={includeArchived} onCheckedChange={setIncludeArchived} /> Show archived
      </label>
      {quotes.length === 0 && <p className="py-10 text-muted-foreground">No quotes yet.</p>}
      <ul className="divide-y rounded-xl border">
        {quotes.map((q) => {
          const { total, hasUnpriced } = subtotal(q);
          return (
            <li key={q.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <button className="font-mono text-sm font-semibold text-primary underline-offset-2 hover:underline"
                onClick={() => setOpen(q)}>
                #{q.reference}
              </button>
              <span className="text-sm">{q.customer_name}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(q.created_at).toLocaleString()} · {q.quote_lines.length} lines ·
                {" "}${total.toFixed(2)}{hasUnpriced ? "+" : ""}
              </span>
              {q.status === "new" && <Badge>New</Badge>}
              {q.email_status === "failed" && <Badge variant="destructive">Email failed</Badge>}
              <div className="ml-auto flex items-center gap-2">
                <Select value={q.status}
                  onValueChange={(status) => setStatus.mutate({ id: q.id, status: status as (typeof STATUSES)[number] })}>
                  <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm"
                  onClick={() => { if (window.confirm(`Delete quote #${q.reference}?`)) del.mutate(q.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {open && (
        <Dialog open onOpenChange={(o) => { if (!o) setOpen(null); }}>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
            <DialogHeader><DialogTitle>Quote #{open.reference}</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                <strong>{open.customer_name}</strong><br />
                <a className="text-primary" href={`mailto:${open.customer_email}`}>{open.customer_email}</a>
                {open.customer_phone && <> · <a className="text-primary" href={`tel:${open.customer_phone}`}>{open.customer_phone}</a></>}
              </p>
              <p className="text-muted-foreground">
                Event: {open.event_date ?? "—"} · Guests: {open.guest_count ?? "—"}
              </p>
              {open.notes && <p className="rounded-lg bg-secondary/50 p-3">{open.notes}</p>}
              <ul className="divide-y rounded-lg border">
                {open.quote_lines.map((l) => (
                  <li key={l.id} className="flex items-center justify-between px-3 py-2">
                    <span>
                      {l.item_name}{l.tier_label ? ` (${l.tier_label})` : ""} × {l.quantity}
                      <span className="block text-xs text-muted-foreground">{l.category_name} · {l.section_name}</span>
                    </span>
                    <span className="font-medium">
                      {l.unit_amount == null ? "On request" : money(Number(l.unit_amount) * l.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-right font-semibold">
                Subtotal: ${subtotal(open).total.toFixed(2)}{subtotal(open).hasUnpriced ? " + items on request" : ""}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Mount** in `src/routes/admin.tsx` quotes tab (with Suspense, same pattern as Task 16), and add the new-quote count badge on the tab trigger (spec §3). In `AdminPage`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { adminQuotesQueryOptions } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
// inside the component (non-suspending — renders nothing until loaded):
const { data: quotesForBadge } = useQuery(adminQuotesQueryOptions());
const newCount = quotesForBadge?.filter((q) => q.status === "new").length ?? 0;
```

```tsx
<TabsTrigger value="quotes">
  Quotes {newCount > 0 && <Badge className="ml-1.5">{newCount}</Badge>}
</TabsTrigger>
```

- [ ] **Step 5: Manual verify** — the quote submitted in Task 12 appears with its lines and correct subtotal; change status new→contacted (persists after reload); archive hides it unless "Show archived"; the `email_status='failed'` test row shows the red badge; delete removes.

- [ ] **Step 6: Commit** — `git add src/server/admin-quotes.ts src/components/admin/quote-inbox.tsx src/lib/queries.ts src/routes/admin.tsx && git commit -m "feat: db-backed admin quote inbox with statuses"`

# Phase 4 — Enterprise email via Microsoft Graph

### Task 19: Graph sender + Azure runbook

**Files:**
- Replace stub: `src/lib/email/graph.ts`
- Create: `docs/runbooks/azure-email-setup.md`

- [ ] **Step 1: Implement `src/lib/email/graph.ts`** (replaces the Task 9 stub; `GraphConfig` interface unchanged)

```ts
import type { EmailSender } from "./types";

export interface GraphConfig { tenantId: string; clientId: string; clientSecret: string; mailbox: string }

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(cfg: GraphConfig): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;
  const res = await fetch(`https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Graph token request failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

export function createGraphSender(cfg: GraphConfig): EmailSender {
  return {
    async send(msg) {
      const token = await getToken(cfg);
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.mailbox)}/sendMail`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              subject: msg.subject,
              body: { contentType: "HTML", content: msg.html },
              toRecipients: [{ emailAddress: { address: msg.to } }],
            },
            saveToSentItems: true,
          }),
        },
      );
      // Graph returns 202 Accepted on success
      if (res.status !== 202) throw new Error(`Graph sendMail failed: ${res.status} ${await res.text()}`);
    },
  };
}
```

- [ ] **Step 2: Verify existing tests still pass** — `npx vitest run` — Expected: all pass (the provider-selection graph test only checks config validation).

- [ ] **Step 3: Write `docs/runbooks/azure-email-setup.md`** — the exact steps the user performs in their tenant:

```markdown
# Sending quote emails through the Azure tenant (Microsoft Graph)

## One-time Azure setup (tenant admin)

1. **App registration**: Entra admin center → App registrations → New registration.
   Name: `boys-catering-mailer`. Single tenant. No redirect URI. Note the
   **Application (client) ID** and **Directory (tenant) ID**.
2. **Secret**: Certificates & secrets → New client secret (24 mo). Copy the
   **Value** immediately.
3. **Permission**: API permissions → Add → Microsoft Graph → **Application
   permissions** → `Mail.Send` → Add. Then **Grant admin consent**.
4. **Scope it down** (important): by default `Mail.Send` lets the app send as
   ANY mailbox in the tenant. Restrict it with an Exchange application access
   policy (Exchange Online PowerShell):

   ```powershell
   Connect-ExchangeOnline
   New-DistributionGroup -Name "boys-catering-mailer-allowed" -Type Security
   Add-DistributionGroupMember -Identity "boys-catering-mailer-allowed" -Member catering@YOURDOMAIN.com
   New-ApplicationAccessPolicy -AppId <CLIENT_ID> -PolicyScopeGroupId "boys-catering-mailer-allowed" `
     -AccessRight RestrictAccess -Description "Limit catering mailer to its mailbox"
   Test-ApplicationAccessPolicy -AppId <CLIENT_ID> -Identity catering@YOURDOMAIN.com   # → AccessCheckResult: Granted
   ```

5. The sending mailbox must be a real licensed mailbox (or shared mailbox) —
   `GRAPH_SENDER_MAILBOX` is its address.

## Switching the app

Set in Vercel (and `.env.local` for testing):

    EMAIL_PROVIDER=graph
    AZURE_TENANT_ID=…
    AZURE_CLIENT_ID=…
    AZURE_CLIENT_SECRET=…
    GRAPH_SENDER_MAILBOX=catering@YOURDOMAIN.com

Redeploy. No code changes. Roll back by setting `EMAIL_PROVIDER=resend`.

## Verify

Submit a test quote on the live site; both emails should arrive **from** the
tenant mailbox, and the message appears in that mailbox's Sent Items.
```

- [ ] **Step 4: Live verify (when the user has run the runbook):** set the Graph env vars in `.env.local`, `EMAIL_PROVIDER=graph`, restart dev, submit a test quote, confirm both emails deliver from the tenant mailbox and `email_status='sent'`. If Azure isn't ready yet, mark this step deferred in the PR/commit message and keep `EMAIL_PROVIDER=resend` — everything else in this task is still done.

- [ ] **Step 5: Commit** — `git add src/lib/email/graph.ts docs/runbooks/azure-email-setup.md && git commit -m "feat: microsoft graph email sender with azure runbook"`

# Phase 5 — Settings, sitemap, cleanup

### Task 20: Settings — server fns, admin tab, site chrome wiring

**Files:**
- Create: `src/server/settings.ts`, `src/components/admin/settings-form.tsx`
- Modify: `src/lib/queries.ts`, `src/routes/admin.tsx` (mount), `src/components/site-chrome.tsx`, `src/routes/contact.tsx`

- [ ] **Step 1: Implement `src/server/settings.ts`**

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth.server";
import { supabaseAdmin } from "@/lib/supabase.server";

export interface SiteSettings {
  notification_email: string;
  store_hours: string[];
  facebook_url: string | null;
  instagram_url: string | null;
  site_origin: string | null;
}

export const getSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteSettings> => {
    const { data, error } = await supabaseAdmin().from("settings").select("*").eq("id", 1).single();
    if (error) throw new Error(`getSettings: ${error.message}`);
    return {
      notification_email: data.notification_email,
      store_hours: (data.store_hours ?? []) as string[],
      facebook_url: data.facebook_url,
      instagram_url: data.instagram_url,
      site_origin: data.site_origin,
    };
  },
);

export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    notification_email: z.string().trim().email().max(320),
    store_hours: z.array(z.string().trim().min(1).max(200)).max(14),
    facebook_url: z.string().trim().url().max(500).nullable(),
    instagram_url: z.string().trim().url().max(500).nullable(),
    site_origin: z.string().trim().url().max(200).nullable(),
  }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin().from("settings").update(data).eq("id", 1);
    if (error) throw new Error(`updateSettings: ${error.message}`);
    return { ok: true };
  });
```

Append to `src/lib/queries.ts`:

```ts
import { getSettings } from "@/server/settings";

export const settingsQueryOptions = () =>
  queryOptions({ queryKey: ["settings"], queryFn: () => getSettings(), staleTime: 5 * 60 * 1000 });
```

- [ ] **Step 2: Create `src/components/admin/settings-form.tsx`**

```tsx
import { useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { settingsQueryOptions } from "@/lib/queries";
import { updateSettings } from "@/server/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function SettingsForm() {
  const { data } = useSuspenseQuery(settingsQueryOptions());
  const qc = useQueryClient();
  const [email, setEmail] = useState(data.notification_email);
  const [hours, setHours] = useState(data.store_hours.join("\n"));
  const [facebook, setFacebook] = useState(data.facebook_url ?? "");
  const [instagram, setInstagram] = useState(data.instagram_url ?? "");
  const [origin, setOrigin] = useState(data.site_origin ?? "");

  const save = useMutation({
    mutationFn: () => updateSettings({ data: {
      notification_email: email.trim(),
      store_hours: hours.split("\n").map((l) => l.trim()).filter(Boolean),
      facebook_url: facebook.trim() || null,
      instagram_url: instagram.trim() || null,
      site_origin: origin.trim() || null,
    }}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); toast.success("Settings saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <Label>Quote notification email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <p className="mt-1 text-xs text-muted-foreground">New quote requests are sent here.</p>
      </div>
      <div>
        <Label>Store hours (one line each)</Label>
        <Textarea rows={3} value={hours} onChange={(e) => setHours(e.target.value)} />
      </div>
      <div><Label>Facebook URL</Label><Input value={facebook} onChange={(e) => setFacebook(e.target.value)} /></div>
      <div><Label>Instagram URL</Label><Input value={instagram} onChange={(e) => setInstagram(e.target.value)} /></div>
      <div><Label>Site origin (for sitemap)</Label>
        <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="https://catering.example.com" /></div>
      <Button onClick={() => save.mutate()} disabled={save.isPending}>Save settings</Button>
    </div>
  );
}
```

Mount it in the settings tab of `src/routes/admin.tsx` (Suspense-wrapped, as before).

- [ ] **Step 3: Wire `src/components/site-chrome.tsx`** — replace the hardcoded hours line ("Monday – Sunday 8:30am – 6:00pm") and the bare facebook/instagram hrefs:

```tsx
import { useQuery } from "@tanstack/react-query";
import { settingsQueryOptions } from "@/lib/queries";
// inside the component:
const { data: settings } = useQuery(settingsQueryOptions());
```

Header hours span becomes `{settings?.store_hours[0] ?? ""}`; the footer hours block maps `settings?.store_hours`. Social anchors render only when configured:

```tsx
{settings?.facebook_url && (
  <a href={settings.facebook_url} target="_blank" rel="noreferrer" aria-label="Facebook" className="hover:text-accent">
    <Facebook className="h-4 w-4" />
  </a>
)}
```

(same pattern for Instagram). Apply the identical hours swap in `src/routes/contact.tsx`.

- [ ] **Step 4: Manual verify** — change hours + add real social URLs in admin Settings; header/footer/contact update after reload; empty social URL hides its icon; changing notification email routes the next test quote there.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: settings-driven hours, socials, notification email"`

### Task 21: Sitemap absolute URLs

**Files:**
- Modify: `src/routes/sitemap[.]xml.ts`

- [ ] **Step 1:** Replace the empty `BASE_URL` constant with a resolved origin: prefer `settings.site_origin`, fall back to the `SITE_ORIGIN` env var:

```ts
import { supabaseAdmin } from "@/lib/supabase.server";

async function resolveOrigin(): Promise<string> {
  try {
    const { data } = await supabaseAdmin().from("settings").select("site_origin").eq("id", 1).single();
    if (data?.site_origin) return data.site_origin.replace(/\/$/, "");
  } catch { /* fall through */ }
  return (process.env.SITE_ORIGIN ?? "").replace(/\/$/, "");
}
```

Use `const BASE_URL = await resolveOrigin();` inside the handler (keep the rest of the XML generation as-is).

- [ ] **Step 2: Verify** — `curl -s http://localhost:3000/sitemap.xml` — Expected: every `<loc>` starts with the configured origin (set `SITE_ORIGIN=http://localhost:3000` in `.env.local` to see it locally).

- [ ] **Step 3: Commit** — `git add "src/routes/sitemap[.]xml.ts" && git commit -m "fix: sitemap emits absolute urls"`

### Task 22: Retire dead code + final verification

**Files:**
- Modify: `src/lib/menu-store.ts`, `src/data/menu.ts`, `README.md`
- Possibly delete imports across: `src/routes/*.tsx`

- [ ] **Step 1: Strip `src/lib/menu-store.ts`** down to the cart block only. Delete: `OVERLAY_KEY`, `ItemOverride`, `Overlay`, `readOverlay`, `writeOverlay`, `applyOverlay`, `useMenu`, `updateItem`, `resetMenu`, `getOverlay`, `FlatItem`, `flattenMenu`, and the entire "Quote requests" section (`QUOTES_KEY`, `QuoteRequest`, `readQuotes`, `saveQuote`, `deleteQuote`, `useQuotes`). Remove the now-unused `baseMenu`/`itemId` imports.

- [ ] **Step 2: Slim `src/data/menu.ts`** — it is now only the seed script's type source. Keep the raw types + `baseMenu` export (plus `business` info if `quote.tsx`/`contact.tsx` still read it); delete `itemId`, `formatUnit`, `formatPrice`, `isPriced`, `minPrice` if nothing imports them (`npx tsc --noEmit` will tell you). Grep first: `grep -rn "from \"@/data/menu\"" src/`.

- [ ] **Step 3: Full check** — `npm run lint && npx tsc --noEmit && npx vitest run && npm run build` — Expected: all clean; the build emits `.output/` without errors.

- [ ] **Step 4: Final end-to-end pass** (production build: `npm run preview`):
  1. `/` stats and category cards from DB.
  2. `/menu` search + add tiers (incl. an unpriced item and an item with a photo).
  3. `/quote` submit → reference shown; both emails arrive; row in admin inbox.
  4. `/admin` — sign in, create/rename/reorder/toggle/delete catalogue entities, edit tiers, upload/replace/remove a photo, work the quote through new→contacted→won, edit settings.
  5. `/sitemap.xml` absolute URLs; `/admin` still `noindex`.

- [ ] **Step 5: Update `README.md`** — rewrite the Status, Architecture notes, Known limitations, and Deployment sections to describe the Supabase backend, env vars (point at `.env.example`), seed script, admin auth, and the email provider switch. Delete the four resolved limitations (#1–#4); keep anything still true.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "chore: retire localStorage overlay/quotes; update README for supabase backend"`

### Task 23: DB integration tests (local Supabase, opt-in)

**Files:**
- Create: `tests/integration/db.test.ts`

These run only when a **local** Supabase stack is up (`npx supabase start`, requires Docker) — they are skipped otherwise so CI/dev without Docker stays green. They exercise the DB layer directly (schema, cascades, snapshots); the server-fn wrappers are already covered by unit tests + the manual e2e passes, and can't run outside a request context.

- [ ] **Step 1: Write the test**

```ts
// tests/integration/db.test.ts
import { describe, expect, it, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Set both to run: TEST_SUPABASE_URL=http://127.0.0.1:54321 TEST_SUPABASE_SECRET_KEY=<from `npx supabase start` output>
const url = process.env.TEST_SUPABASE_URL;
const key = process.env.TEST_SUPABASE_SECRET_KEY;

describe.skipIf(!url || !key)("supabase schema integration", () => {
  let sb: SupabaseClient;
  beforeAll(() => { sb = createClient(url!, key!, { auth: { persistSession: false } }); });

  it("catalogue CRUD cascades category → section → item → tier", async () => {
    const { data: cat } = await sb.from("categories").insert({ name: "IT Cat" }).select("id").single();
    const { data: sec } = await sb.from("sections")
      .insert({ category_id: cat!.id, name: "IT Sec" }).select("id").single();
    const { data: item } = await sb.from("items")
      .insert({ section_id: sec!.id, name: "IT Item" }).select("id").single();
    await sb.from("price_tiers").insert({ item_id: item!.id, label: "Sm", amount: 5, unit: "each" });

    await sb.from("categories").delete().eq("id", cat!.id);
    const { data: orphans } = await sb.from("items").select("id").eq("id", item!.id);
    expect(orphans).toHaveLength(0); // cascade wiped the whole subtree
  });

  it("quote lines keep snapshots when the item is deleted (SET NULL)", async () => {
    const { data: cat } = await sb.from("categories").insert({ name: "IT Cat2" }).select("id").single();
    const { data: sec } = await sb.from("sections")
      .insert({ category_id: cat!.id, name: "S" }).select("id").single();
    const { data: item } = await sb.from("items")
      .insert({ section_id: sec!.id, name: "Doomed Platter" }).select("id").single();
    const { data: quote } = await sb.from("quotes").insert({
      reference: `IT${Date.now().toString(36).slice(-6).toUpperCase()}`,
      customer_name: "T", customer_email: "t@example.com",
    }).select("id").single();
    await sb.from("quote_lines").insert({
      quote_id: quote!.id, item_id: item!.id, item_name: "Doomed Platter",
      category_name: "IT Cat2", section_name: "S", unit_amount: 42.5, quantity: 2,
    });

    await sb.from("categories").delete().eq("id", cat!.id); // deletes the item via cascade
    const { data: lines } = await sb.from("quote_lines").select("*").eq("quote_id", quote!.id);
    expect(lines).toHaveLength(1);
    expect(lines![0].item_id).toBeNull();
    expect(lines![0].item_name).toBe("Doomed Platter"); // snapshot survives
    await sb.from("quotes").delete().eq("id", quote!.id);
  });

  it("quotes.reference is unique", async () => {
    const ref = `ITDUP${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const row = { reference: ref, customer_name: "T", customer_email: "t@example.com" };
    const first = await sb.from("quotes").insert(row);
    expect(first.error).toBeNull();
    const dup = await sb.from("quotes").insert(row);
    expect(dup.error).not.toBeNull();
    await sb.from("quotes").delete().eq("reference", ref);
  });
});
```

- [ ] **Step 2: Verify the skip path** — `npx vitest run tests/integration/db.test.ts` (without the env vars) — Expected: suite reported as skipped, exit 0.

- [ ] **Step 3: Verify for real (if Docker available)** — `npx supabase start`, apply migrations locally (`npx supabase db reset`), then run with `TEST_SUPABASE_URL` + `TEST_SUPABASE_SECRET_KEY` set (both printed by `supabase start`; the secret/service key works). Expected: 3 tests pass. `npx supabase stop` after.

- [ ] **Step 4: Commit** — `git add tests/integration/db.test.ts && git commit -m "test: opt-in db integration tests against local supabase"`

---

## Deployment checklist (after Phase 2 is live-tested, repeat after Phase 5)

1. Vercel → Project → Settings → Environment Variables: add everything in `.env.example` (production values; `EMAIL_PROVIDER=resend` until Phase 4 is verified).
2. Deploy; run the end-to-end pass from Task 22 Step 4 against the deployed URL.
3. Rotate anything that ever appeared in git history (the old admin passcode is public — it no longer gates anything, but confirm no reused secrets).

## Out of scope (per spec)

Payments, customer accounts, quantity inventory, status-change notification emails, multi-location.




