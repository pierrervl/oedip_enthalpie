-- OEDIP · études et bibliothèques machines (JSONB)

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.studies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studies_user_updated_idx
  on public.studies (user_id, updated_at desc);

create table if not exists public.machine_libraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'default',
  is_default boolean not null default true,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists machine_libraries_user_default_idx
  on public.machine_libraries (user_id)
  where is_default;

create index if not exists machine_libraries_user_updated_idx
  on public.machine_libraries (user_id, updated_at desc);

alter table public.studies enable row level security;
alter table public.machine_libraries enable row level security;

create policy "studies: select own"
  on public.studies for select
  using (auth.uid() = user_id);

create policy "studies: insert own"
  on public.studies for insert
  with check (auth.uid() = user_id);

create policy "studies: update own"
  on public.studies for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "studies: delete own"
  on public.studies for delete
  using (auth.uid() = user_id);

create policy "machine_libraries: select own"
  on public.machine_libraries for select
  using (auth.uid() = user_id);

create policy "machine_libraries: insert own"
  on public.machine_libraries for insert
  with check (auth.uid() = user_id);

create policy "machine_libraries: update own"
  on public.machine_libraries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "machine_libraries: delete own"
  on public.machine_libraries for delete
  using (auth.uid() = user_id);

drop trigger if exists studies_set_updated_at on public.studies;
create trigger studies_set_updated_at
  before update on public.studies
  for each row execute function public.set_updated_at();

drop trigger if exists machine_libraries_set_updated_at on public.machine_libraries;
create trigger machine_libraries_set_updated_at
  before update on public.machine_libraries
  for each row execute function public.set_updated_at();
