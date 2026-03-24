-- Add unique constraint on display_name (case-insensitive)
-- First create a unique index on lowercase display_name
create unique index if not exists profiles_display_name_unique_idx 
  on public.profiles (lower(display_name));

-- Add route setter column
alter table if exists public.profiles
  add column if not exists is_route_setter boolean default false,
  add column if not exists route_setter_gym text,
  add column if not exists route_setter_verified_at timestamptz;

-- Index for quick route setter lookups
create index if not exists profiles_is_route_setter_idx 
  on public.profiles (is_route_setter) 
  where is_route_setter = true;
