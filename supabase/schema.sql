-- ============================================================
-- Pocket — Supabase Schema
-- Run this entire file in Supabase → SQL Editor → New query
-- ============================================================

-- ── 0. Extensions ────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── 1. Profiles ──────────────────────────────────────────────
-- Mirrors auth.users; populated automatically via trigger below
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null default '',
  email      text not null default '',
  created_at timestamptz not null default now()
);

-- Auto-create a profile whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. Groups ────────────────────────────────────────────────
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ── 3. Group members ─────────────────────────────────────────
create table if not exists public.group_members (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

-- ── 4. Expenses ──────────────────────────────────────────────
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id) on delete cascade,
  paid_by       uuid not null references public.profiles(id),
  description   text not null,
  amount        numeric(12,2) not null check (amount > 0),
  is_recurring  boolean not null default false,
  recur_day     int check (recur_day between 1 and 28),   -- day-of-month
  created_at    timestamptz not null default now()
);

-- ── 5. Expense splits ────────────────────────────────────────
create table if not exists public.expense_splits (
  id         uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id    uuid not null references public.profiles(id),
  amount     numeric(12,2) not null check (amount >= 0),
  unique (expense_id, user_id)
);

-- ── 6. Settlements ───────────────────────────────────────────
create table if not exists public.settlements (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  paid_by    uuid not null references public.profiles(id),
  paid_to    uuid not null references public.profiles(id),
  amount     numeric(12,2) not null check (amount > 0),
  note       text,
  created_at timestamptz not null default now(),
  check (paid_by <> paid_to)
);

-- ── 7. Row-Level Security ────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements    enable row level security;

-- profiles: anyone can read; only the owner can update their own
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- groups: members can see; auth users can create
create policy "groups_select" on public.groups for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = id and gm.user_id = auth.uid()
    )
  );
create policy "groups_insert" on public.groups for insert with check (auth.uid() = created_by);

-- group_members: members can see their group's members; auth users can join
create policy "gm_select" on public.group_members for select
  using (
    exists (
      select 1 from public.group_members gm2
      where gm2.group_id = group_id and gm2.user_id = auth.uid()
    )
  );
create policy "gm_insert" on public.group_members for insert with check (auth.uid() = user_id);

-- expenses: group members can see & insert
create policy "expenses_select" on public.expenses for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid()
    )
  );
create policy "expenses_insert" on public.expenses for insert
  with check (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid()
    )
  );

-- expense_splits: readable by group members
create policy "splits_select" on public.expense_splits for select
  using (
    exists (
      select 1 from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where e.id = expense_id and gm.user_id = auth.uid()
    )
  );
create policy "splits_insert" on public.expense_splits for insert
  with check (
    exists (
      select 1 from public.expenses e
      join public.group_members gm on gm.group_id = e.group_id
      where e.id = expense_id and gm.user_id = auth.uid()
    )
  );

-- settlements: group members can see & insert
create policy "settlements_select" on public.settlements for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid()
    )
  );
create policy "settlements_insert" on public.settlements for insert
  with check (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_id and gm.user_id = auth.uid()
    )
  );

-- ── 8. Useful view: group activity feed ─────────────────────
create or replace view public.activity_feed as
  select
    e.group_id,
    e.id          as ref_id,
    'expense'     as type,
    p.name        as actor_name,
    e.description as description,
    e.amount      as amount,
    e.created_at  as created_at
  from public.expenses e
  join public.profiles p on p.id = e.paid_by
  union all
  select
    s.group_id,
    s.id                                                   as ref_id,
    'settlement'                                           as type,
    payer.name                                             as actor_name,
    payer.name || ' paid ' || payee.name                  as description,
    s.amount                                               as amount,
    s.created_at                                           as created_at
  from public.settlements s
  join public.profiles payer on payer.id = s.paid_by
  join public.profiles payee on payee.id = s.paid_to;

-- ── 9. Demo seed data ────────────────────────────────────────
-- NOTE: This section uses the service-role key in scripts/seed.ts
-- The SQL below is for reference; run seed.ts to actually populate data.
-- (Seed creates 4 demo users and one "Demo House" group with sample expenses.)
