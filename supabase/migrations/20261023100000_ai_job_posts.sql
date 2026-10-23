-- AI phase, step 1 (CLAUDE.md §16): the owner's AI settings, a request log
-- that also enforces the daily quota, and job posts with the requirements the
-- owner reviewed.
--
-- ai_requests holds metadata only (feature, model, status, token counts,
-- estimated cost, error code), never prompts, job posts or answers. Owners can
-- read their rows; rows are written only by begin_ai_request() and
-- finish_ai_request(). Those take a per-owner advisory lock, so concurrent
-- requests from any number of server instances queue instead of racing past
-- the quota.
--
-- Errors are raised with SQLSTATE P0001 and one of these messages:
--   ai_disabled, ai_request_in_progress, ai_daily_limit_reached, record_not_found

-- ---------------------------------------------------------------------------
-- Owner settings (one row per owner; no row means the defaults)
-- ---------------------------------------------------------------------------

create table public.owner_settings (
  owner_id uuid primary key default auth.uid() references public.app_owners (user_id) on delete cascade,
  ai_enabled boolean not null default false,
  ai_daily_limit smallint not null default 10 check (ai_daily_limit between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select private.secure_owned_table('public.owner_settings');

-- ---------------------------------------------------------------------------
-- AI request log and quota
-- ---------------------------------------------------------------------------

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.app_owners (user_id),
  feature text not null check (feature in ('job_post_analysis')),
  model text not null check (char_length(model) between 1 and 80),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  error_code text check (error_code is null or error_code ~ '^[a-z_]{1,40}$'),
  attempts smallint not null default 0 check (attempts between 0 and 10),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  thought_tokens integer check (thought_tokens >= 0),
  estimated_cost_usd numeric(12, 6) check (estimated_cost_usd >= 0),
  duration_ms integer check (duration_ms >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint ai_requests_finished check ((status = 'pending') = (finished_at is null))
);
create index ai_requests_owner_started_idx on public.ai_requests (owner_id, started_at desc);

alter table public.ai_requests enable row level security;
create policy ai_requests_select on public.ai_requests
  for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_app_owner()));
revoke all on table public.ai_requests from anon, authenticated;
grant select on table public.ai_requests to authenticated;

-- Starts one AI request for the signed-in owner, or refuses it. The quota
-- counts every request started since midnight UTC, failed ones included, so a
-- retry loop cannot run up costs.
create function public.begin_ai_request(p_feature text, p_model text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_enabled boolean;
  v_limit smallint;
  v_used integer;
  v_id uuid;
begin
  if v_owner is null or not private.is_app_owner() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- Held until this transaction ends: the checks and the insert below are
  -- atomic per owner, whichever server instance calls.
  perform pg_advisory_xact_lock(hashtextextended('cvstudio.ai_requests:' || v_owner::text, 0));

  select ai_enabled, ai_daily_limit into v_enabled, v_limit
    from public.owner_settings
   where owner_id = v_owner;
  if not coalesce(v_enabled, false) then
    raise exception 'ai_disabled' using errcode = 'P0001';
  end if;

  -- A request whose server died never finishes; after two minutes it stops
  -- blocking the next one. Requests are capped at 30 seconds by the app.
  update public.ai_requests
     set status = 'failed', error_code = 'abandoned', finished_at = now()
   where owner_id = v_owner
     and status = 'pending'
     and started_at < now() - interval '2 minutes';

  if exists (
    select 1 from public.ai_requests where owner_id = v_owner and status = 'pending'
  ) then
    raise exception 'ai_request_in_progress' using errcode = 'P0001';
  end if;

  select count(*) into v_used
    from public.ai_requests
   where owner_id = v_owner
     and started_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if v_used >= v_limit then
    raise exception 'ai_daily_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.ai_requests (owner_id, feature, model)
  values (v_owner, p_feature, p_model)
  returning id into v_id;
  return v_id;
end;
$$;

-- Records how a pending request ended. Only the owner's own pending request
-- can be finished, once. Token counts and cost stay null when the provider
-- did not report usage.
create function public.finish_ai_request(
  p_request_id uuid,
  p_succeeded boolean,
  p_attempts integer,
  p_duration_ms integer,
  p_error_code text default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null,
  p_thought_tokens integer default null,
  p_estimated_cost_usd numeric default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_app_owner() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.ai_requests
     set status = case when p_succeeded then 'succeeded' else 'failed' end,
         error_code = case when p_succeeded then null else coalesce(p_error_code, 'unknown') end,
         attempts = p_attempts,
         input_tokens = p_input_tokens,
         output_tokens = p_output_tokens,
         thought_tokens = p_thought_tokens,
         estimated_cost_usd = p_estimated_cost_usd,
         duration_ms = p_duration_ms,
         finished_at = now()
   where id = p_request_id
     and owner_id = (select auth.uid())
     and status = 'pending';
  if not found then
    raise exception 'record_not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.begin_ai_request(text, text) from public, anon;
grant execute on function public.begin_ai_request(text, text) to authenticated;
revoke all on function public.finish_ai_request(uuid, boolean, integer, integer, text, integer, integer, integer, numeric) from public, anon;
grant execute on function public.finish_ai_request(uuid, boolean, integer, integer, text, integer, integer, integer, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Job posts
-- ---------------------------------------------------------------------------

-- `requirements` is a versioned document validated by the app (Zod):
-- { "schemaVersion": 1, "titleAliases": [...], "items": [{ id, label, kind,
-- importance, aliases, note }] }. This bounds its shape and size. CASE keeps
-- every branch strictly true or false: a missing key must fail the check,
-- never yield null (which a CHECK accepts).
create function private.is_requirements_document(value jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when jsonb_typeof(value) is distinct from 'object' then false
    when value ->> 'schemaVersion' is distinct from '1' then false
    when jsonb_typeof(value -> 'titleAliases') is distinct from 'array' then false
    when jsonb_typeof(value -> 'items') is distinct from 'array' then false
    else jsonb_array_length(value -> 'items') <= 60 and octet_length(value::text) <= 65536
  end;
$$;

create table public.job_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  company text not null default '' check (char_length(company) <= 120),
  language text not null default 'other' check (language in ('en', 'fr', 'other')),
  description text not null default '' check (char_length(description) <= 15000),
  requirements jsonb not null default '{"schemaVersion": 1, "titleAliases": [], "items": []}'::jsonb
    check (private.is_requirements_document(requirements)),
  -- When the saved requirements came from an AI analysis the owner reviewed.
  analyzed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id)
);
create index job_posts_owner_updated_idx on public.job_posts (owner_id, updated_at desc);
select private.secure_owned_table('public.job_posts');
