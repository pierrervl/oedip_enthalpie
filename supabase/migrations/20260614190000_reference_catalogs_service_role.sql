-- OEDIP · droits service_role sur reference_catalogs (scripts catalog:push / photos:push)
grant all on table public.reference_catalogs to service_role;

notify pgrst, 'reload schema';
