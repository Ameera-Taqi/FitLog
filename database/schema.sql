-- =====================================================================
-- FitLog — Gym Tracker · Database schema (reference copy)
-- Already applied to the Supabase project via migrations. This file is
-- here so the schema lives in version control and can be re-created on a
-- fresh project with:  psql < schema.sql   (or paste into the SQL editor)
-- =====================================================================

create extension if not exists pg_trgm;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

-- WORKOUTS ------------------------------------------------------------
create table if not exists public.workouts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name           text not null,
  workout_date   date not null default current_date,
  start_time     timestamptz,
  end_time       timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  workout_type   text not null default 'strength'
                   check (workout_type in ('strength','cardio','mobility','flexibility','hiit','sports','crossfit','other')),
  muscle_groups  text[] not null default '{}',
  calories_burned integer check (calories_burned is null or calories_burned >= 0),
  difficulty     text check (difficulty is null or difficulty in ('easy','moderate','hard','very_hard','max_effort')),
  energy_before  smallint check (energy_before is null or energy_before between 1 and 5),
  mood_after     text check (mood_after is null or mood_after in ('terrible','bad','okay','good','great')),
  notes          text,
  location       text,
  completed      boolean not null default false,
  body_weight    numeric(6,2) check (body_weight is null or body_weight >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- EXERCISES -----------------------------------------------------------
create table if not exists public.exercises (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references public.workouts(id) on delete cascade,
  name         text not null,
  position     integer not null default 0,
  is_pr        boolean not null default false,
  difficulty   text check (difficulty is null or difficulty in ('easy','moderate','hard','very_hard','max_effort')),
  completed    boolean not null default false,
  distance_km  numeric(8,3) check (distance_km is null or distance_km >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  notes        text,
  created_at   timestamptz not null default now()
);

-- If upgrading an existing DB that already has public.exercises:
--   alter table public.exercises add column if not exists difficulty text;
--   alter table public.exercises add column if not exists completed boolean not null default false;

-- EXERCISE SETS -------------------------------------------------------
create table if not exists public.exercise_sets (
  id            uuid primary key default gen_random_uuid(),
  exercise_id   uuid not null references public.exercises(id) on delete cascade,
  set_number    integer not null default 1,
  reps          integer check (reps is null or reps >= 0),
  weight        numeric(7,2) check (weight is null or weight >= 0),
  distance_km   numeric(8,3) check (distance_km is null or distance_km >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  rest_seconds  integer check (rest_seconds is null or rest_seconds >= 0),
  is_pr         boolean not null default false,
  completed     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- PROGRESS PHOTOS -----------------------------------------------------
create table if not exists public.progress_photos (
  id            uuid primary key default gen_random_uuid(),
  workout_id    uuid references public.workouts(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  storage_path  text not null,
  caption       text,
  created_at    timestamptz not null default now()
);

-- INDEXES -------------------------------------------------------------
create index if not exists idx_workouts_user_date   on public.workouts (user_id, workout_date desc);
create index if not exists idx_workouts_type         on public.workouts (user_id, workout_type);
create index if not exists idx_workouts_completed    on public.workouts (user_id, completed);
create index if not exists idx_workouts_difficulty   on public.workouts (user_id, difficulty);
create index if not exists idx_workouts_location     on public.workouts (user_id, location);
create index if not exists idx_workouts_name_trgm    on public.workouts using gin (name gin_trgm_ops);
create index if not exists idx_workouts_muscles      on public.workouts using gin (muscle_groups);
create index if not exists idx_exercises_workout     on public.exercises (workout_id);
create index if not exists idx_exercises_name_trgm   on public.exercises using gin (name gin_trgm_ops);
create index if not exists idx_sets_exercise         on public.exercise_sets (exercise_id);
create index if not exists idx_photos_workout        on public.progress_photos (workout_id);
create index if not exists idx_photos_user           on public.progress_photos (user_id);

drop trigger if exists trg_workouts_updated_at on public.workouts;
create trigger trg_workouts_updated_at before update on public.workouts
  for each row execute function public.set_updated_at();

-- ROW LEVEL SECURITY --------------------------------------------------
alter table public.workouts        enable row level security;
alter table public.exercises       enable row level security;
alter table public.exercise_sets   enable row level security;
alter table public.progress_photos enable row level security;

create policy "own workouts - select" on public.workouts for select using (auth.uid() = user_id);
create policy "own workouts - insert" on public.workouts for insert with check (auth.uid() = user_id);
create policy "own workouts - update" on public.workouts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workouts - delete" on public.workouts for delete using (auth.uid() = user_id);

create policy "own exercises - select" on public.exercises for select using (exists (select 1 from public.workouts w where w.id = exercises.workout_id and w.user_id = auth.uid()));
create policy "own exercises - insert" on public.exercises for insert with check (exists (select 1 from public.workouts w where w.id = exercises.workout_id and w.user_id = auth.uid()));
create policy "own exercises - update" on public.exercises for update using (exists (select 1 from public.workouts w where w.id = exercises.workout_id and w.user_id = auth.uid())) with check (exists (select 1 from public.workouts w where w.id = exercises.workout_id and w.user_id = auth.uid()));
create policy "own exercises - delete" on public.exercises for delete using (exists (select 1 from public.workouts w where w.id = exercises.workout_id and w.user_id = auth.uid()));

create policy "own sets - select" on public.exercise_sets for select using (exists (select 1 from public.exercises e join public.workouts w on w.id = e.workout_id where e.id = exercise_sets.exercise_id and w.user_id = auth.uid()));
create policy "own sets - insert" on public.exercise_sets for insert with check (exists (select 1 from public.exercises e join public.workouts w on w.id = e.workout_id where e.id = exercise_sets.exercise_id and w.user_id = auth.uid()));
create policy "own sets - update" on public.exercise_sets for update using (exists (select 1 from public.exercises e join public.workouts w on w.id = e.workout_id where e.id = exercise_sets.exercise_id and w.user_id = auth.uid())) with check (exists (select 1 from public.exercises e join public.workouts w on w.id = e.workout_id where e.id = exercise_sets.exercise_id and w.user_id = auth.uid()));
create policy "own sets - delete" on public.exercise_sets for delete using (exists (select 1 from public.exercises e join public.workouts w on w.id = e.workout_id where e.id = exercise_sets.exercise_id and w.user_id = auth.uid()));

create policy "own photos - select" on public.progress_photos for select using (auth.uid() = user_id);
create policy "own photos - insert" on public.progress_photos for insert with check (auth.uid() = user_id);
create policy "own photos - delete" on public.progress_photos for delete using (auth.uid() = user_id);

-- STORAGE BUCKET (progress photos) ------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create policy "photos - user read own"   on storage.objects for select using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos - user upload own" on storage.objects for insert with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos - user update own" on storage.objects for update using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos - user delete own" on storage.objects for delete using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- WORKOUT HERO IMAGES (fal.ai cache, shared by workout name) ----------
create table if not exists public.workout_hero_images (
  id            uuid primary key default gen_random_uuid(),
  workout_name  text not null,
  name_key      text not null,
  workout_type  text not null,
  prompt        text not null,
  image_url     text not null,
  created_at    timestamptz not null default now(),
  constraint workout_hero_images_name_key_unique unique (name_key)
);

create index if not exists idx_workout_hero_images_name_key
  on public.workout_hero_images (name_key);

alter table public.workout_hero_images enable row level security;

create policy "heroes - authenticated read"
  on public.workout_hero_images for select
  to authenticated
  using (true);

create policy "heroes - authenticated insert"
  on public.workout_hero_images for insert
  to authenticated
  with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workout-heroes',
  'workout-heroes',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "heroes bucket - public read"
  on storage.objects for select
  using (bucket_id = 'workout-heroes');

create policy "heroes bucket - auth upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'workout-heroes');

-- WORKOUT SCHEDULES (library workout → calendar day) ------------------
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

create policy "own schedules - select" on public.workout_schedules for select using (auth.uid() = user_id);
create policy "own schedules - insert" on public.workout_schedules for insert with check (auth.uid() = user_id);
create policy "own schedules - update" on public.workout_schedules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own schedules - delete" on public.workout_schedules for delete using (auth.uid() = user_id);
