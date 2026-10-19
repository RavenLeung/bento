create extension if not exists pgcrypto;

create table if not exists orders (
  id uuid primary key,
  public_token text not null unique,
  order_code text not null unique,
  status text not null default 'PENDING_PAYMENT',
  pickup_at timestamptz not null,
  customer_name text not null,
  customer_email text not null,
  box_item_id text not null,
  box_name text not null,
  box_capacity integer not null,
  subtotal_cents integer not null,
  total_cents integer not null,
  currency text not null default 'AUD',
  idempotency_key text not null unique,
  allergen_acknowledged boolean not null default false,
  square_order_id text,
  square_payment_id text,
  payment_expires_at timestamptz,
  failure_reason text,
  ready_email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  ready_at timestamptz,
  picked_up_at timestamptz,
  canceled_at timestamptz
);

create index if not exists orders_square_order_id_idx on orders (square_order_id);
create index if not exists orders_pickup_at_status_idx on orders (pickup_at, status);

create table if not exists order_lines (
  id uuid primary key,
  order_id uuid not null references orders(id) on delete cascade,
  catalog_item_id text not null,
  name text not null,
  section text not null,
  unit_price_cents integer not null,
  quantity integer not null,
  line_total_cents integer not null,
  created_at timestamptz not null default now()
);

create index if not exists order_lines_order_id_idx on order_lines (order_id);

create table if not exists catalog_items (
  id text primary key,
  item_id text not null,
  name text not null,
  description text not null default '',
  section text not null,
  category_id text not null,
  price_cents integer not null,
  capacity integer,
  sold_out boolean not null default false,
  dietary_tags jsonb not null default '[]'::jsonb,
  allergens jsonb not null default '[]'::jsonb,
  display_order integer not null default 0,
  image_url text,
  emoji text not null default '🍱',
  color text not null default '#f4c95d',
  synced_at timestamptz not null default now()
);

create index if not exists catalog_items_section_idx on catalog_items (section, display_order);

create table if not exists catalog_sync (
  id text primary key,
  synced_at timestamptz not null default now(),
  item_count integer not null default 0
);

create table if not exists settings (
  id text primary key default 'default',
  accepting_orders boolean not null default true,
  prep_lead_minutes integer not null default 12,
  slot_minutes integer not null default 10,
  slot_capacity integer not null default 6,
  open_time text not null default '10:00',
  close_time text not null default '20:00',
  timezone text not null default 'Australia/Sydney',
  updated_at timestamptz not null default now()
);

insert into settings (id) values ('default') on conflict (id) do nothing;

create table if not exists webhook_events (
  event_id text primary key,
  type text not null,
  payload jsonb not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists webhook_events_status_idx on webhook_events (status, received_at);

create table if not exists outbox_jobs (
  id uuid primary key,
  kind text not null,
  payload jsonb not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  run_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outbox_jobs_status_run_at_idx on outbox_jobs (status, run_at);

create table if not exists staff_otps (
  id uuid primary key,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists staff_otps_email_idx on staff_otps (email, created_at);
