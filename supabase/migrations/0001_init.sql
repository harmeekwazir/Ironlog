-- IronLog: initial Supabase schema for cloud sync.
-- Run this once in the Supabase SQL editor (or via `supabase db push` if using the CLI).
--
-- Notes:
-- - Primary keys are `text`, not native `uuid`, because the app already generates its own
--   client-side ids (crypto.randomUUID() as of the sync rework) and existing local records
--   predate this migration — a text column accepts both without any id remapping.
-- - Timestamp columns synced from the app (started_at, updated_at, etc.) are `bigint`
--   epoch-milliseconds, not `timestamptz` — that's the app's native `Date.now()`
--   representation, so the sync engine never has to convert between epoch-ms and ISO
--   strings. Forward-looking tables not yet written to by the client (chat_*,
--   push_subscriptions) use normal `timestamptz default now()` since Postgres will be
--   the one setting them.
-- - `updated_at` is set by the client and pushed as-is; there is deliberately no
--   server-side trigger overwriting it, so the value used for local last-write-wins
--   comparisons matches what's stored server-side. This trades a little resilience to
--   client clock skew for a much simpler v1 sync engine.
-- - `deleted_at` is a tombstone, not a real delete: local deletes only soft-delete the
--   server row (set deleted_at + updated_at) so other devices' pull cursor sees the
--   change and can remove it locally too. A hard delete on the server would be
--   invisible to a `where updated_at > cursor` pull query, so the delete would never
--   propagate. There's no purge job yet — tombstones accumulate; fine at this scale,
--   worth revisiting if row counts ever become a concern.

-- ── profiles ─────────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  weight_kg numeric,
  height_cm numeric,
  age numeric,
  goal text,
  activity_level text,
  notes text,
  updated_at bigint not null
);

alter table profiles enable row level security;
create policy "profiles_own" on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

-- ── exercises (built-ins have user_id null and are readable by everyone, but are
--    seeded identically client-side by seedExercises() and are never synced — only
--    isCustom rows ever reach this table from the app) ──
create table if not exists exercises (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  muscle_groups text[] not null default '{}',
  equipment text[] not null default '{}',
  category text not null,
  notes text,
  is_custom boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

create index if not exists exercises_user_id_idx on exercises(user_id);
create index if not exists exercises_updated_at_idx on exercises(updated_at);

alter table exercises enable row level security;
create policy "exercises_select_own_or_builtin" on exercises for select
  using (user_id is null or user_id = auth.uid());
create policy "exercises_insert_own" on exercises for insert
  with check (user_id = auth.uid());
create policy "exercises_update_own" on exercises for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "exercises_delete_own" on exercises for delete
  using (user_id = auth.uid());

-- ── workouts ─────────────────────────────────────────────────────────────
create table if not exists workouts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  started_at bigint not null,
  completed_at bigint,
  exercises jsonb not null default '[]',
  notes text,
  total_volume numeric,
  is_template boolean,
  template_id text,
  readiness_id text,
  readiness_score numeric,
  recovery_multiplier numeric,
  session_rpe numeric,
  workload numeric,
  muscle_stress jsonb,
  updated_at bigint not null,
  deleted_at bigint
);

create index if not exists workouts_user_id_idx on workouts(user_id);
create index if not exists workouts_updated_at_idx on workouts(updated_at);

alter table workouts enable row level security;
create policy "workouts_own" on workouts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── personal_records ─────────────────────────────────────────────────────
create table if not exists personal_records (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  type text not null,
  value numeric not null,
  reps numeric,
  weight numeric,
  workout_id text,
  achieved_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

create index if not exists personal_records_user_id_idx on personal_records(user_id);
create index if not exists personal_records_updated_at_idx on personal_records(updated_at);

alter table personal_records enable row level security;
create policy "personal_records_own" on personal_records for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── workout_templates ────────────────────────────────────────────────────
create table if not exists workout_templates (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exercises jsonb not null default '[]',
  created_at bigint not null,
  last_used bigint,
  source_workout_id text,
  updated_at bigint not null,
  deleted_at bigint
);

create index if not exists workout_templates_user_id_idx on workout_templates(user_id);
create index if not exists workout_templates_updated_at_idx on workout_templates(updated_at);

alter table workout_templates enable row level security;
create policy "workout_templates_own" on workout_templates for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── readiness_checks ─────────────────────────────────────────────────────
create table if not exists readiness_checks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  sleep numeric,
  soreness numeric,
  energy numeric,
  stress numeric,
  motivation numeric,
  score numeric,
  recovery_multiplier numeric,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

create index if not exists readiness_checks_user_id_idx on readiness_checks(user_id);
create index if not exists readiness_checks_updated_at_idx on readiness_checks(updated_at);

alter table readiness_checks enable row level security;
create policy "readiness_checks_own" on readiness_checks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Forward-looking tables (unused until their feature ships) ──────────────
-- AI coach chat history. Server/edge-function-driven, so these use normal
-- Postgres-native timestamps rather than the client's epoch-ms convention above.
create table if not exists chat_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table chat_sessions enable row level security;
create policy "chat_sessions_own" on chat_sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists chat_messages (
  id text primary key,
  session_id text not null references chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text,
  audio_url text,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_id_idx on chat_messages(session_id);

alter table chat_messages enable row level security;
create policy "chat_messages_own" on chat_messages for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Web push subscriptions.
create table if not exists push_subscriptions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;
create policy "push_subscriptions_own" on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
