-- OEDIP · administrateurs (publication catalogues de référence, procédures…)

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Administrateur OEDIP — peut publier les catalogues de référence (procédures, etc.).';

create or replace function public.is_oedip_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_oedip_admin() from public;
grant execute on function public.is_oedip_admin() to authenticated, anon;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    lower(new.email) = lower('p.raveleau@enthalpie.fr')
  );
  return new;
end;
$$;

update public.profiles p
set is_admin = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('p.raveleau@enthalpie.fr');

-- reference_catalogs : lecture publique, écriture admin uniquement
grant insert, update on table public.reference_catalogs to authenticated;

drop policy if exists "reference_catalogs: admin insert" on public.reference_catalogs;
create policy "reference_catalogs: admin insert"
  on public.reference_catalogs
  for insert
  to authenticated
  with check (public.is_oedip_admin());

drop policy if exists "reference_catalogs: admin update" on public.reference_catalogs;
create policy "reference_catalogs: admin update"
  on public.reference_catalogs
  for update
  to authenticated
  using (public.is_oedip_admin())
  with check (public.is_oedip_admin());

-- Photos procédures : écriture réservée aux admins
drop policy if exists "procedure_photos_auth_insert" on storage.objects;
drop policy if exists "procedure_photos_auth_update" on storage.objects;
drop policy if exists "procedure_photos_auth_delete" on storage.objects;

create policy "procedure_photos_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'procedure-photos' and public.is_oedip_admin());

create policy "procedure_photos_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'procedure-photos' and public.is_oedip_admin())
  with check (bucket_id = 'procedure-photos' and public.is_oedip_admin());

create policy "procedure_photos_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'procedure-photos' and public.is_oedip_admin());

notify pgrst, 'reload schema';
