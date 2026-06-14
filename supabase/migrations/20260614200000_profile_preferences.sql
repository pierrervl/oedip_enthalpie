-- OEDIP · préférences utilisateur (configs d'impression, etc.)
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.preferences is
  'Préférences OEDIP par utilisateur (ex. notePrintPresets).';
