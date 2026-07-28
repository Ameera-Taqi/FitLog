-- =====================================================================
-- Workout schedules — assign library workouts to calendar days
-- Run in the Supabase SQL editor if not already applied.
-- =====================================================================

create table if not exists public.workout_schedules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade default auth.uid(),
  workout_id      uuid not null references public.workouts(id) on delete cascade,
  scheduled_date  date not null,
  created_at      timestamptz not null default now(),
  constraint workout_schedules_unique_day unique (workout_id, scheduled_date)
);

create index if not exists idx_workout_schedules_user_date
  on public.workout_schedules (user_id, scheduled_date desc);

create index if not exists idx_workout_schedules_workout
  on public.workout_schedules (workout_id);

alter table public.workout_schedules enable row level security;

drop policy if exists "own schedules - select" on public.workout_schedules;
create policy "own schedules - select"
  on public.workout_schedules for select
  using (auth.uid() = user_id);

drop policy if exists "own schedules - insert" on public.workout_schedules;
create policy "own schedules - insert"
  on public.workout_schedules for insert
  with check (auth.uid() = user_id);

drop policy if exists "own schedules - update" on public.workout_schedules;
create policy "own schedules - update"
  on public.workout_schedules for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own schedules - delete" on public.workout_schedules;
create policy "own schedules - delete"
  on public.workout_schedules for delete
  using (auth.uid() = user_id);

-- Backfill: one schedule per existing workout on its workout_date
insert into public.workout_schedules (user_id, workout_id, scheduled_date)
select w.user_id, w.id, w.workout_date
from public.workouts w
on conflict (workout_id, scheduled_date) do nothing;
