-- OEDIP · droits API complets + rechargement schéma PostgREST
grant usage on schema public to authenticated;

grant select, insert, update, delete on table public.studies to authenticated;
grant select, insert, update, delete on table public.machine_libraries to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;

grant usage, select on all sequences in schema public to authenticated;

notify pgrst, 'reload schema';
