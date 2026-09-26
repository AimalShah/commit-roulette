/**
 * execute-submission — the only place player code leaves the app, and it does
 * not run it.
 *
 *   validate → forward to Judge0 → record the result
 *
 * Three independent rejections sit in front of the single outbound call, so a
 * bored lobby cannot run up the free grader's quota. See docs/PLAN.md §6.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { buildScript, type Language } from './_shared/build-script.ts'
import { createJudge0Adapter } from './_shared/judge0.ts'
import { grade, parseReport, redactForPlayer } from './_shared/grading.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const TIMEOUT_MS = 8000
const CPU_SECONDS = 3
const MEMORY_KB = 128_000
const MAX_CODE_BYTES = 64 * 1024

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })

const fail = (status: number, error: string) => json({ error }, status)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return fail(405, 'method not allowed')

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return fail(401, 'missing authorization header')

  // Passing the Clerk JWT through as the Supabase access token is what makes
  // auth.uid() resolve inside the function. No auth code of our own.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  )
  const service = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return fail(401, 'not signed in')
  // getUser() is the verification: it asks Supabase whether this JWT is a real,
  // unexpired Clerk session. The id is then read straight off the token's `sub`
  // rather than off the auth response, because a Clerk id is text (`user_2abc`)
  // while profiles.id is the same text and the auth layer is free to reshape it.
  // This is the same value public.current_player_id() resolves in SQL.
  const playerId = readSub(authHeader) ?? userData.user.id

  let payload: { round_id?: string; code?: string }
  try {
    payload = await req.json()
  } catch {
    return fail(400, 'body must be json')
  }

  const roundId = payload.round_id
  const code = payload.code
  if (!roundId || typeof code !== 'string') return fail(400, 'round_id and code are required')
  if (new TextEncoder().encode(code).length > MAX_CODE_BYTES) {
    return fail(413, 'submission is too large')
  }

  // --- Guard 1: is this a real, running round that you are in? ---------------
  const { data: round } = await service
    .from('rounds')
    .select('id, room_id, challenge_id, ends_at, settled_at')
    .eq('id', roundId)
    .maybeSingle()

  if (!round) return fail(404, 'no such round')
  if (round.settled_at) return fail(409, 'that round is already over')

  const { data: membership } = await service
    .from('room_players')
    .select('player_id')
    .eq('room_id', round.room_id)
    .eq('player_id', playerId)
    .maybeSingle()

  if (!membership) return fail(403, 'you are not in this room')

  // --- Guard 2: the clock. ends_at is the database's, so this cannot be lied to.
  if (new Date(round.ends_at).getTime() <= Date.now()) {
    await service
      .from('room_players')
      .update({ status: 'timeout' })
      .eq('room_id', round.room_id)
      .eq('player_id', playerId)
    return fail(409, "time's up")
  }

  // --- Guard 3: one lock-in per round. Also the quota control. --------------
  const { data: existing } = await service
    .from('submissions')
    .select('id')
    .eq('round_id', roundId)
    .eq('player_id', playerId)
    .maybeSingle()

  if (existing) return fail(409, 'you have already locked in')

  const { data: challenge } = await service
    .from('challenges')
    .select('id, language')
    .eq('id', round.challenge_id)
    .single()

  // The hidden suite. No client role can read this table at all.
  const { data: grading } = await service
    .from('challenge_grading')
    .select('test_code')
    .eq('challenge_id', round.challenge_id)
    .single()

  if (!challenge || !grading) return fail(500, 'challenge is not gradeable')

  const language = challenge.language as Language
  const script = buildScript(language, code, grading.test_code)

  // Mark the lock-in immediately so the room sees `committed` while the grader
  // is working, rather than after it.
  await service
    .from('room_players')
    .update({ status: 'committed' })
    .eq('room_id', round.room_id)
    .eq('player_id', playerId)

  const adapter = createJudge0Adapter()
  const outcome = await adapter.run({
    language,
    script,
    timeoutMs: TIMEOUT_MS,
    cpuSeconds: CPU_SECONDS,
    memoryKb: MEMORY_KB,
  })

  const report = parseReport(outcome.stdout)
  const counts = grade(report, outcome.status)

  const elapsedMs = Math.max(
    0,
    new Date(round.ends_at).getTime() - Date.now(),
  )

  const { data: inserted, error: insertError } = await service
    .from('submissions')
    .insert({
      round_id: roundId,
      player_id: playerId,
      code,
      language,
      elapsed_ms: TIMEOUT_MS - elapsedMs,
      public_passed: counts.publicPassed,
      public_total: counts.publicTotal,
      hidden_passed: counts.hiddenPassed,
      hidden_total: counts.hiddenTotal,
      runtime_ms: counts.runtimeMs,
      runtime_wall_ms: outcome.wallMs,
      memory_kb: outcome.memoryKb,
      status: counts.executionStatus,
      stdout_tail: outcome.stdout.slice(-2000),
      stderr_tail: outcome.stderr.slice(-2000),
    })
    .select('id')
    .single()

  if (insertError) {
    return fail(500, 'could not record the submission')
  }

  await service
    .from('room_players')
    .update({ status: 'scored' })
    .eq('room_id', round.room_id)
    .eq('player_id', playerId)

  return json({
    submission_id: inserted.id,
    status: counts.executionStatus,
    runtime_ms: counts.runtimeMs,
    // The player's own results, with hidden test names redacted. They would
    // learn the same at settle time; showing them now makes the wait bearable.
    tests: report ? redactForPlayer(report.results) : [],
    public_passed: counts.publicPassed,
    public_total: counts.publicTotal,
  })
})

/**
 * The `sub` claim of a verified JWT. Reading the payload here is safe because
 * the token has already been verified against Supabase by getUser() above —
 * this is decoding, not trusting.
 */
function readSub(authHeader: string): string | null {
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(padded)) as { sub?: unknown }
    return typeof json.sub === 'string' && json.sub.length > 0 ? json.sub : null
  } catch {
    return null
  }
}
