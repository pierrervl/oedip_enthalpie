-- OEDIP · droits API PostgREST pour les rôles Supabase Auth
grant select, insert, update, delete on table public.studies to authenticated;
grant select, insert, update, delete on table public.machine_libraries to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
