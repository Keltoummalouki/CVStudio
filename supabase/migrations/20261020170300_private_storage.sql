-- Private storage for owner assets (profile photos). Files live under
-- "<owner uuid>/..." and are only reachable by that allowlisted owner,
-- through short-lived signed URLs or authenticated downloads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cvstudio-assets',
  'cvstudio-assets',
  false,
  5242880, -- 5 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy cvstudio_assets_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvstudio-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_app_owner())
  );

create policy cvstudio_assets_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cvstudio-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_app_owner())
  );

create policy cvstudio_assets_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cvstudio-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_app_owner())
  )
  with check (
    bucket_id = 'cvstudio-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_app_owner())
  );

create policy cvstudio_assets_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cvstudio-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_app_owner())
  );
