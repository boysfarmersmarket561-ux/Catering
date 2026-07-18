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
  amount numeric(10,2),
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
