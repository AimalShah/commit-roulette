import { getSupabase } from '@/lib/supabase'

/**
 * The room lifecycle, as the database sees it.
 *
 * Every transition is an RPC rather than a table write. That is not ceremony:
 * the database is the only thing that can be trusted about who is in a round,
 * when it started, and whether it has already been scored, because six clients
 * are racing and none of them can be trusted about time or order.
 *
 * Names and types here must match supabase/migrations/202609260003_functions.sql.
 * `pnpm db:check` is what keeps the two honest.
 */

export type RoomStatus = 'lobby' | 'spinning' | 'active' | 'finished'
export type PlayerStatus = 'idle' | 'coding' | 'committed' | 'scored' | 'timeout'

export type Room = {
  id: string
  join_code: string
  host_id: string
  status: RoomStatus
  total_rounds: number
  round_seconds: number
  current_round: number
}

export type Round = {
  id: string
  room_id: string
  round_number: number
  challenge_id: string
  category: string
  started_at: string
  ends_at: string
  settled_at: string | null
}

export type SeatedPlayer = {
  player_id: string
  display_name: string
  handle: string | null
  avatar_url: string | null
  is_host: boolean
  status: PlayerStatus
  total_score: number
}

/**
 * Postgres raises with a message we chose, so the code is the thing to branch
 * on and the message is only for humans. Mapping to messages here keeps
 * Postgres's wording out of the UI.
 */
export class RoomError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'RoomError'
    this.code = code
  }
}

function fail(error: { message: string; code?: string } | null): never {
  const raw = error?.message ?? 'Something went wrong.'
  const byCode: Record<string, string> = {
    P0002: 'No room has that code.',
    P0001: 'That game has already started.',
    '42501': 'You are not allowed to do that.',
  }
  throw new RoomError(
    Object.entries(byCode).find(([code]) => raw.includes(code))?.[1] ??
      (raw.includes('only the host')
        ? 'Only the host can start the game.'
        : raw.includes('two players')
          ? 'You need at least two players to start.'
          : raw.includes('full')
            ? 'That room is full.'
            : raw),
    error?.code ?? 'unknown',
  )
}

export async function createRoom(username: string, displayName: string) {
  const { data, error } = await getSupabase().rpc('create_room', {
    p_username: username,
    p_display_name: displayName,
  })
  if (error) fail(error)
  const row = (data as { room_id: string; join_code: string }[])?.[0]
  if (!row) throw new RoomError('The room was not created.', 'no_row')
  return row
}

export async function joinRoom(joinCode: string, username: string, displayName: string) {
  const { data, error } = await getSupabase().rpc('join_room', {
    p_join_code: joinCode,
    p_username: username,
    p_display_name: displayName,
  })
  if (error) fail(error)
  return data as string
}

export async function startGame(roomId: string) {
  const { data, error } = await getSupabase().rpc('start_game', { p_room_id: roomId })
  if (error) fail(error)
  return data as string
}

export async function nextRound(roomId: string) {
  const { data, error } = await getSupabase().rpc('next_round', { p_room_id: roomId })
  if (error) fail(error)
  return data as string
}

/** Idempotent by design: all six clients call it, the first one wins. */
export async function settleRound(roundId: string) {
  const { error } = await getSupabase().rpc('settle_round', { p_round_id: roundId })
  if (error) fail(error)
}

export async function endGame(roomId: string) {
  const { error } = await getSupabase().rpc('end_game', { p_room_id: roomId })
  if (error) fail(error)
}

export async function getRoom(joinCode: string) {
  const { data, error } = await getSupabase()
    .from('rooms')
    .select('*')
    .eq('join_code', joinCode)
    .maybeSingle()
  if (error) fail(error)
  return data as Room | null
}

export async function getRound(roomId: string, roundNumber: number) {
  const { data, error } = await getSupabase()
    .from('rounds')
    .select('*')
    .eq('room_id', roomId)
    .eq('round_number', roundNumber)
    .maybeSingle()
  if (error) fail(error)
  return data as Round | null
}

export async function getPlayers(roomId: string) {
  const { data, error } = await getSupabase()
    .from('room_players')
    .select('player_id, is_host, status, joined_at')
    .eq('room_id', roomId)
  if (error) fail(error)
  return data as Pick<SeatedPlayer, 'player_id' | 'is_host' | 'status'>[] ?? []
}

/**
 * The database's clock, not the browser's. A player who edits their device
 * time must not be able to win a round, so every deadline is compared against
 * the server offset this returns.
 */
export async function serverTimeOffset() {
  const before = Date.now()
  const { data, error } = await getSupabase().rpc('server_time')
  if (error) fail(error)
  const serverMs = new Date(data as string).getTime()
  return serverMs - (before + (Date.now() - before) / 2)
}
