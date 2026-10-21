-- One row per scored round of an exercise.
create table public.attempts (
  id bigint generated always as identity primary key,
  -- Filled in from the logged-in user, so the app never has to send it
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise text not null check (exercise in ('match')),
  target_midi smallint not null check (target_midi between 0 and 127),
  voice text not null check (voice in ('lower', 'higher')),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  in_tune_cents smallint not null check (in_tune_cents > 0),
  accuracy smallint not null check (accuracy between 0 and 100),
  avg_cents smallint not null check (avg_cents between -600 and 600),
  sample_count integer not null check (sample_count >= 0),
  created_at timestamptz not null default now()
);

-- "My attempts, newest first" is the main query
create index attempts_user_id_created_at_idx on public.attempts (user_id, created_at desc);

-- Row Level Security: with it on, nobody can touch a row unless a policy allows it.
alter table public.attempts enable row level security;

create policy "Users can read their own attempts"
  on public.attempts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can save their own attempts"
  on public.attempts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- No update or delete policies: saved attempts can't be changed or removed from the app.
