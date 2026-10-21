-- CVStudio foundation: private helpers, owner allowlist, profile.
-- Reviewed from docs/supabase_schema_proposal.sql. Changes vs the draft:
--   * no `create extension pgcrypto` (gen_random_uuid() is built in);
--   * helpers live in a non-exposed `private` schema with an empty search_path;
--   * the allowlist check is a security-definer function evaluated once per
--     statement via `(select private.is_app_owner())`, not an EXISTS per row;
--   * one policy per command instead of FOR ALL;
--   * localized text accepts a language-neutral `shared` value;
--   * explicit grants (projects differ in default Data API privileges).

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Never let future tables in public inherit privileges for anonymous users.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Localized text: {"en": "...", "fr": "..."} (either may be absent while
-- drafting) or {"shared": "..."} for language-neutral values such as
-- technology names. Mixing both forms is rejected.
create function private.is_localized_text(value jsonb, max_length integer default 5000)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    jsonb_typeof(value) = 'object'
    and not exists (
      select 1 from jsonb_object_keys(value) as k(key)
      where k.key not in ('en', 'fr', 'shared')
    )
    and not exists (
      select 1 from jsonb_each(value) as e(key, val)
      where jsonb_typeof(e.val) <> 'string' or char_length(e.val #>> '{}') > max_length
    )
    and not (value ? 'shared' and (value ? 'en' or value ? 'fr'));
$$;

-- Calendar range check for year + optional month (null month = year precision).
create function private.is_valid_period(
  start_year smallint,
  start_month smallint,
  end_year smallint,
  end_month smallint
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    (start_year is null or start_year between 1900 and 2100)
    and (end_year is null or end_year between 1900 and 2100)
    and (start_month is null or (start_year is not null and start_month between 1 and 12))
    and (end_month is null or (end_year is not null and end_month between 1 and 12))
    and (
      start_year is null or end_year is null
      or (start_year, coalesce(start_month, 1)) <= (end_year, coalesce(end_month, 12))
    );
$$;

-- ---------------------------------------------------------------------------
-- Owner allowlist
-- ---------------------------------------------------------------------------

create table public.app_owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.app_owners is
  'Explicit allowlist. Rows are inserted by an administrator only (service role or SQL editor).';

create function private.is_app_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_owners where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_app_owner() from public;
grant execute on function private.is_app_owner() to authenticated;

alter table public.app_owners enable row level security;

create policy app_owners_select_self on public.app_owners
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.app_owners from anon, authenticated;
grant select on table public.app_owners to authenticated;

-- ---------------------------------------------------------------------------
-- Profile (one per owner)
-- ---------------------------------------------------------------------------

create table public.profiles (
  owner_id uuid primary key references public.app_owners (user_id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  title_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(title_i18n, 160)),
  summary_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(summary_i18n, 2000)),
  location_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(location_i18n, 160)),
  email text check (email is null or (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone text check (phone is null or char_length(phone) <= 40),
  photo_path text check (photo_path is null or char_length(photo_path) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Every provisioned owner gets an (empty) profile row.
create function private.create_owner_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (owner_id) values (new.user_id)
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_owner_profile() from public;

create trigger app_owners_create_profile
  after insert on public.app_owners
  for each row execute function private.create_owner_profile();

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_app_owner()));

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_app_owner()));

create policy profiles_update on public.profiles
  for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_app_owner()))
  with check (owner_id = (select auth.uid()) and (select private.is_app_owner()));

create policy profiles_delete on public.profiles
  for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_app_owner()));

revoke all on table public.profiles from anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
