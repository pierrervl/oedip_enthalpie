-- OEDIP · catalogues de référence (gammes, machines, composants, procédures, DJU…)
create table if not exists public.reference_catalogs (
  key text primary key,
  name text not null,
  description text,
  payload jsonb not null,
  version int not null default 1,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists reference_catalogs_published_idx
  on public.reference_catalogs (published, key);

alter table public.reference_catalogs enable row level security;

create policy "reference_catalogs: read published"
  on public.reference_catalogs
  for select
  using (published = true);

grant select on table public.reference_catalogs to anon, authenticated;

drop trigger if exists reference_catalogs_set_updated_at on public.reference_catalogs;
create trigger reference_catalogs_set_updated_at
  before update on public.reference_catalogs
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
