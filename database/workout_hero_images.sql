-- =====================================================================
-- Workout hero images (fal.ai cache)
-- Run in the Supabase SQL editor if not already applied.
-- =====================================================================

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

drop policy if exists "heroes - authenticated read" on public.workout_hero_images;
create policy "heroes - authenticated read"
  on public.workout_hero_images for select
  to authenticated
  using (true);

drop policy if exists "heroes - authenticated insert" on public.workout_hero_images;
create policy "heroes - authenticated insert"
  on public.workout_hero_images for insert
  to authenticated
  with check (true);

-- Public bucket so card images work without signed URLs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workout-heroes',
  'workout-heroes',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "heroes bucket - public read" on storage.objects;
create policy "heroes bucket - public read"
  on storage.objects for select
  using (bucket_id = 'workout-heroes');

drop policy if exists "heroes bucket - auth upload" on storage.objects;
create policy "heroes bucket - auth upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'workout-heroes');
