-- =============================================================================
-- Commit Roulette — 003 state machine and scoring
--
-- Every function here is SECURITY DEFINER and re-checks the caller in plpgsql,
-- because RLS alone cannot express "host only, in the lobby, with 2+ players".
-- The authenticated role has no INSERT/UPDATE grant on rooms, rounds or
-- round_results, so these functions are the only write path.
--
-- The invariants they protect:
--   - ends_at is set once, by the database, and never moves.
--   - Scores are derived from stored submissions, never supplied by a client.
--   - settle_round is idempotent, so every client can call it and the first one
--     through wins while the rest converge on the same numbers.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Small helpers
-- -----------------------------------------------------------------------------

-- Clock-skew probe. The client measures its offset against this once per round
-- and renders ends_at minus (Date.now() + skew), so a device with a fast clock
-- cannot win a round by lying. See docs/PLAN.md §5.
create or replace function public.server_time()
returns timestamptz
language sql
stable
as $$ select now() $$;

-- Idempotent profile upsert, called on app load. The id is taken from
-- the verified JWT, never from the argument, so a client cannot write a profile for
-- someone else.
create or replace function public.ensure_profile(p_username text, p_display_name text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if public.current_player_id() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  insert into public.profiles (id, username, display_name)
  values (public.current_player_id(), lower(regexp_replace(coalesce(p_username, ''), '[^a-zA-Z0-9_]', '', 'g')),
          coalesce(nullif(p_display_name, ''), p_username))
  on conflict (id) do update
    set display_name = excluded.display_name
  returning * into v_profile;

  return v_profile;
end;
$$;

-- Six characters from the same unambiguous alphabet as
-- packages/shared/join-code.ts — no O/0, I/1, so a code can be read aloud.
create or replace function public.generate_join_code()
returns text
language plpgsql
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where join_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- The roulette.
--
-- Deterministic from (join_code, round_number) so every client independently
-- arrives at the same category and the same challenge, with no coordination and
-- no client-authoritative randomness to disagree about. FR4/FR5 in one function.
-- -----------------------------------------------------------------------------
create or replace function public.pick_challenge(p_join_code text, p_round int)
returns table (challenge_id text, category public.challenge_category)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_category public.challenge_category;
  v_challenges text[];
begin
  select c.id into v_category
  from public.categories c
  order by abs(hashtextextended(p_join_code || ':cat:' || p_round::text, 0)) % 1000000,
           c.sort_order
  limit 1;

  select coalesce(array_agg(x.id order by x.id), '{}') into v_challenges
  from public.challenges x
  where x.category = v_category;

  -- Every category has at least one challenge (PRD §5). If one somehow does not,
  -- fall back to the whole set rather than failing the round.
  if coalesce(array_length(v_challenges, 1), 0) = 0 then
    select coalesce(array_agg(y.id order by y.id), '{}') into v_challenges
    from public.challenges y;
  end if;

  return query
  select v_challenges[1 + abs(hashtextextended(p_join_code || ':' || p_round::text, 0))
                         % array_length(v_challenges, 1)],
         v_category;
end;
$$;

-- -----------------------------------------------------------------------------
-- Lobby
-- -----------------------------------------------------------------------------
create or replace function public.create_room(p_username text, p_display_name text)
returns table (room_id uuid, join_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   text := public.current_player_id();
  v_room  uuid;
  v_code  text;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  perform public.ensure_profile(p_username, p_display_name);

  v_code := public.generate_join_code();
  insert into public.rooms (join_code, host_id)
  values (v_code, v_uid)
  returning id into v_room;

  insert into public.room_players (room_id, player_id, is_host)
  values (v_room, v_uid, true);

  return query select v_room, v_code;
end;
$$;

create or replace function public.join_room(p_join_code text, p_username text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  text := public.current_player_id();
  v_room public.rooms;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  perform public.ensure_profile(p_username, p_display_name);

  select * into v_room
  from public.rooms
  where join_code = upper(regexp_replace(coalesce(p_join_code, ''), '[^A-Za-z0-9]', '', 'g'));

  if not found then
    raise exception 'no room with that code' using errcode = 'P0002';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'that game has already started' using errcode = 'P0001';
  end if;
  if (select count(*) from public.room_players where room_id = v_room.id) >= 6 then
    raise exception 'that room is full' using errcode = 'P0001';
  end if;

  insert into public.room_players (room_id, player_id)
  values (v_room.id, v_uid)
  on conflict (room_id, player_id) do nothing;

  return v_room.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Round lifecycle
-- -----------------------------------------------------------------------------
create or replace function public.start_game(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room     public.rooms;
  v_picked   record;
  v_round_id uuid;
begin
  if not public.is_room_host(p_room_id) then
    raise exception 'only the host can start the game' using errcode = '42501';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.status <> 'lobby' then
    raise exception 'game already started' using errcode = 'P0001';
  end if;
  if (select count(*) from public.room_players where room_id = p_room_id) < 2 then
    raise exception 'need at least two players' using errcode = 'P0001';
  end if;

  select * into v_picked from public.pick_challenge(v_room.join_code, 1);

  insert into public.rounds (room_id, round_number, challenge_id, category, ends_at)
  values (p_room_id, 1, v_picked.challenge_id, v_picked.category,
          now() + make_interval(secs => v_room.round_seconds))
  returning id into v_round_id;

  update public.rooms
     set status = 'active', current_round = 1
   where id = p_room_id;

  -- FR10: everyone's `coding…` the moment the round opens.
  update public.room_players set status = 'coding'
   where room_id = p_room_id and status = 'idle';

  return v_round_id;
end;
$$;

create or replace function public.next_round(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room     public.rooms;
  v_prev     public.rounds;
  v_next     int;
  v_picked   record;
  v_round_id uuid;
begin
  if not public.is_room_host(p_room_id) then
    raise exception 'only the host can start the next round' using errcode = '42501';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.status <> 'active' then
    raise exception 'no game in progress' using errcode = 'P0001';
  end if;

  select * into v_prev from public.rounds
   where room_id = p_room_id and settled_at is null;

  if found then
    raise exception 'the current round is still running' using errcode = 'P0001';
  end if;

  v_next := v_room.current_round + 1;
  if v_next > v_room.total_rounds then
    raise exception 'that was the last round' using errcode = 'P0001';
  end if;

  select * into v_picked from public.pick_challenge(v_room.join_code, v_next);

  insert into public.rounds (room_id, round_number, challenge_id, category, ends_at)
  values (p_room_id, v_next, v_picked.challenge_id, v_picked.category,
          now() + make_interval(secs => v_room.round_seconds))
  returning id into v_round_id;

  update public.rooms set current_round = v_next where id = p_room_id;

  update public.room_players set status = 'coding'
   where room_id = p_room_id and status = 'idle';

  return v_round_id;
end;
$$;

create or replace function public.end_game(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_host(p_room_id) then
    raise exception 'only the host can end the game' using errcode = '42501';
  end if;
  update public.rounds set settled_at = coalesce(settled_at, now())
   where room_id = p_room_id and settled_at is null;
  update public.rooms set status = 'finished' where id = p_room_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- settle_round — the only place scores are written.
--
-- Callable by ANY member, but only once the round is genuinely over: either the
-- clock has run out, or every player has committed and been graded. That is
-- what makes it safe for all six clients to call it — the first one through
-- wins, everyone else sees the idempotent no-op. No server cron required.
--
-- Scoring is PRD FR8, mirroring packages/shared/scoring.ts:
--   Correctness 50 · Tests 30 · Performance 10 · Time 10
-- Correctness is binary, so a broken submission can never outscore a correct
-- one: max broken = 50, min correct = 60.
-- -----------------------------------------------------------------------------
create or replace function public.settle_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round      public.rounds;
  v_room       public.rooms;
  v_pending    int;
begin
  select * into v_round from public.rounds where id = p_round_id;
  if not found then
    raise exception 'no such round' using errcode = 'P0002';
  end if;

  if not public.is_room_member(v_round.room_id) then
    raise exception 'not a member of this room' using errcode = '42501';
  end if;

  -- Already settled: every client calls this, and that is fine.
  if v_round.settled_at is not null then
    return;
  end if;

  -- Still time on the clock, and someone has not finished. Hold the board open
  -- rather than cutting them off — but do not let a room hang on stage.
  v_pending := (
    select count(*) from public.room_players
     where room_id = v_round.room_id
       and status not in ('scored', 'timeout')
  );

  if now() < v_round.ends_at and v_pending > 0 then
    raise exception 'round is still running' using errcode = 'P0001';
  end if;

  select * into v_room from public.rooms where id = v_round.room_id;

  -- Anyone who never made it is a timeout, and scores zero on all four parts.
  update public.room_players
     set status = 'timeout'
   where room_id = v_round.room_id and status in ('idle', 'coding', 'committed');

  insert into public.round_results (
    round_id, player_id, correctness, tests, performance, speed, score, elapsed_ms
  )
  select
    v_round.id,
    rp.player_id,
    -- Correctness: every hidden test passed.
    case when coalesce(s.hidden_total, 0) > 0
          and s.hidden_passed = s.hidden_total then 50 else 0 end,
    -- Tests passed: partial credit on the public suite the player could see.
    case when coalesce(s.public_total, 0) > 0
         then round(30.0 * s.public_passed / s.public_total, 2) else 0 end,
    -- Performance: full marks under budget, decaying linearly to zero at 3x.
    case
      when s.id is null or g.budget_ms is null or g.budget_ms <= 0 then 0
      when s.runtime_ms <= g.budget_ms then 10
      else greatest(0, round(10.0 * (1 - (s.runtime_ms - g.budget_ms)::numeric
                                       / (g.budget_ms * 2)), 2))
    end,
    -- Time: how much of the round was left on the clock.
    case when s.id is null then 0
         else round(10.0 * least(greatest(
              extract(epoch from (v_round.ends_at - s.submitted_at)) / v_room.round_seconds,
              0), 1), 2)
    end,
    0,
    coalesce(s.elapsed_ms, v_room.round_seconds * 1000)
  from public.room_players rp
  left join public.submissions s
    on s.round_id = v_round.id and s.player_id = rp.player_id
  left join public.challenge_grading g
    on g.challenge_id = v_round.challenge_id
  where rp.room_id = v_round.room_id
  on conflict (round_id, player_id) do nothing;

  -- Total, now that the four components exist.
  update public.round_results
     set score = correctness + tests + performance + speed
   where round_id = v_round.id;

  update public.rounds set settled_at = now() where id = v_round.id;

  -- The game is over once the last round is graded.
  if v_room.current_round >= v_room.total_rounds then
    update public.rooms set status = 'finished' where id = v_room.id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cumulative standings for the final leaderboard (FR13).
-- -----------------------------------------------------------------------------
create or replace function public.final_standings(p_room_id uuid)
returns table (
  player_id     text,
  display_name  text,
  avatar_url    text,
  total_score   numeric,
  rounds_played int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    p.avatar_url,
    coalesce(sum(rr.score), 0),
    count(rr.round_id)
  from public.profiles p
  join public.room_players rp
    on rp.player_id = p.id and rp.room_id = p_room_id
  left join public.round_results rr
    on rr.player_id = p.id
   and rr.round_id in (select id from public.rounds where room_id = p_room_id)
  group by p.id, p.display_name, p.avatar_url
  order by 4 desc, 3 nulls last, 1
$$;
