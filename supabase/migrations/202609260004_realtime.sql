-- =============================================================================
-- Commit Roulette — 004 realtime
--
-- PRD §13 asks for "one Supabase Realtime channel per room". The literal
-- mechanism is Postgres Changes: a single multiplexed socket with server-side
-- filters. The intent behind that line is "as few moving parts as possible", so
-- the plan honours the intent — three filtered subscriptions and one fetch at
-- settle time. See docs/PLAN.md §8.
--
-- The client subscribes to:
--   room_players  room_id=eq.<id>   live roster, coding… → committed → scored
--   rounds        room_id=eq.<id>   spin landed, challenge payload, ends_at
--   submissions   round_id=eq.<id>  how many rivals have locked in
-- and reads round_results once when the round settles.
-- =============================================================================

alter publication supabase_realtime add table public.room_players;
alter publication supabase_realtime add table public.rounds;
alter publication supabase_realtime add table public.submissions;

-- Deliberately NOT added:
--   challenge_grading  the hidden suite must never reach a client socket
--   profiles           roster changes arrive via room_players
--   round_results      immutable once written; one fetch beats a subscription
--   rooms              status changes are already implied by rounds
