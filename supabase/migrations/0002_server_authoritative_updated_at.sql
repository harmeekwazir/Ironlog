-- Makes the database server the single authority for `updated_at` on every synced
-- table, instead of trusting each client device's own clock.
--
-- Why: the sync engine's pull cursor works by asking "give me everything with
-- updated_at greater than the last value I saw". That only works if updated_at values
-- are drawn from one consistent clock. Previously the client stamped updated_at with
-- its own Date.now() before pushing — if two devices' clocks aren't in sync (even by a
-- few minutes), a device that already pulled a recent watermark can permanently miss a
-- genuinely newer edit from a device whose clock reads slightly behind. No error, the
-- row just silently never matches `gt(updated_at, cursor)` again. This trigger removes
-- client clocks from the equation entirely: whatever a client sends for updated_at is
-- overwritten with the server's own clock on every insert/update, so the cursor is
-- always comparing timestamps from one authoritative source.
--
-- Run this after 0001_init.sql.

create or replace function set_updated_at_epoch_ms()
returns trigger as $$
begin
  new.updated_at := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  return new;
end;
$$ language plpgsql;

create trigger workouts_set_updated_at before insert or update on workouts
  for each row execute function set_updated_at_epoch_ms();

create trigger exercises_set_updated_at before insert or update on exercises
  for each row execute function set_updated_at_epoch_ms();

create trigger personal_records_set_updated_at before insert or update on personal_records
  for each row execute function set_updated_at_epoch_ms();

create trigger workout_templates_set_updated_at before insert or update on workout_templates
  for each row execute function set_updated_at_epoch_ms();

create trigger readiness_checks_set_updated_at before insert or update on readiness_checks
  for each row execute function set_updated_at_epoch_ms();

create trigger profiles_set_updated_at before insert or update on profiles
  for each row execute function set_updated_at_epoch_ms();
