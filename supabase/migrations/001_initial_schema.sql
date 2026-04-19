-- ============================================================
-- STHLM Triathlon 2026 — Sprint 0 Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. User role enum
create type public.user_role as enum (
  'tl',            -- Tävlingsledare (Race Director) — full access
  'sektionsledare', -- Section leader — access to own section
  'funktionar'     -- Volunteer — read-only own schedule
);

-- 2. Profiles table (extends auth.users)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        public.user_role not null default 'funktionar',
  section_id  uuid,            -- FK to sections table (Sprint 1)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3. Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 4. Auto-create profile on new user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Security helper: bypass-safe TL check (avoids recursive RLS)
-- ============================================================

create or replace function public.is_tl()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'tl'
  );
$$;

grant execute on function public.is_tl() to authenticated;

-- ============================================================
-- Guard trigger: prevents role escalation and email spoofing
-- ============================================================

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer as $$
begin
  -- Email is owned by auth.users — never allow direct changes
  new.email := old.email;

  -- Only TL may change roles
  if new.role != old.role then
    if not public.is_tl() then
      raise exception 'Insufficient privileges to change role';
    end if;
  end if;

  -- Only TL may change section assignments
  if new.section_id is distinct from old.section_id then
    if not public.is_tl() then
      raise exception 'Insufficient privileges to change section assignment';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update only their own full_name
-- (role/email/section_id changes are blocked by guard_profile_update trigger)
create policy "profiles: own update name"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- TL can read all profiles (uses is_tl() to avoid recursive RLS)
create policy "profiles: tl read all"
  on public.profiles for select
  using (public.is_tl());

-- TL can update any profile (role assignment, section assignment)
create policy "profiles: tl update all"
  on public.profiles for update
  using (public.is_tl());

-- ============================================================
-- Grant permissions
-- ============================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ============================================================
-- Seed: elevate your own account to TL
-- Run AFTER logging in once (so auth.users entry exists)
-- ============================================================
-- UPDATE public.profiles
--   SET role = 'tl'
--   WHERE email = '[your-email@example.com]';
