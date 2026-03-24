alter table if exists public.profiles enable row level security;

create policy "profiles_insert_own" on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "profiles_select_own" on public.profiles
  for select
  using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = id);
