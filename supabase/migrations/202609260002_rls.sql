-- =============================================================================
-- Commit Roulette — 002 row level security
--
-- Client roles are `anon` and `authenticated`. With Clerk configured as
-- Supabase's third-party auth provider, `auth.uid()` returns the Clerk user id,
-- so every policy below is written against Clerk's identity with no auth code
-- of our own. See docs/PLAN.md §3.
--
-- RLS cannot express "only the host, only in the lobby, only with 2+ players".
-- Every write that advances game state goes through a SECURITY DEFINER RPC in
-- 003 that re-checks the caller in plpgsql. RLS is the outer fence, not the
-- only one.
-- =============================================================================

alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.rooms             enable row level security;
alter table public.room_players      enable row level security;
alter table public.challenges        enable row level security;
alter table public.challenge_grading enable row level security;
alter table public.rounds            enable row level security;
alter table public.submissions       enable row level security;
alter table public.round_results     enable row level security;

-- -----------------------------------------------------------------------------
-- Identity
--
-- NOT auth.uid(). Supabase types auth.uid() as uuid, but a Clerk user id is
-- text — `user_2abcXyz` — so it cannot be cast, and every policy would fail at
-- runtime with "operator does not exist: text = uuid". Reading the `sub` claim
-- as text is the whole integration, and it means profiles.id is literally the
-- Clerk id with no mapping table. See docs/PLAN.md §3.
-- -----------------------------------------------------------------------------
create or replace function public.current_player_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- Anyone signed in can see who is in the room; you can only edit yourself.
-- -----------------------------------------------------------------------------
create policy "profiles are readable when signed in"
  on public.profiles for select to authenticated using (true);

create policy "you can update your own profile"
  on public.profiles for update to authenticated
  using (id = public.current_player_id()) with check (id = public.current_player_id());

-- No INSERT policy. Profiles are created by ensure_profile(), which checks that
-- the caller is inserting their own Clerk id — a client cannot mint a profile
-- for someone else.

-- -----------------------------------------------------------------------------
-- categories / challenges — public reference data, readable by anyone.
-- -----------------------------------------------------------------------------
create policy "categories are public"
  on public.categories for select to anon, authenticated using (true);

create policy "challenges are public"
  on public.challenges for select to anon, authenticated using (true);

-- challenge_grading: deliberately NO policy. Default-deny for anon and
-- authenticated; the service role bypasses RLS, which is how the Edge Function
-- reaches the hidden suite. Do not add a policy here.

-- -----------------------------------------------------------------------------
-- Membership test, reused by every room-scoped policy below.
-- -----------------------------------------------------------------------------
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_players
    where room_id = p_room_id and player_id = public.current_player_id()
  );
$$;

create or replace function public.is_room_host(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_players
    where room_id = p_room_id and player_id = public.current_player_id() and is_host
  );
$$;

-- -----------------------------------------------------------------------------
-- rooms
-- -----------------------------------------------------------------------------
create policy "rooms are readable by signed-in users"
  on public.rooms for select to authenticated using (true);

-- Joining by code needs to resolve a code to a room before membership exists,
-- so the join lookup is deliberately open. It exposes nothing a join code does
-- not already reveal, and the codes are six unambiguous characters.
create policy "anyone can look up a room by code"
  on public.rooms for select to anon using (true);

-- Creation goes through create_room(); host_id is stamped from the verified JWT.
create policy "hosts can update their own room"
  on public.rooms for update to authenticated
  using (id in (select room_id from public.room_players
                 where player_id = public.current_player_id() and is_host))
  with check (id in (select room_id from public.room_players
                      where player_id = public.current_player_id() and is_host));

-- -----------------------------------------------------------------------------
-- room_players
-- -----------------------------------------------------------------------------
create policy "room members can see the roster"
  on public.room_players for select to authenticated
  using (public.is_room_member(room_id));

-- Joining goes through join_room(), which enforces status='lobby' and the
-- six-player cap. A direct insert would bypass both.
create policy "you can update your own player row"
  on public.room_players for update to authenticated
  using (player_id = public.current_player_id()) with check (player_id = public.current_player_id());

-- -----------------------------------------------------------------------------
-- rounds
-- -----------------------------------------------------------------------------
create policy "room members can see rounds"
  on public.rounds for select to authenticated
  using (public.is_room_member(room_id));

-- Writes are RPC-only (start_game, next_round, settle_round).

-- -----------------------------------------------------------------------------
-- submissions — a player sees only their own. Rivals' submissions are visible
-- only as the aggregate the room_players.status enum already carries (FR10).
-- -----------------------------------------------------------------------------
create policy "you can read your own submission"
  on public.submissions for select to authenticated
  using (player_id = public.current_player_id());

create policy "room members can see who has submitted"
  on public.submissions for select to authenticated
  using (public.is_room_member((select room_id from public.rounds where id = round_id)));

-- No INSERT policy. Submissions are written by the Edge Function with the
-- service role after it has verified the JWT, the round, and the clock. A client
-- that could insert here could claim it passed the hidden suite.

-- -----------------------------------------------------------------------------
-- round_results — readable by the room, written only by settle_round().
-- -----------------------------------------------------------------------------
create policy "room members can see results"
  on public.round_results for select to authenticated
  using (public.is_room_member((select room_id from public.rounds where id = round_id)));
