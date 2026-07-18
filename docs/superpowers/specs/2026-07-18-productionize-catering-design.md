# Design: Productionize The Boys Catering

**Date:** 2026-07-18
**Status:** Approved by user

## Goal

Take the working front-end prototype to production: a Supabase backend, a real
admin portal for full catalogue management (items, images, prices, categories,
ordering, availability), a functional customer quote flow that actually reaches
the business, and email delivery with a temporary provider now and an
Azure-tenant provider later.

## Decisions (from brainstorming)

| Question | Decision |
| --- | --- |
| Order model | Quote request — no payment processing |
| Admin auth | Supabase Auth, invite-only email+password; public signup disabled |
| Customer auth | Guest-only, no accounts |
| Emails on submit | Business notification + customer confirmation |
| Temporary email provider | Resend |
| Enterprise email provider | Microsoft Graph `sendMail` via user's Azure tenant |
| Inventory depth | Active/hidden availability toggle; no quantity tracking |
| Architecture | Approach A — Supabase as full backend, TanStack Start server functions as the only API layer |

## Architecture overview

- **Database:** Supabase Postgres replaces `src/data/menu.json` as the source
  of truth. A one-time seed script imports the current catalogue (231 items,
  45 sections, 8 categories). The localStorage overlay system
  (`boys-menu-overlay-v1`) retires.
- **Images:** Supabase Storage bucket for item and category photos.
- **Auth:** Supabase Auth for admin staff only.
- **API:** TanStack Start server functions perform all reads and writes. The
  browser never talks to Supabase directly; the service-role key exists only
  server-side. RLS is enabled deny-all as defense in depth.
- **Data fetching:** React Query (already installed) over server functions,
  SSR-rendered for the customer pages.
- **Email:** a single `EmailSender` interface with Resend and Microsoft Graph
  implementations, selected by `EMAIL_PROVIDER` env var.
- **Hosting:** unchanged — Vercel (Nitro Node output) + Supabase cloud project.

## 1. Data model

```
categories    id (uuid), name, description?, image_path?, sort_order, active
sections      id (uuid), category_id FK, name, note?, sort_order, active
items         id (uuid), section_id FK, name, description?, size?, serves?,
              image_path?, sort_order, active
price_tiers   id (uuid), item_id FK, label, amount numeric NULL
              (NULL = price on request), unit, sort_order
quotes        id (uuid), reference (8-char, unique), status
              (new|contacted|won|lost|archived), customer_name,
              customer_email, customer_phone?, event_date?, event_details,
              notes?, email_status (pending|sent|failed), created_at
quote_lines   id (uuid), quote_id FK, item_id FK NULL (SET NULL on item
              delete), item_name_snapshot, tier_label_snapshot,
              unit_snapshot, unit_amount_snapshot NULL, quantity
settings      single row: store hours, social links (Facebook/Instagram
              URLs), business notification email, production origin
```

Design points:

- **UUIDs everywhere.** Item identity is no longer derived from
  `category__section__name`, fixing the rename-orphans-overlay bug.
- **Quote lines snapshot** the item name, tier label, unit, and amount at
  submission time, so historical quotes survive menu edits and deletions.
- **`amount NULL` means "price on request"** — replaces the empty-`prices`
  convention. Unpriced lines are excluded from subtotals, same as today.
- **`settings`** absorbs the store hours currently hardcoded in three places
  and the placeholder social links.
- **Seed script** (`scripts/seed.ts` or SQL migration) converts `menu.json`
  into these tables, preserving current ordering as `sort_order`.

## 2. Admin portal — catalogue management

The current flat item-edit list is replaced with full structural control:

- **Catalogue tree:** categories → sections → items with drag-and-drop
  reordering at every level (`sort_order`). The customer menu renders in
  exactly this order. Create, rename, and delete at every level.
- **Active toggles at every level:** flipping an item, section, or category
  to hidden removes it from the customer site immediately without deleting
  it. Hidden entities render greyed-out in admin.
- **Item editor:** name, description, size, serves, active switch, image,
  and price tiers.
  - **Images:** drag-and-drop upload with preview; one photo per item, and each
    category can also carry a photo used on the homepage category card. Uploaded through a server function to
    Supabase Storage; images are resized/compressed on upload (client-side
    canvas resize before transfer) so phone photos are fine. Replacing
    uploads over the old path; removing clears `image_path`. Items without
    images render as today (no image slot).
  - **Price tiers:** add, remove, reorder; each tier has a label, a unit
    (platter, per_person, per_lb, per_foot, each, per_kabob, per_pastry,
    per_pieces), and either a numeric amount or a "price on request" state.
- **Immediate publish:** edits go live as soon as they save. The active
  toggle is the "not ready yet" mechanism. No draft/publish workflow.
- **Deletes are confirmed** with a dialog stating blast radius (e.g. "this
  section contains 12 items"). Deleting an item nulls `quote_lines.item_id`
  but snapshots keep old quotes readable.
- **Dashboard stats** (item counts, priced vs unpriced, per-category
  badges) are retained, computed from the DB.

## 3. Admin portal — quotes and auth

- **Quote inbox** backed by the `quotes` table: list view with status
  workflow (new → contacted → won/lost), full detail view with itemized
  lines, archive and delete, and a badge with the count of `new` quotes.
  Quotes whose `email_status` is `failed` are visibly flagged.
- **Auth:** Supabase Auth, invite-only email+password. Staff accounts are
  created via the Supabase dashboard (or invite email); public signup is
  disabled. Sessions are HTTP-only cookies (`@supabase/ssr`); every admin
  server function validates the session server-side before acting. The
  hardcoded passcode and `sessionStorage` flag are removed. `/admin` stays
  `noindex` and disallowed in robots.txt.

## 4. Customer site

- **Menu pages** read from the DB via server functions + React Query,
  SSR-rendered. Search and category filtering behavior unchanged. Item
  photos appear on menu cards when present. Inactive items/sections/
  categories are excluded at the query level.
- **Homepage stats** (item/category counts) are computed from the DB
  instead of hardcoded literals; the menu search placeholder count too.
- **Cart stays in localStorage** (`boys-quote-cart-v1`) — guest flow,
  works today, no server round-trips needed. Cart lines reference items by
  UUID + tier id.
- **Quote submission:** the form is rebuilt on react-hook-form + zod (both
  installed). Submit calls a server function that:
  1. Validates input (zod) and re-resolves current prices server-side.
  2. Writes `quotes` + `quote_lines` with snapshots and generates the
     8-char reference.
  3. Attempts both emails; records `email_status`.
  4. Returns the reference for the confirmation screen.
  The quote is committed **before** any email attempt — email failure can
  never lose an order. The existing "email a copy" mailto and print actions
  remain.

## 5. Email

```ts
interface EmailSender {
  send(msg: { to: string; subject: string; html: string; text: string }): Promise<void>
}
```

- **`ResendSender` (phase 1):** Resend API with `RESEND_API_KEY`. Domain
  verification for proper from-addresses; free tier covers expected volume.
- **`GraphSender` (phase 2):** Azure app registration with `Mail.Send`
  application permission, restricted by an Exchange application access
  policy to the designated sending mailbox. Client-credentials flow, then
  `POST /users/{mailbox}/sendMail`. Env: `AZURE_TENANT_ID`,
  `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `GRAPH_SENDER_MAILBOX`.
- **Selection:** `EMAIL_PROVIDER=resend|graph` at boot. No code changes to
  switch.
- **Messages sent on quote submit:**
  1. Business notification to the settings-configured inbox: customer
     details + itemized order + subtotal + link to the admin quote.
  2. Customer confirmation: reference number + order copy. This backs the
     site's existing "we'll email a confirmation" promise.

## 6. Security & robustness

- Service-role key server-only; anon key unused by the browser (no direct
  Supabase client on the client).
- RLS enabled on all tables with deny-all policies (server functions use
  the service role and bypass RLS; RLS exists so a leaked anon key exposes
  nothing).
- All server function inputs validated with zod.
- Public quote endpoint: honeypot form field + basic per-IP throttling to
  limit bot spam.
- Storage bucket: public read (menu images are public content), writes only
  through authenticated admin server functions.
- Sitemap `BASE_URL` set to the production origin (fixes relative-URL bug).

## 7. Testing & deployment

- **Vitest** unit tests: subtotal/pricing math (incl. unpriced exclusion),
  quote input validation, email provider selection, reference generation.
- **Integration tests** for server functions against a local Supabase
  (`supabase start`) covering quote submission and catalogue CRUD.
- **Deployment:** Vercel as today. New env vars: `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, and
  later the four Graph vars. Supabase migrations checked into the repo
  (`supabase/migrations/`).

## Out of scope

- Payment processing (schema does not preclude adding it later).
- Customer accounts.
- Quantity-tracked inventory.
- Quote status-change notification emails to customers (can be added to the
  inbox workflow later).
- Multi-language, multi-location.

## Phasing

1. **Backend foundation:** Supabase project, schema + migrations, seed from
   `menu.json`, server functions for reads; customer site reads from DB.
2. **Quote flow:** submission server function, emails via Resend, rebuilt
   form, confirmation.
3. **Admin portal:** Supabase Auth, catalogue tree CRUD + reorder +
   toggles, image uploads, price tier editor, quote inbox.
4. **Azure email:** Graph sender + app registration runbook; flip
   `EMAIL_PROVIDER`.
5. **Cleanup:** remove menu.json/overlay code paths, sitemap fix, derived
   stats, settings-driven hours/socials.
