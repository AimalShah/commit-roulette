-- Commit Roulette — initial schema.
--
-- Auth is Clerk. Supabase has Clerk registered as a third-party auth provider,
-- so every request carries a Clerk session token and `auth.jwt()->>'sub'` is
-- the Clerk user id. There is no auth.users row per player: ownership columns
-- are plain `text` holding that subject claim, and they default to it so a
-- client never has to send its own id.

-- ---------------------------------------------------------------- profiles --

create table if not exists public.profiles (
  user_id      text primary key default (auth.jwt() ->> 'sub'),
  handle       text not null unique,
  display_name text not null,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

-- ------------------------------------------------------------------- rooms --

create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  join_code  text not null unique,
  host_id    text not null default (auth.jwt() ->> 'sub'),
  status     text not null default 'lobby',
  created_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

-- ------------------------------------------------------------ room_players --

create table if not exists public.room_players (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid not null references public.rooms (id) on delete cascade,
  user_id   text not null default (auth.jwt() ->> 'sub'),
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

alter table public.room_players enable row level security;

create policy "Room members can view their rooms"
  on public.rooms
  for select
  to authenticated
  using (
    (select auth.jwt() ->> 'sub') = host_id
    or exists (
      select 1
      from public.room_players rp
      where rp.room_id = rooms.id
        and rp.user_id = (select auth.jwt() ->> 'sub')
    )
  );

create policy "Users can host their own rooms"
  on public.rooms
  for insert
  to authenticated
  with check ((select auth.jwt() ->> 'sub') = host_id);

create policy "Hosts can update their own rooms"
  on public.rooms
  for update
  to authenticated
  using ((select auth.jwt() ->> 'sub') = host_id)
  with check ((select auth.jwt() ->> 'sub') = host_id);

create policy "Room members can view the roster"
  on public.room_players
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.room_players mine
      where mine.room_id = room_players.room_id
        and mine.user_id = (select auth.jwt() ->> 'sub')
    )
    or exists (
      select 1
      from public.rooms r
      where r.id = room_players.room_id
        and r.host_id = (select auth.jwt() ->> 'sub')
    )
  );

create policy "Users can seat only themselves"
  on public.room_players
  for insert
  to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);

create index if not exists room_players_room_id_idx on public.room_players (room_id);
create index if not exists room_players_user_id_idx on public.room_players (user_id);
