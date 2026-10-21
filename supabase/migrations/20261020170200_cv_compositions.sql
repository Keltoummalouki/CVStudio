-- CV documents and saved templates (presets). Both hold a versioned,
-- server-validated composition `definition`; neither references the other
-- with a foreign key, so deleting a template can never affect a document.
-- `revision` increments on every update and enables optimistic concurrency:
-- writers update `where revision = <expected>`, so two tabs cannot silently
-- overwrite each other.

create function private.bump_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision = old.revision + 1;
  return new;
end;
$$;

create table public.cv_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  locale text not null default 'en' check (locale in ('en', 'fr')),
  visual_template_key text not null default 'classic-reference-v1'
    check (visual_template_key in ('classic-reference-v1')),
  schema_version smallint not null default 1 check (schema_version = 1),
  definition jsonb not null default '{"schemaVersion": 1}'::jsonb
    check (jsonb_typeof(definition) = 'object' and octet_length(definition::text) <= 262144),
  revision integer not null default 1 check (revision >= 1),
  -- Provenance only; intentionally not a foreign key.
  created_from_template_id uuid,
  created_from_template_name text check (created_from_template_name is null or char_length(created_from_template_name) <= 120),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cv_documents_definition_version check ((definition ->> 'schemaVersion')::int = schema_version),
  unique (owner_id, id)
);
create index cv_documents_owner_updated_idx on public.cv_documents (owner_id, updated_at desc);
select private.secure_owned_table('public.cv_documents');
create trigger cv_documents_bump_revision
  before update on public.cv_documents
  for each row execute function private.bump_revision();

create table public.cv_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.app_owners (user_id),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  locale text not null default 'en' check (locale in ('en', 'fr')),
  visual_template_key text not null default 'classic-reference-v1'
    check (visual_template_key in ('classic-reference-v1')),
  schema_version smallint not null default 1 check (schema_version = 1),
  definition jsonb not null default '{"schemaVersion": 1}'::jsonb
    check (jsonb_typeof(definition) = 'object' and octet_length(definition::text) <= 262144),
  revision integer not null default 1 check (revision >= 1),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cv_templates_definition_version check ((definition ->> 'schemaVersion')::int = schema_version),
  unique (owner_id, id)
);
create index cv_templates_owner_updated_idx on public.cv_templates (owner_id, updated_at desc);
select private.secure_owned_table('public.cv_templates');
create trigger cv_templates_bump_revision
  before update on public.cv_templates
  for each row execute function private.bump_revision();
