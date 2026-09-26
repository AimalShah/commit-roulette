-- =============================================================================
-- Commit Roulette — 001 schema
--
-- Deviates from PRD §9 in four documented places; see docs/PLAN.md §4.
--   1. `users` → `profiles`  (users is reserved in Postgres; id IS the Clerk id)
--   2. `challenges` split — public columns only; the hidden suite lives in
--      `challenge_grading`, which no client role can read.
--   3. `round_results` added — scores are computed in SQL, never client-written.
--   4. `rounds.category` added — the roulette wedge is chosen by the database so
--      every client animates to the same one without coordinating.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type room_status     as enum ('lobby', 'active', 'finished');
create type player_status   as enum ('idle', 'coding', 'committed', 'scored', 'timeout');
create type challenge_category as enum (
  'bug-fix', 'performance', 'security', 'testing', 'refactoring', 'database', 'api'
);
create type challenge_difficulty as enum ('warmup', 'standard', 'hard');
create type challenge_language as enum ('javascript', 'python');

-- What Judge0 did with the submission. Anything other than 'accepted' means the
-- tests did not run to completion; see _shared/grading.ts.
create type execution_status as enum (
  'accepted',        -- ran, emitted a report
  'compile_error',   -- the script would not parse
  'runtime_error',   -- threw, or printed no report
  'timeout',         -- hit the wall clock
  'grader_unavailable'
);

-- -----------------------------------------------------------------------------
-- profiles — one row per human. `id` is Clerk's user id (user_xxx).
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           text primary key,
  username     text        not null,
  display_name text        not null,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

comment on table public.profiles is
  'id is the Clerk user id, so the verified JWT subject joins directly with no mapping table.';

-- -----------------------------------------------------------------------------
-- categories — drives the roulette pick, so the wedge order lives in data
-- rather than in a hardcoded array. Seeded from packages/shared/categories.ts.
-- -----------------------------------------------------------------------------
create table public.categories (
  id         challenge_category primary key,
  label      text not null,
  short      text not null,
  blurb      text not null,
  accent     text not null,
  sort_order int  not null
);

-- -----------------------------------------------------------------------------
-- rooms
-- -----------------------------------------------------------------------------
create table public.rooms (
  id            uuid primary key default gen_random_uuid(),
  join_code     text        not null unique,
  host_id       text        not null references public.profiles(id) on delete cascade,
  status        room_status not null default 'lobby',
  total_rounds  int         not null default 5,
  round_seconds int         not null default 180,
  current_round int         not null default 0,
  created_at    timestamptz not null default now(),
  constraint rooms_round_seconds_sane check (round_seconds between 30 and 900),
  constraint rooms_total_rounds_sane  check (total_rounds between 1 and 20)
);

comment on column public.rooms.join_code is
  'Six characters from the unambiguous alphabet in packages/shared/join-code.ts.';

-- -----------------------------------------------------------------------------
-- room_players
-- -----------------------------------------------------------------------------
create table public.room_players (
  room_id    uuid          not null references public.rooms(id) on delete cascade,
  player_id  text          not null references public.profiles(id) on delete cascade,
  is_host    boolean       not null default false,
  status     player_status not null default 'idle',
  joined_at  timestamptz  not null default now(),
  primary key (room_id, player_id)
);

create index room_players_room_idx on public.room_players(room_id);

-- -----------------------------------------------------------------------------
-- challenges — public. Everything here is safe to ship to the client.
-- -----------------------------------------------------------------------------
create table public.challenges (
  id           text primary key,
  title        text not null,
  category     challenge_category   not null,
  difficulty   challenge_difficulty not null,
  language     challenge_language   not null,
  tagline      text not null,
  description  text not null,
  acceptance   text[] not null default '{}',
  starter_code text not null,
  -- The public suite, shown read-only in the challenge panel. Same dialect as
  -- the grading suite so the player sees exactly what will be run.
  test_code    text not null,
  -- Per-test labels for the visible suite, rendered in the results table.
  public_tests jsonb not null default '[]'::jsonb,
  par_minutes  int  not null default 5,
  tags         text[] not null default '{}'
);

create index challenges_category_idx on public.challenges(category);

-- -----------------------------------------------------------------------------
-- challenge_grading — hidden. No RLS policy is created for client roles in
-- 002, so this table is default-deny; only the service role (the Edge Function)
-- can read it. A hidden column would have been tidier but breaks `select=*`
-- through PostgREST, which is exactly what the client types.
-- -----------------------------------------------------------------------------
create table public.challenge_grading (
  challenge_id text primary key references public.challenges(id) on delete cascade,
  -- Public suite + hidden tests. Hidden tests are marked in the test code
  -- itself (JS: `test(name, fn, { hidden: true })`, Python: `@hidden_test`),
  -- never inferred from position.
  test_code    text not null,
  budget_ms    int  not null default 200
);

comment on table public.challenge_grading is
  'Hidden test suite and performance budget. Service role only — see docs/PLAN.md §4.';

-- -----------------------------------------------------------------------------
-- rounds
-- -----------------------------------------------------------------------------
create table public.rounds (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  round_number int  not null,
  challenge_id text not null references public.challenges(id),
  category     challenge_category not null,
  started_at   timestamptz not null default now(),
  -- Set once, by the database. Every client renders ends_at minus its own
  -- corrected clock, so nobody can win by lying about their device time.
  ends_at      timestamptz not null,
  settled_at   timestamptz,
  unique (room_id, round_number)
);

create index rounds_room_idx on public.rounds(room_id, round_number desc);

-- -----------------------------------------------------------------------------
-- submissions — written only by the execute-submission Edge Function.
-- -----------------------------------------------------------------------------
create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  round_id      uuid not null references public.rounds(id) on delete cascade,
  player_id     text not null references public.profiles(id) on delete cascade,
  code          text not null,
  language      challenge_language not null,
  elapsed_ms    int  not null,
  public_passed int  not null default 0,
  public_total  int  not null default 0,
  hidden_passed int  not null default 0,
  hidden_total  int  not null default 0,
  -- Measured in-process by the test harness. Judge0's own `time` is container
  -- overhead (~1.2s for a trivial script) and never feeds a score.
  runtime_ms    int  not null default 0,
  runtime_wall_ms numeric(10, 3) not null default 0,
  memory_kb     int  not null default 0,
  status        execution_status not null default 'accepted',
  stdout_tail   text,
  stderr_tail   text,
  submitted_at  timestamptz not null default now(),
  -- One lock-in per round, matching "lock in and it freezes". This is also the
  -- control that keeps a 6-player x 5-round game at 30 grader calls.
  unique (round_id, player_id)
);

create index submissions_round_idx on public.submissions(round_id);

-- -----------------------------------------------------------------------------
-- round_results — computed by settle_round(). Clients cannot write here.
-- -----------------------------------------------------------------------------
create table public.round_results (
  round_id    uuid not null references public.rounds(id) on delete cascade,
  player_id   text not null references public.profiles(id) on delete cascade,
  correctness numeric(5, 2) not null default 0,
  tests       numeric(5, 2) not null default 0,
  performance numeric(5, 2) not null default 0,
  speed       numeric(5, 2) not null default 0,
  score       numeric(5, 2) not null default 0,
  elapsed_ms  int  not null default 0,
  primary key (round_id, player_id)
);

create index round_results_round_idx on public.round_results(round_id);

-- -----------------------------------------------------------------------------
-- CASCADE: a member leaving removes their scores. A host leaving ends the game.
-- -----------------------------------------------------------------------------
create or replace function public.handle_player_left()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Settle anything still open so the room never waits on a departed player.
  update public.rounds
     set settled_at = now()
   where room_id = old.room_id
     and settled_at is null;

  if exists (select 1 from public.room_players
              where room_id = old.room_id and player_id = old.player_id and is_host) then
    update public.rooms set status = 'finished' where id = old.room_id;
  end if;

  return old;
end;
$$;

create trigger on_player_left
  after delete on public.room_players
  for each row execute function public.handle_player_left();
