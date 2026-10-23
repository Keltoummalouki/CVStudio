-- AI providers (CLAUDE.md §16, 2026-10-23): Groq answers first and Gemini
-- takes over when Groq is unavailable. An analysis stays one request, so one
-- row in ai_requests and one unit of the daily quota, however many providers
-- it tried. Each provider tried is recorded in ai_request_attempts, for
-- observability and cost accounting; ai_requests.provider and .model name the
-- one that answered (or the last one tried).
--
-- Metadata only, as in ai_requests: never prompts, job posts or answers.
-- Rows are written by finish_ai_request() only; owners can read their own.

alter table public.ai_requests
  add column provider text check (provider is null or provider in ('groq', 'gemini')),
  add constraint ai_requests_owner_id_id_key unique (owner_id, id);

create table public.ai_request_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  request_id uuid not null,
  -- 1 for the provider tried first, 2 for its fallback.
  position smallint not null check (position between 1 and 4),
  provider text not null check (provider in ('groq', 'gemini')),
  model text not null check (char_length(model) between 1 and 80),
  status text not null check (status in ('succeeded', 'failed')),
  error_code text check (error_code is null or error_code ~ '^[a-z_]{1,40}$'),
  http_status smallint check (http_status between 100 and 599),
  -- HTTP calls to this provider, retries included.
  attempts smallint not null check (attempts between 1 and 10),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  thought_tokens integer check (thought_tokens >= 0),
  estimated_cost_usd numeric(12, 6) check (estimated_cost_usd >= 0),
  duration_ms integer not null check (duration_ms >= 0),
  created_at timestamptz not null default now(),
  constraint ai_request_attempts_error check ((status = 'failed') = (error_code is not null)),
  unique (request_id, position),
  -- Through the request, an attempt always belongs to the request's owner.
  foreign key (owner_id, request_id) references public.ai_requests (owner_id, id) on delete cascade
);
create index ai_request_attempts_owner_created_idx
  on public.ai_request_attempts (owner_id, created_at desc);

alter table public.ai_request_attempts enable row level security;
create policy ai_request_attempts_select on public.ai_request_attempts
  for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_app_owner()));
revoke all on table public.ai_request_attempts from anon, authenticated;
grant select on table public.ai_request_attempts to authenticated;

-- As in 20261023100000, plus p_provider_attempts: the providers tried, in
-- order, as [{ "provider", "model", "succeeded", "error_code", "http_status",
-- "attempts", "duration_ms", "input_tokens", "output_tokens",
-- "thought_tokens", "estimated_cost_usd" }]. The request's totals stay the
-- caller's to give; it takes the provider and model of the last attempt.
-- Without the new parameter, it behaves as before.
drop function public.finish_ai_request(uuid, boolean, integer, integer, text, integer, integer, integer, numeric);

create function public.finish_ai_request(
  p_request_id uuid,
  p_succeeded boolean,
  p_attempts integer,
  p_duration_ms integer,
  p_error_code text default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null,
  p_thought_tokens integer default null,
  p_estimated_cost_usd numeric default null,
  p_provider_attempts jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_last jsonb;
begin
  if v_owner is null or not private.is_app_owner() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_provider_attempts) is distinct from 'array'
     or jsonb_array_length(p_provider_attempts) > 4 then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  v_last := p_provider_attempts -> -1;

  update public.ai_requests
     set status = case when p_succeeded then 'succeeded' else 'failed' end,
         error_code = case when p_succeeded then null else coalesce(p_error_code, 'unknown') end,
         attempts = p_attempts,
         input_tokens = p_input_tokens,
         output_tokens = p_output_tokens,
         thought_tokens = p_thought_tokens,
         estimated_cost_usd = p_estimated_cost_usd,
         duration_ms = p_duration_ms,
         provider = coalesce(v_last ->> 'provider', provider),
         model = coalesce(v_last ->> 'model', model),
         finished_at = now()
   where id = p_request_id
     and owner_id = v_owner
     and status = 'pending';
  if not found then
    raise exception 'record_not_found' using errcode = 'P0001';
  end if;

  -- The table's checks bound every field; a value of the wrong type fails the
  -- whole call, so a request is never finished with half of its attempts.
  insert into public.ai_request_attempts (
    owner_id, request_id, position, provider, model, status, error_code, http_status,
    attempts, input_tokens, output_tokens, thought_tokens, estimated_cost_usd, duration_ms
  )
  select v_owner,
         p_request_id,
         entry.position,
         attempt.provider,
         attempt.model,
         case when attempt.succeeded then 'succeeded' else 'failed' end,
         case when attempt.succeeded then null else coalesce(attempt.error_code, 'unknown') end,
         attempt.http_status,
         attempt.attempts,
         attempt.input_tokens,
         attempt.output_tokens,
         attempt.thought_tokens,
         attempt.estimated_cost_usd,
         attempt.duration_ms
    from jsonb_array_elements(p_provider_attempts) with ordinality as entry (value, position)
   cross join lateral jsonb_to_record(entry.value) as attempt (
         provider text,
         model text,
         succeeded boolean,
         error_code text,
         http_status smallint,
         attempts smallint,
         input_tokens integer,
         output_tokens integer,
         thought_tokens integer,
         estimated_cost_usd numeric,
         duration_ms integer
       );
end;
$$;

revoke all on function public.finish_ai_request(uuid, boolean, integer, integer, text, integer, integer, integer, numeric, jsonb) from public, anon;
grant execute on function public.finish_ai_request(uuid, boolean, integer, integer, text, integer, integer, integer, numeric, jsonb) to authenticated;
