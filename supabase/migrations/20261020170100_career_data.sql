-- Canonical career data (master records). Every table is owner-scoped,
-- soft-deletable (deleted_at = archived, still resolvable by existing CVs),
-- ordered by sort_order, and protected by the same policy package.
-- Child tables use (owner_id, parent_id) composite foreign keys so a row can
-- never be attached to another owner's parent.

-- Applies RLS, one policy per command, explicit grants and the updated_at
-- trigger. Used by every owner-scoped table so the rules cannot drift.
create function private.secure_owned_table(target regclass)
returns void
language plpgsql
set search_path = ''
as $$
declare
  rule constant text := 'owner_id = (select auth.uid()) and (select private.is_app_owner())';
  name text;
begin
  select c.relname into name from pg_catalog.pg_class c where c.oid = target;

  execute format('alter table %s enable row level security', target);
  execute format('create policy %I on %s for select to authenticated using (%s)',
    name || '_select', target, rule);
  execute format('create policy %I on %s for insert to authenticated with check (%s)',
    name || '_insert', target, rule);
  execute format('create policy %I on %s for update to authenticated using (%s) with check (%s)',
    name || '_update', target, rule, rule);
  execute format('create policy %I on %s for delete to authenticated using (%s)',
    name || '_delete', target, rule);

  execute format('revoke all on table %s from anon, authenticated', target);
  execute format('grant select, insert, update, delete on table %s to authenticated', target);

  execute format(
    'create trigger %I before update on %s for each row execute function private.touch_updated_at()',
    name || '_touch_updated_at', target);
end;
$$;

revoke all on function private.secure_owned_table(regclass) from public;

-- ---------------------------------------------------------------------------
-- Profile links (GitHub, LinkedIn, portfolio, ...)
-- ---------------------------------------------------------------------------

create table public.profile_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  kind text not null default 'website'
    check (kind in ('linkedin', 'github', 'portfolio', 'website', 'other')),
  label_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(label_i18n, 80)),
  display_text text not null default '' check (char_length(display_text) <= 120),
  url text not null check (char_length(url) <= 2048 and url ~* '^https?://[^[:space:]]+$'),
  sort_order integer not null default 0 check (sort_order >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id)
);
create index profile_links_owner_sort_idx on public.profile_links (owner_id, sort_order, id);
select private.secure_owned_table('public.profile_links');

-- ---------------------------------------------------------------------------
-- Work experience
-- ---------------------------------------------------------------------------

create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  organization text not null check (char_length(btrim(organization)) between 1 and 160),
  role_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(role_i18n, 160)),
  location_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(location_i18n, 160)),
  start_year smallint,
  start_month smallint,
  end_year smallint,
  end_month smallint,
  is_current boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experiences_period check (private.is_valid_period(start_year, start_month, end_year, end_month)),
  constraint experiences_current_has_no_end check (not is_current or (end_year is null and end_month is null)),
  unique (owner_id, id)
);
create index experiences_owner_sort_idx on public.experiences (owner_id, sort_order, id);
select private.secure_owned_table('public.experiences');

create table public.experience_details (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  experience_id uuid not null,
  kind text not null check (kind in ('bullet', 'technology', 'paragraph')),
  text_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(text_i18n, 1000)),
  sort_order integer not null default 0 check (sort_order >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, experience_id) references public.experiences (owner_id, id) on delete cascade,
  unique (owner_id, id)
);
create index experience_details_parent_idx
  on public.experience_details (owner_id, experience_id, kind, sort_order);
select private.secure_owned_table('public.experience_details');

-- ---------------------------------------------------------------------------
-- Education
-- ---------------------------------------------------------------------------

create table public.educations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  credential_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(credential_i18n, 200)),
  institution_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(institution_i18n, 200)),
  location_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(location_i18n, 160)),
  description_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(description_i18n, 2000)),
  start_year smallint,
  start_month smallint,
  end_year smallint,
  end_month smallint,
  is_current boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint educations_period check (private.is_valid_period(start_year, start_month, end_year, end_month)),
  constraint educations_current_has_no_end check (not is_current or (end_year is null and end_month is null)),
  unique (owner_id, id)
);
create index educations_owner_sort_idx on public.educations (owner_id, sort_order, id);
select private.secure_owned_table('public.educations');

-- ---------------------------------------------------------------------------
-- Technical skills: groups (subsections) and individual skills
-- ---------------------------------------------------------------------------

create table public.skill_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  title_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(title_i18n, 80)),
  sort_order integer not null default 0 check (sort_order >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id)
);
create index skill_groups_owner_sort_idx on public.skill_groups (owner_id, sort_order, id);
select private.secure_owned_table('public.skill_groups');

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  skill_group_id uuid not null,
  label_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(label_i18n, 120)),
  sort_order integer not null default 0 check (sort_order >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, skill_group_id) references public.skill_groups (owner_id, id) on delete cascade,
  unique (owner_id, id)
);
create index skills_parent_idx on public.skills (owner_id, skill_group_id, sort_order);
select private.secure_owned_table('public.skills');

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  title_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(title_i18n, 200)),
  description_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(description_i18n, 2000)),
  project_url text check (project_url is null or (char_length(project_url) <= 2048 and project_url ~* '^https?://[^[:space:]]+$')),
  source_url text check (source_url is null or (char_length(source_url) <= 2048 and source_url ~* '^https?://[^[:space:]]+$')),
  start_year smallint,
  start_month smallint,
  end_year smallint,
  end_month smallint,
  is_current boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_period check (private.is_valid_period(start_year, start_month, end_year, end_month)),
  constraint projects_current_has_no_end check (not is_current or (end_year is null and end_month is null)),
  unique (owner_id, id)
);
create index projects_owner_sort_idx on public.projects (owner_id, sort_order, id);
select private.secure_owned_table('public.projects');

create table public.project_details (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  project_id uuid not null,
  kind text not null check (kind in ('bullet', 'technology', 'paragraph')),
  text_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(text_i18n, 1000)),
  sort_order integer not null default 0 check (sort_order >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, project_id) references public.projects (owner_id, id) on delete cascade,
  unique (owner_id, id)
);
create index project_details_parent_idx
  on public.project_details (owner_id, project_id, kind, sort_order);
select private.secure_owned_table('public.project_details');

-- ---------------------------------------------------------------------------
-- Certifications, soft skills, spoken languages
-- ---------------------------------------------------------------------------

create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  title_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(title_i18n, 200)),
  issuer_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(issuer_i18n, 200)),
  issued_year smallint,
  issued_month smallint,
  credential_url text check (credential_url is null or (char_length(credential_url) <= 2048 and credential_url ~* '^https?://[^[:space:]]+$')),
  sort_order integer not null default 0 check (sort_order >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint certifications_issued check (private.is_valid_period(issued_year, issued_month, null, null)),
  unique (owner_id, id)
);
create index certifications_owner_sort_idx on public.certifications (owner_id, sort_order, id);
select private.secure_owned_table('public.certifications');

create table public.soft_skills (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  label_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(label_i18n, 120)),
  sort_order integer not null default 0 check (sort_order >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id)
);
create index soft_skills_owner_sort_idx on public.soft_skills (owner_id, sort_order, id);
select private.secure_owned_table('public.soft_skills');

-- Named spoken_languages (not "languages") so it is never confused with
-- interface or CV output locales.
create table public.spoken_languages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  name_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(name_i18n, 80)),
  proficiency_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(proficiency_i18n, 80)),
  sort_order integer not null default 0 check (sort_order >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id)
);
create index spoken_languages_owner_sort_idx on public.spoken_languages (owner_id, sort_order, id);
select private.secure_owned_table('public.spoken_languages');

-- ---------------------------------------------------------------------------
-- Custom sections -> subsections -> items
-- ---------------------------------------------------------------------------

create table public.custom_sections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  title_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(title_i18n, 120)),
  sort_order integer not null default 0 check (sort_order >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id)
);
create index custom_sections_owner_sort_idx on public.custom_sections (owner_id, sort_order, id);
select private.secure_owned_table('public.custom_sections');

create table public.custom_subsections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  custom_section_id uuid not null,
  title_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(title_i18n, 160)),
  sort_order integer not null default 0 check (sort_order >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, custom_section_id) references public.custom_sections (owner_id, id) on delete cascade,
  unique (owner_id, id)
);
create index custom_subsections_parent_idx
  on public.custom_subsections (owner_id, custom_section_id, sort_order);
select private.secure_owned_table('public.custom_subsections');

create table public.custom_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  custom_subsection_id uuid not null,
  kind text not null check (kind in ('paragraph', 'bullet', 'key_value')),
  label_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(label_i18n, 120)),
  text_i18n jsonb not null default '{}'::jsonb check (private.is_localized_text(text_i18n, 2000)),
  sort_order integer not null default 0 check (sort_order >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_id, custom_subsection_id) references public.custom_subsections (owner_id, id) on delete cascade,
  unique (owner_id, id)
);
create index custom_items_parent_idx on public.custom_items (owner_id, custom_subsection_id, sort_order);
select private.secure_owned_table('public.custom_items');
