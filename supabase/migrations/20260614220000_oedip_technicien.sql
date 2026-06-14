-- OEDIP · rôle technicien (droits édition = admin pour l'instant)

alter table public.profiles
  add column if not exists is_technicien boolean not null default false;

comment on column public.profiles.is_technicien is
  'Technicien OEDIP — édition / publication procédures et catalogues (mêmes droits que admin pour l''instant).';

create or replace function public.is_oedip_technicien()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_technicien from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.is_oedip_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (p.is_admin or p.is_technicien) from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_oedip_technicien() from public;
revoke all on function public.is_oedip_editor() from public;
grant execute on function public.is_oedip_technicien() to authenticated, anon;
grant execute on function public.is_oedip_editor() to authenticated, anon;

-- Droits édition catalogues / photos procédures : admin OU technicien
drop policy if exists "reference_catalogs: admin insert" on public.reference_catalogs;
create policy "reference_catalogs: editor insert"
  on public.reference_catalogs
  for insert
  to authenticated
  with check (public.is_oedip_editor());

drop policy if exists "reference_catalogs: admin update" on public.reference_catalogs;
create policy "reference_catalogs: editor update"
  on public.reference_catalogs
  for update
  to authenticated
  using (public.is_oedip_editor())
  with check (public.is_oedip_editor());

drop policy if exists "procedure_photos_admin_insert" on storage.objects;
drop policy if exists "procedure_photos_admin_update" on storage.objects;
drop policy if exists "procedure_photos_admin_delete" on storage.objects;

create policy "procedure_photos_editor_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'procedure-photos' and public.is_oedip_editor());

create policy "procedure_photos_editor_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'procedure-photos' and public.is_oedip_editor())
  with check (bucket_id = 'procedure-photos' and public.is_oedip_editor());

create policy "procedure_photos_editor_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'procedure-photos' and public.is_oedip_editor());

notify pgrst, 'reload schema';
