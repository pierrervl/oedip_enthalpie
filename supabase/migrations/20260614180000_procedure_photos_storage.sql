-- OEDIP · bucket Storage pour photos de procédures (lecture publique)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'procedure-photos',
  'procedure-photos',
  true,
  52428800,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "procedure_photos_public_read" on storage.objects;
create policy "procedure_photos_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'procedure-photos');

drop policy if exists "procedure_photos_auth_insert" on storage.objects;
create policy "procedure_photos_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'procedure-photos');

drop policy if exists "procedure_photos_auth_update" on storage.objects;
create policy "procedure_photos_auth_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'procedure-photos');

drop policy if exists "procedure_photos_auth_delete" on storage.objects;
create policy "procedure_photos_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'procedure-photos');
