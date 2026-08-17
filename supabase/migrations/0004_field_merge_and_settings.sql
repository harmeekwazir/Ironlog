-- Adds field-level merge support for the single-row-per-user tables (profiles, and the
-- new settings table), plus realtime for settings.
--
-- Why field_updated_at: profiles/settings are a single row per user, synced whole. Pure
-- last-write-wins on the whole row means if device A changes weight and device B
-- changes a sound toggle before either has seen the other's edit, whichever pushes
-- second silently wins and the first device's edit is lost — even though the two edits
-- don't actually conflict. field_updated_at stores a per-field timestamp (jsonb map of
-- column name -> epoch ms) so the client can merge column-by-column: for each field,
-- keep whichever side (local or remote) has the newer timestamp for that specific
-- field, rather than one side winning outright for the whole row.
--
-- Run this after 0001-0003.

alter table profiles add column if not exists field_updated_at jsonb not null default '{}';

create table if not exists settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sound_enabled boolean not null default true,
  haptics_enabled boolean not null default true,
  field_updated_at jsonb not null default '{}',
  updated_at bigint not null
);

alter table settings enable row level security;
create policy "settings_own" on settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger settings_set_updated_at before insert or update on settings
  for each row execute function set_updated_at_epoch_ms();

alter publication supabase_realtime add table settings;
