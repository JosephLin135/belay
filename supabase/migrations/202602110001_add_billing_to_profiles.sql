alter table if exists public.profiles
  add column if not exists plan_id text default 'free',
  add column if not exists plan_status text default 'active',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists plan_updated_at timestamptz default now();

create index if not exists profiles_plan_id_idx on public.profiles (plan_id);
