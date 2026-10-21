-- Atomic save functions for career data.
--
-- Each function runs as the caller (security invoker), so every statement is
-- still subject to row level security and the owner allowlist. A record and
-- its children are written in one transaction; children missing from the
-- payload are archived (deleted_at), never hard-deleted, so CVs that
-- reference them stay resolvable.
--
-- Concurrency: record saves pass `expectedUpdatedAt`; collection saves pass
-- `expectedStamp` (the newest updated_at across the collection when it was
-- loaded). A mismatch raises `stale_record` instead of overwriting newer work.
--
-- Errors are raised with SQLSTATE P0001 and one of these messages:
--   stale_record, record_not_found, too_many_items

-- ---------------------------------------------------------------------------
-- Private helpers
-- ---------------------------------------------------------------------------

create function private.raise_stale_or_missing(target regclass, record_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  visible boolean;
begin
  -- Runs as the caller: rows of other owners are invisible, so they read as missing.
  execute format('select exists (select 1 from %s where id = $1)', target)
    into visible using record_id;
  if visible then
    raise exception 'stale_record' using errcode = 'P0001';
  end if;
  raise exception 'record_not_found' using errcode = 'P0001';
end;
$$;

create function private.assert_item_count(items jsonb, maximum integer)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(coalesce(items, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_payload' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(items, '[]'::jsonb)) > maximum then
    raise exception 'too_many_items' using errcode = 'P0001';
  end if;
end;
$$;

create function private.assert_stamp(actual timestamptz, expected timestamptz)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if actual is distinct from expected then
    raise exception 'stale_record' using errcode = 'P0001';
  end if;
end;
$$;

create function private.json_smallint(value jsonb)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case when value is null or jsonb_typeof(value) = 'null' then null else (value #>> '{}')::smallint end;
$$;

create function private.json_text(value jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when value is null or jsonb_typeof(value) = 'null' then null else nullif(btrim(value #>> '{}'), '') end;
$$;

create function private.json_uuid(value jsonb)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when value is null or jsonb_typeof(value) = 'null' or value #>> '{}' = '' then null else (value #>> '{}')::uuid end;
$$;

-- ---------------------------------------------------------------------------
-- Profile (+ links)
-- ---------------------------------------------------------------------------

create function public.save_profile(payload jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_expected timestamptz := nullif(payload ->> 'expectedUpdatedAt', '')::timestamptz;
  v_link jsonb;
  v_link_id uuid;
  v_kept uuid[] := '{}';
  v_position integer := 0;
  v_updated_at timestamptz;
begin
  perform private.assert_item_count(payload -> 'links', 20);

  update public.profiles set
    full_name = coalesce(private.json_text(payload -> 'full_name'), ''),
    title_i18n = coalesce(payload -> 'title_i18n', '{}'::jsonb),
    summary_i18n = coalesce(payload -> 'summary_i18n', '{}'::jsonb),
    location_i18n = coalesce(payload -> 'location_i18n', '{}'::jsonb),
    email = private.json_text(payload -> 'email'),
    phone = private.json_text(payload -> 'phone')
  where owner_id = v_owner and (v_expected is null or updated_at = v_expected);

  if not found then
    perform private.raise_stale_or_missing('public.profiles', v_owner);
  end if;

  for v_link in select value from jsonb_array_elements(coalesce(payload -> 'links', '[]'::jsonb)) loop
    v_link_id := private.json_uuid(v_link -> 'id');
    if v_link_id is null then
      insert into public.profile_links (kind, label_i18n, display_text, url, sort_order)
      values (
        v_link ->> 'kind',
        coalesce(v_link -> 'label_i18n', '{}'::jsonb),
        coalesce(private.json_text(v_link -> 'display_text'), ''),
        v_link ->> 'url',
        v_position
      )
      returning id into v_link_id;
    else
      update public.profile_links set
        kind = v_link ->> 'kind',
        label_i18n = coalesce(v_link -> 'label_i18n', '{}'::jsonb),
        display_text = coalesce(private.json_text(v_link -> 'display_text'), ''),
        url = v_link ->> 'url',
        sort_order = v_position,
        deleted_at = null
      where id = v_link_id;
      if not found then
        raise exception 'record_not_found' using errcode = 'P0001';
      end if;
    end if;
    v_kept := v_kept || v_link_id;
    v_position := v_position + 1;
  end loop;

  update public.profile_links set deleted_at = now()
  where owner_id = v_owner and deleted_at is null and id <> all (v_kept);

  select updated_at into v_updated_at from public.profiles where owner_id = v_owner;
  return jsonb_build_object('id', v_owner, 'updatedAt', v_updated_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- Experience (+ bullets, technologies, paragraphs)
-- ---------------------------------------------------------------------------

create function public.save_experience(payload jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_id uuid := private.json_uuid(payload -> 'id');
  v_expected timestamptz := nullif(payload ->> 'expectedUpdatedAt', '')::timestamptz;
  v_detail jsonb;
  v_detail_id uuid;
  v_kept uuid[] := '{}';
  v_position integer := 0;
  v_updated_at timestamptz;
begin
  perform private.assert_item_count(payload -> 'details', 100);

  if v_id is null then
    insert into public.experiences (
      organization, role_i18n, location_i18n,
      start_year, start_month, end_year, end_month, is_current, sort_order
    )
    values (
      payload ->> 'organization',
      coalesce(payload -> 'role_i18n', '{}'::jsonb),
      coalesce(payload -> 'location_i18n', '{}'::jsonb),
      private.json_smallint(payload -> 'start_year'),
      private.json_smallint(payload -> 'start_month'),
      private.json_smallint(payload -> 'end_year'),
      private.json_smallint(payload -> 'end_month'),
      coalesce((payload ->> 'is_current')::boolean, false),
      (select coalesce(max(e.sort_order) + 1, 0) from public.experiences e where e.owner_id = v_owner)
    )
    returning id into v_id;
  else
    update public.experiences set
      organization = payload ->> 'organization',
      role_i18n = coalesce(payload -> 'role_i18n', '{}'::jsonb),
      location_i18n = coalesce(payload -> 'location_i18n', '{}'::jsonb),
      start_year = private.json_smallint(payload -> 'start_year'),
      start_month = private.json_smallint(payload -> 'start_month'),
      end_year = private.json_smallint(payload -> 'end_year'),
      end_month = private.json_smallint(payload -> 'end_month'),
      is_current = coalesce((payload ->> 'is_current')::boolean, false)
    where id = v_id and (v_expected is null or updated_at = v_expected);
    if not found then
      perform private.raise_stale_or_missing('public.experiences', v_id);
    end if;
  end if;

  for v_detail in select value from jsonb_array_elements(coalesce(payload -> 'details', '[]'::jsonb)) loop
    v_detail_id := private.json_uuid(v_detail -> 'id');
    if v_detail_id is null then
      insert into public.experience_details (experience_id, kind, text_i18n, sort_order)
      values (v_id, v_detail ->> 'kind', coalesce(v_detail -> 'text_i18n', '{}'::jsonb), v_position)
      returning id into v_detail_id;
    else
      update public.experience_details set
        kind = v_detail ->> 'kind',
        text_i18n = coalesce(v_detail -> 'text_i18n', '{}'::jsonb),
        sort_order = v_position,
        deleted_at = null
      where id = v_detail_id and experience_id = v_id;
      if not found then
        raise exception 'record_not_found' using errcode = 'P0001';
      end if;
    end if;
    v_kept := v_kept || v_detail_id;
    v_position := v_position + 1;
  end loop;

  update public.experience_details set deleted_at = now()
  where experience_id = v_id and deleted_at is null and id <> all (v_kept);

  select updated_at into v_updated_at from public.experiences where id = v_id;
  return jsonb_build_object('id', v_id, 'updatedAt', v_updated_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- Project (+ bullets, technologies, paragraphs)
-- ---------------------------------------------------------------------------

create function public.save_project(payload jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_id uuid := private.json_uuid(payload -> 'id');
  v_expected timestamptz := nullif(payload ->> 'expectedUpdatedAt', '')::timestamptz;
  v_detail jsonb;
  v_detail_id uuid;
  v_kept uuid[] := '{}';
  v_position integer := 0;
  v_updated_at timestamptz;
begin
  perform private.assert_item_count(payload -> 'details', 100);

  if v_id is null then
    insert into public.projects (
      title_i18n, description_i18n, project_url, source_url,
      start_year, start_month, end_year, end_month, is_current, sort_order
    )
    values (
      coalesce(payload -> 'title_i18n', '{}'::jsonb),
      coalesce(payload -> 'description_i18n', '{}'::jsonb),
      private.json_text(payload -> 'project_url'),
      private.json_text(payload -> 'source_url'),
      private.json_smallint(payload -> 'start_year'),
      private.json_smallint(payload -> 'start_month'),
      private.json_smallint(payload -> 'end_year'),
      private.json_smallint(payload -> 'end_month'),
      coalesce((payload ->> 'is_current')::boolean, false),
      (select coalesce(max(p.sort_order) + 1, 0) from public.projects p where p.owner_id = v_owner)
    )
    returning id into v_id;
  else
    update public.projects set
      title_i18n = coalesce(payload -> 'title_i18n', '{}'::jsonb),
      description_i18n = coalesce(payload -> 'description_i18n', '{}'::jsonb),
      project_url = private.json_text(payload -> 'project_url'),
      source_url = private.json_text(payload -> 'source_url'),
      start_year = private.json_smallint(payload -> 'start_year'),
      start_month = private.json_smallint(payload -> 'start_month'),
      end_year = private.json_smallint(payload -> 'end_year'),
      end_month = private.json_smallint(payload -> 'end_month'),
      is_current = coalesce((payload ->> 'is_current')::boolean, false)
    where id = v_id and (v_expected is null or updated_at = v_expected);
    if not found then
      perform private.raise_stale_or_missing('public.projects', v_id);
    end if;
  end if;

  for v_detail in select value from jsonb_array_elements(coalesce(payload -> 'details', '[]'::jsonb)) loop
    v_detail_id := private.json_uuid(v_detail -> 'id');
    if v_detail_id is null then
      insert into public.project_details (project_id, kind, text_i18n, sort_order)
      values (v_id, v_detail ->> 'kind', coalesce(v_detail -> 'text_i18n', '{}'::jsonb), v_position)
      returning id into v_detail_id;
    else
      update public.project_details set
        kind = v_detail ->> 'kind',
        text_i18n = coalesce(v_detail -> 'text_i18n', '{}'::jsonb),
        sort_order = v_position,
        deleted_at = null
      where id = v_detail_id and project_id = v_id;
      if not found then
        raise exception 'record_not_found' using errcode = 'P0001';
      end if;
    end if;
    v_kept := v_kept || v_detail_id;
    v_position := v_position + 1;
  end loop;

  update public.project_details set deleted_at = now()
  where project_id = v_id and deleted_at is null and id <> all (v_kept);

  select updated_at into v_updated_at from public.projects where id = v_id;
  return jsonb_build_object('id', v_id, 'updatedAt', v_updated_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- Education and certification (single records)
-- ---------------------------------------------------------------------------

create function public.save_education(payload jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_id uuid := private.json_uuid(payload -> 'id');
  v_expected timestamptz := nullif(payload ->> 'expectedUpdatedAt', '')::timestamptz;
  v_updated_at timestamptz;
begin
  if v_id is null then
    insert into public.educations (
      credential_i18n, institution_i18n, location_i18n, description_i18n,
      start_year, start_month, end_year, end_month, is_current, sort_order
    )
    values (
      coalesce(payload -> 'credential_i18n', '{}'::jsonb),
      coalesce(payload -> 'institution_i18n', '{}'::jsonb),
      coalesce(payload -> 'location_i18n', '{}'::jsonb),
      coalesce(payload -> 'description_i18n', '{}'::jsonb),
      private.json_smallint(payload -> 'start_year'),
      private.json_smallint(payload -> 'start_month'),
      private.json_smallint(payload -> 'end_year'),
      private.json_smallint(payload -> 'end_month'),
      coalesce((payload ->> 'is_current')::boolean, false),
      (select coalesce(max(e.sort_order) + 1, 0) from public.educations e where e.owner_id = v_owner)
    )
    returning id, updated_at into v_id, v_updated_at;
  else
    update public.educations set
      credential_i18n = coalesce(payload -> 'credential_i18n', '{}'::jsonb),
      institution_i18n = coalesce(payload -> 'institution_i18n', '{}'::jsonb),
      location_i18n = coalesce(payload -> 'location_i18n', '{}'::jsonb),
      description_i18n = coalesce(payload -> 'description_i18n', '{}'::jsonb),
      start_year = private.json_smallint(payload -> 'start_year'),
      start_month = private.json_smallint(payload -> 'start_month'),
      end_year = private.json_smallint(payload -> 'end_year'),
      end_month = private.json_smallint(payload -> 'end_month'),
      is_current = coalesce((payload ->> 'is_current')::boolean, false)
    where id = v_id and (v_expected is null or updated_at = v_expected)
    returning updated_at into v_updated_at;
    if not found then
      perform private.raise_stale_or_missing('public.educations', v_id);
    end if;
  end if;

  return jsonb_build_object('id', v_id, 'updatedAt', v_updated_at);
end;
$$;

create function public.save_certification(payload jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_id uuid := private.json_uuid(payload -> 'id');
  v_expected timestamptz := nullif(payload ->> 'expectedUpdatedAt', '')::timestamptz;
  v_updated_at timestamptz;
begin
  if v_id is null then
    insert into public.certifications (
      title_i18n, issuer_i18n, issued_year, issued_month, credential_url, sort_order
    )
    values (
      coalesce(payload -> 'title_i18n', '{}'::jsonb),
      coalesce(payload -> 'issuer_i18n', '{}'::jsonb),
      private.json_smallint(payload -> 'issued_year'),
      private.json_smallint(payload -> 'issued_month'),
      private.json_text(payload -> 'credential_url'),
      (select coalesce(max(c.sort_order) + 1, 0) from public.certifications c where c.owner_id = v_owner)
    )
    returning id, updated_at into v_id, v_updated_at;
  else
    update public.certifications set
      title_i18n = coalesce(payload -> 'title_i18n', '{}'::jsonb),
      issuer_i18n = coalesce(payload -> 'issuer_i18n', '{}'::jsonb),
      issued_year = private.json_smallint(payload -> 'issued_year'),
      issued_month = private.json_smallint(payload -> 'issued_month'),
      credential_url = private.json_text(payload -> 'credential_url')
    where id = v_id and (v_expected is null or updated_at = v_expected)
    returning updated_at into v_updated_at;
    if not found then
      perform private.raise_stale_or_missing('public.certifications', v_id);
    end if;
  end if;

  return jsonb_build_object('id', v_id, 'updatedAt', v_updated_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- Collections: soft skills, spoken languages, skill groups (+ skills)
-- ---------------------------------------------------------------------------

create function public.save_soft_skills(payload jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_item jsonb;
  v_item_id uuid;
  v_kept uuid[] := '{}';
  v_position integer := 0;
  v_stamp timestamptz;
begin
  perform private.assert_item_count(payload -> 'items', 100);
  perform private.assert_stamp(
    (select max(s.updated_at) from public.soft_skills s where s.owner_id = v_owner),
    nullif(payload ->> 'expectedStamp', '')::timestamptz
  );

  for v_item in select value from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) loop
    v_item_id := private.json_uuid(v_item -> 'id');
    if v_item_id is null then
      insert into public.soft_skills (label_i18n, sort_order)
      values (coalesce(v_item -> 'label_i18n', '{}'::jsonb), v_position)
      returning id into v_item_id;
    else
      update public.soft_skills set
        label_i18n = coalesce(v_item -> 'label_i18n', '{}'::jsonb),
        sort_order = v_position,
        deleted_at = null
      where id = v_item_id;
      if not found then
        raise exception 'record_not_found' using errcode = 'P0001';
      end if;
    end if;
    v_kept := v_kept || v_item_id;
    v_position := v_position + 1;
  end loop;

  update public.soft_skills set deleted_at = now()
  where owner_id = v_owner and deleted_at is null and id <> all (v_kept);

  select max(s.updated_at) into v_stamp from public.soft_skills s where s.owner_id = v_owner;
  return jsonb_build_object('stamp', v_stamp);
end;
$$;

create function public.save_spoken_languages(payload jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_item jsonb;
  v_item_id uuid;
  v_kept uuid[] := '{}';
  v_position integer := 0;
  v_stamp timestamptz;
begin
  perform private.assert_item_count(payload -> 'items', 50);
  perform private.assert_stamp(
    (select max(l.updated_at) from public.spoken_languages l where l.owner_id = v_owner),
    nullif(payload ->> 'expectedStamp', '')::timestamptz
  );

  for v_item in select value from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb)) loop
    v_item_id := private.json_uuid(v_item -> 'id');
    if v_item_id is null then
      insert into public.spoken_languages (name_i18n, proficiency_i18n, sort_order)
      values (
        coalesce(v_item -> 'name_i18n', '{}'::jsonb),
        coalesce(v_item -> 'proficiency_i18n', '{}'::jsonb),
        v_position
      )
      returning id into v_item_id;
    else
      update public.spoken_languages set
        name_i18n = coalesce(v_item -> 'name_i18n', '{}'::jsonb),
        proficiency_i18n = coalesce(v_item -> 'proficiency_i18n', '{}'::jsonb),
        sort_order = v_position,
        deleted_at = null
      where id = v_item_id;
      if not found then
        raise exception 'record_not_found' using errcode = 'P0001';
      end if;
    end if;
    v_kept := v_kept || v_item_id;
    v_position := v_position + 1;
  end loop;

  update public.spoken_languages set deleted_at = now()
  where owner_id = v_owner and deleted_at is null and id <> all (v_kept);

  select max(l.updated_at) into v_stamp from public.spoken_languages l where l.owner_id = v_owner;
  return jsonb_build_object('stamp', v_stamp);
end;
$$;

create function private.skill_collection_stamp(owner uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select greatest(
    (select max(g.updated_at) from public.skill_groups g where g.owner_id = owner),
    (select max(s.updated_at) from public.skills s where s.owner_id = owner)
  );
$$;

create function public.save_skill_groups(payload jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_group jsonb;
  v_group_id uuid;
  v_skill jsonb;
  v_skill_id uuid;
  v_kept_groups uuid[] := '{}';
  v_kept_skills uuid[];
  v_group_position integer := 0;
  v_skill_position integer;
begin
  perform private.assert_item_count(payload -> 'groups', 30);
  perform private.assert_stamp(
    private.skill_collection_stamp(v_owner),
    nullif(payload ->> 'expectedStamp', '')::timestamptz
  );

  for v_group in select value from jsonb_array_elements(coalesce(payload -> 'groups', '[]'::jsonb)) loop
    perform private.assert_item_count(v_group -> 'skills', 60);
    v_group_id := private.json_uuid(v_group -> 'id');

    if v_group_id is null then
      insert into public.skill_groups (title_i18n, sort_order)
      values (coalesce(v_group -> 'title_i18n', '{}'::jsonb), v_group_position)
      returning id into v_group_id;
    else
      update public.skill_groups set
        title_i18n = coalesce(v_group -> 'title_i18n', '{}'::jsonb),
        sort_order = v_group_position,
        deleted_at = null
      where id = v_group_id;
      if not found then
        raise exception 'record_not_found' using errcode = 'P0001';
      end if;
    end if;

    v_kept_skills := '{}';
    v_skill_position := 0;
    for v_skill in select value from jsonb_array_elements(coalesce(v_group -> 'skills', '[]'::jsonb)) loop
      v_skill_id := private.json_uuid(v_skill -> 'id');
      if v_skill_id is null then
        insert into public.skills (skill_group_id, label_i18n, sort_order)
        values (v_group_id, coalesce(v_skill -> 'label_i18n', '{}'::jsonb), v_skill_position)
        returning id into v_skill_id;
      else
        -- A skill may move between groups; ownership is enforced by RLS and the composite key.
        update public.skills set
          skill_group_id = v_group_id,
          label_i18n = coalesce(v_skill -> 'label_i18n', '{}'::jsonb),
          sort_order = v_skill_position,
          deleted_at = null
        where id = v_skill_id;
        if not found then
          raise exception 'record_not_found' using errcode = 'P0001';
        end if;
      end if;
      v_kept_skills := v_kept_skills || v_skill_id;
      v_skill_position := v_skill_position + 1;
    end loop;

    update public.skills set deleted_at = now()
    where skill_group_id = v_group_id and deleted_at is null and id <> all (v_kept_skills);

    v_kept_groups := v_kept_groups || v_group_id;
    v_group_position := v_group_position + 1;
  end loop;

  update public.skill_groups set deleted_at = now()
  where owner_id = v_owner and deleted_at is null and id <> all (v_kept_groups);

  return jsonb_build_object('stamp', private.skill_collection_stamp(v_owner));
end;
$$;

-- ---------------------------------------------------------------------------
-- Custom section (+ subsections + items)
-- ---------------------------------------------------------------------------

create function public.save_custom_section(payload jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid := (select auth.uid());
  v_id uuid := private.json_uuid(payload -> 'id');
  v_expected timestamptz := nullif(payload ->> 'expectedUpdatedAt', '')::timestamptz;
  v_sub jsonb;
  v_sub_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_kept_subs uuid[] := '{}';
  v_kept_items uuid[];
  v_sub_position integer := 0;
  v_item_position integer;
  v_updated_at timestamptz;
begin
  perform private.assert_item_count(payload -> 'subsections', 20);

  if v_id is null then
    insert into public.custom_sections (title_i18n, sort_order)
    values (
      coalesce(payload -> 'title_i18n', '{}'::jsonb),
      (select coalesce(max(c.sort_order) + 1, 0) from public.custom_sections c where c.owner_id = v_owner)
    )
    returning id into v_id;
  else
    update public.custom_sections set title_i18n = coalesce(payload -> 'title_i18n', '{}'::jsonb)
    where id = v_id and (v_expected is null or updated_at = v_expected);
    if not found then
      perform private.raise_stale_or_missing('public.custom_sections', v_id);
    end if;
  end if;

  for v_sub in select value from jsonb_array_elements(coalesce(payload -> 'subsections', '[]'::jsonb)) loop
    perform private.assert_item_count(v_sub -> 'items', 60);
    v_sub_id := private.json_uuid(v_sub -> 'id');

    if v_sub_id is null then
      insert into public.custom_subsections (custom_section_id, title_i18n, sort_order)
      values (v_id, coalesce(v_sub -> 'title_i18n', '{}'::jsonb), v_sub_position)
      returning id into v_sub_id;
    else
      update public.custom_subsections set
        title_i18n = coalesce(v_sub -> 'title_i18n', '{}'::jsonb),
        sort_order = v_sub_position,
        deleted_at = null
      where id = v_sub_id and custom_section_id = v_id;
      if not found then
        raise exception 'record_not_found' using errcode = 'P0001';
      end if;
    end if;

    v_kept_items := '{}';
    v_item_position := 0;
    for v_item in select value from jsonb_array_elements(coalesce(v_sub -> 'items', '[]'::jsonb)) loop
      v_item_id := private.json_uuid(v_item -> 'id');
      if v_item_id is null then
        insert into public.custom_items (custom_subsection_id, kind, label_i18n, text_i18n, sort_order)
        values (
          v_sub_id,
          v_item ->> 'kind',
          coalesce(v_item -> 'label_i18n', '{}'::jsonb),
          coalesce(v_item -> 'text_i18n', '{}'::jsonb),
          v_item_position
        )
        returning id into v_item_id;
      else
        update public.custom_items set
          custom_subsection_id = v_sub_id,
          kind = v_item ->> 'kind',
          label_i18n = coalesce(v_item -> 'label_i18n', '{}'::jsonb),
          text_i18n = coalesce(v_item -> 'text_i18n', '{}'::jsonb),
          sort_order = v_item_position,
          deleted_at = null
        where id = v_item_id;
        if not found then
          raise exception 'record_not_found' using errcode = 'P0001';
        end if;
      end if;
      v_kept_items := v_kept_items || v_item_id;
      v_item_position := v_item_position + 1;
    end loop;

    update public.custom_items set deleted_at = now()
    where custom_subsection_id = v_sub_id and deleted_at is null and id <> all (v_kept_items);

    v_kept_subs := v_kept_subs || v_sub_id;
    v_sub_position := v_sub_position + 1;
  end loop;

  update public.custom_subsections set deleted_at = now()
  where custom_section_id = v_id and deleted_at is null and id <> all (v_kept_subs);

  -- Child-only edits must still advance the section's version for concurrency checks.
  update public.custom_sections set updated_at = now() where id = v_id
  returning updated_at into v_updated_at;

  return jsonb_build_object('id', v_id, 'updatedAt', v_updated_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- Ordering and references
-- ---------------------------------------------------------------------------

create function public.reorder_records(target text, ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if target not in ('experiences', 'educations', 'projects', 'certifications', 'custom_sections') then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if coalesce(array_length(ids, 1), 0) > 500 then
    raise exception 'too_many_items' using errcode = 'P0001';
  end if;

  execute format(
    'update public.%I as t set sort_order = o.position - 1
       from unnest($1::uuid[]) with ordinality as o(id, position)
      where t.id = o.id',
    target
  ) using ids;
end;
$$;

-- How many CV documents and templates mention a record id anywhere in their
-- composition. Runs as the caller, so only the owner's own CVs are counted.
create function public.count_record_references(record_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'documents', (
      select count(*) from public.cv_documents d
      where d.deleted_at is null
        and jsonb_path_exists(d.definition, '$.** ? (@ == $id)', jsonb_build_object('id', record_id::text))
    ),
    'templates', (
      select count(*) from public.cv_templates t
      where t.deleted_at is null
        and jsonb_path_exists(t.definition, '$.** ? (@ == $id)', jsonb_build_object('id', record_id::text))
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Privileges: callable by signed-in users only (RLS decides what they touch)
-- ---------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.save_profile(jsonb)',
    'public.save_experience(jsonb)',
    'public.save_project(jsonb)',
    'public.save_education(jsonb)',
    'public.save_certification(jsonb)',
    'public.save_soft_skills(jsonb)',
    'public.save_spoken_languages(jsonb)',
    'public.save_skill_groups(jsonb)',
    'public.save_custom_section(jsonb)',
    'public.reorder_records(text, uuid[])',
    'public.count_record_references(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

-- Private helpers stay unreachable from the API.
revoke all on function private.raise_stale_or_missing(regclass, uuid) from public;
revoke all on function private.assert_item_count(jsonb, integer) from public;
revoke all on function private.assert_stamp(timestamptz, timestamptz) from public;
revoke all on function private.skill_collection_stamp(uuid) from public;
grant execute on function private.raise_stale_or_missing(regclass, uuid) to authenticated;
grant execute on function private.assert_item_count(jsonb, integer) to authenticated;
grant execute on function private.assert_stamp(timestamptz, timestamptz) to authenticated;
grant execute on function private.skill_collection_stamp(uuid) to authenticated;
