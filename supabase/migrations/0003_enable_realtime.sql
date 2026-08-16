-- Adds every synced table to Supabase's realtime publication, so Postgres Changes
-- (which streams row-level INSERT/UPDATE/DELETE events straight off the WAL via
-- logical replication) can notify connected clients the moment another device's
-- change lands, instead of the app having to poll on a timer.
--
-- Run this after 0001_init.sql and 0002_server_authoritative_updated_at.sql.

alter publication supabase_realtime add table workouts;
alter publication supabase_realtime add table exercises;
alter publication supabase_realtime add table personal_records;
alter publication supabase_realtime add table workout_templates;
alter publication supabase_realtime add table readiness_checks;
alter publication supabase_realtime add table profiles;
