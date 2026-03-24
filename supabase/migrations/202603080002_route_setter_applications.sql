-- Create route_setter_applications table to track applications
create table if not exists public.route_setter_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  full_name text not null,
  email text not null,
  gym_name text not null,
  experience text not null,
  additional_info text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamp with time zone,
  reviewed_by uuid references public.profiles(id),
  created_at timestamp with time zone default now() not null
);

-- Index for faster lookups
create index if not exists route_setter_applications_user_id_idx on public.route_setter_applications(user_id);
create index if not exists route_setter_applications_status_idx on public.route_setter_applications(status);

-- RLS policies
alter table public.route_setter_applications enable row level security;

-- Users can view their own applications
create policy "Users can view own applications"
  on public.route_setter_applications
  for select
  using (auth.uid() = user_id);

-- Users can insert their own applications
create policy "Users can submit applications"
  on public.route_setter_applications
  for insert
  with check (auth.uid() = user_id);
