/**
 * Applies the migrations and seed to a scratch database, then exercises the
 * room lifecycle and the scoring maths end to end.
 *
 *   pnpm db:check
 *
 * This exists because "the SQL looks right" is not "the SQL is right". The
 * state machine in 003_functions.sql is the part most likely to be subtly
 * wrong, and it is also the part with no test coverage anywhere else.
 *
 * It drops and recreates its own database, so point it somewhere disposable.
 * Needs a running Postgres; the Supabase bits it depends on (auth.jwt(),
 * anon/authenticated/service_role, the realtime publication) are stubbed by
 * supabase/scripts/local-shim.sql.
 */

import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const DB = process.env.CR_CHECK_DB ?? 'cr_check'
const PSQL = process.env.CR_PSQL ?? '/usr/lib/postgresql/16/bin/psql'

const baseEnv = {
  ...process.env,
  PGHOST: process.env.PGHOST ?? '/tmp/opencode',
  PGPORT: process.env.PGPORT ?? '54329',
  PGUSER: process.env.PGUSER ?? 'postgres',
  PGDATABASE: DB,
}

let failures = 0
let checks = 0

type Who = { as: 'player'; id: string } | { as: 'role'; role: 'anon' | 'authenticated' | 'service_role' }

function psql(args: string[]) {
  return execFileSync(PSQL, args, { env: baseEnv, encoding: 'utf8', stdio: 'pipe' })
}

/**
 * Everything runs in ONE psql invocation on ONE connection, because
 * `set_config` and `set role` are session state and each psql call would
 * otherwise start a fresh session and throw the identity away.
 *
 * `set role` is the important part: connecting as `postgres` proves nothing
 * about RLS, because a superuser bypasses every policy. The policies only mean
 * anything when checked as the role the browser actually runs as.
 */
function q(statement: string, who?: Who): string {
  const setup: string[] = []
  if (who?.as === 'player') {
    const claims = JSON.stringify({ sub: who.id, role: 'authenticated' })
    setup.push(`do $$begin perform set_config('request.jwt.claims', '${claims}', false); end$$`)
    setup.push('set role authenticated')
  } else if (who) {
    setup.push(`set role ${who.role}`)
  }

  const out = psql(['-t', '-A', '-c', [...setup, statement].join(';\n')])
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l !== 'SET' && l !== 'RESET' && l !== 'DO')
    .join('\n')
}

const as = (id: string) => ({ as: 'player', id }) as const
const role = (r: 'anon' | 'authenticated' | 'service_role') => ({ as: 'role', role: r }) as const

function apply(file: string, label: string) {
  checks++
  try {
    psql(['-q', '-v', 'ON_ERROR_STOP=1', '-f', resolve(ROOT, file)])
    console.log(`  ok   ${label}`)
  } catch (err) {
    const out = (err as { stderr?: string }).stderr ?? ''
    failures++
    console.log(`  FAIL ${label}\n${out.split('\n').filter(Boolean).slice(0, 4).map((l) => `         ${l}`).join('\n')}`)
    process.exit(1)
  }
}

function check(label: string, actual: unknown, expected: unknown) {
  checks++
  const ok = String(actual).trim() === String(expected).trim()
  if (!ok) failures++
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${label}` +
      (ok ? '' : `\n         expected  ${expected}\n         actual    ${actual}`),
  )
}

/** Asserts the statement raises, which is how a lot of this behaviour is specified. */
function checkThrows(label: string, statement: string, who?: Who) {
  checks++
  try {
    q(statement, who)
    failures++
    console.log(`  FAIL ${label}\n         expected an error, got success`)
  } catch (err) {
    const msg = (err as { stderr?: string }).stderr ?? ''
    const detail = msg.split('\n').find((l) => l.includes('ERROR:')) ?? 'error'
    console.log(`  ok   ${label}\n         ${detail.replace('ERROR:  ', '').trim()}`)
  }
}

const ALICE = 'user_2aliceAAA'
const BOB = 'user_2bobBBB'
const CARA = 'user_2caraCCC'

console.log(`\ndatabase ${DB}`)
execFileSync(PSQL, ['-d', 'postgres', '-q', '-c', `drop database if exists ${DB}`, '-c', `create database ${DB}`], {
  env: baseEnv,
  stdio: 'pipe',
})

console.log('\napply')
apply('supabase/scripts/local-shim.sql', 'local shim')
for (const f of readdirSync(resolve(ROOT, 'supabase/migrations')).sort()) {
  apply(`supabase/migrations/${f}`, f)
}
apply('supabase/seed.sql', 'seed')

// The shim grants before the tables exist; Supabase re-runs these per deploy.
q('grant usage on schema public to anon, authenticated, service_role')
q('grant select on all tables in schema public to anon, authenticated')
q('grant select, insert, update, delete on all tables in schema public to service_role')

console.log('\nseed data')
check('7 categories', q('select count(*) from categories'), '7')
check('7 challenges', q('select count(*) from challenges'), '7')
check('7 grading rows', q('select count(*) from challenge_grading'), '7')
check('public test names were parsed out of the source', q(`select jsonb_array_length(public_tests) > 0 from challenges where id = 'ch-pagination-cursor'`), 't')
check('budgets are positive', q('select bool_and(budget_ms > 0) from challenge_grading'), 't')
check('every challenge is in a seeded category', q(`select count(*) from challenges c left join categories cat on cat.id = c.category where cat.id is null`), '0')

console.log('\nRLS')
check('signed-in player cannot read the hidden suite', q('select count(*) from challenge_grading', as(ALICE)), '0')
check('service_role can read the hidden suite', q('select count(*) from challenge_grading', role('service_role')), '7')
check('anon cannot read the hidden suite (default-deny, not an error)', q('select count(*) from challenge_grading', role('anon')), '0')
check('signed-in player can read challenges', q('select count(*) from challenges', as(ALICE)), '7')

console.log('\nlifecycle')
const code = q(`select join_code from public.create_room('alice', 'Alice')`, as(ALICE))
check('join code is 6 characters', code.length, '6')
check('creator is the host', q(`select rp.is_host from room_players rp join rooms r on r.id = rp.room_id where r.join_code = '${code}' and rp.player_id = '${ALICE}'`), 't')
check('starts in the lobby', q(`select status from rooms where join_code = '${code}'`), 'lobby')
checkThrows('a non-member cannot start the game', `select public.start_game(id) from rooms where join_code = '${code}'`, as(BOB))

const roomId = q(`select id from rooms where join_code = '${code}'`)
checkThrows('a solo room cannot start', `select public.start_game('${roomId}')`, as(ALICE))
q(`select public.join_room('${code}', 'bob', 'Bob')`, as(BOB))
q(`select public.join_room('${code}', 'cara', 'Cara')`, as(CARA))
check('3 players seated', q(`select count(*) from room_players where room_id = '${roomId}'`), '3')
checkThrows('a bad join code is rejected', `select public.join_room('ZZZZZZ', 'x', 'X')`, as(ALICE))
check('rejoining is a no-op, not an error', q(`select public.join_room('${code}', 'alice', 'Alice')`, as(ALICE)) !== '', 'true')
check('still 3 players after the rejoin', q(`select count(*) from room_players where room_id = '${roomId}'`), '3')

console.log('\nround state machine')
const roundId = q(`select public.start_game('${roomId}')`, as(ALICE))
check('the room went active', q(`select status from rooms where id = '${roomId}'`), 'active')
check('a challenge was assigned', q(`select challenge_id is not null from rounds where id = '${roundId}'`), 't')
check('a deadline was set by the database', q(`select ends_at > now() from rounds where id = '${roundId}'`), 't')
check('everyone is coding', q(`select count(*) from room_players where room_id = '${roomId}' and status = 'coding'`), '3')
checkThrows('a non-host cannot start the game', `select public.start_game('${roomId}')`, as(BOB))
checkThrows('settling mid-round is refused', `select public.settle_round('${roundId}')`, as(ALICE))
checkThrows('a non-member cannot settle', `select public.settle_round('${roundId}')`, as('user_2nobody'))

console.log('\nscoring — PRD FR8: a slow correct submission outscores a fast broken one')
// A self-consistent timeline, so the Speed component is actually testable:
// the round ran for the full 180s and ended 60s ago. Alice locked in 60s in
// (two thirds of the round gone), Bob locked in after 10s, Cara never did.
const budget = Number(q(`select g.budget_ms from challenge_grading g join rounds r using (challenge_id) where r.id = '${roundId}'`))
check('the challenge has a performance budget', budget > 0, 'true')

q(`update rounds set started_at = now() - interval '180 seconds',
                         ends_at    = now() - interval '60 seconds'
    where id = '${roundId}'`)

q(`insert into submissions (round_id, player_id, code, language, elapsed_ms,
                            public_passed, public_total, hidden_passed, hidden_total,
                            runtime_ms, submitted_at)
   values ('${roundId}', '${ALICE}', 'x', 'javascript', 120000, 4, 4, 2, 2,
           ${Math.round(budget * 1.5)}, now() - interval '120 seconds')`)
q(`insert into submissions (round_id, player_id, code, language, elapsed_ms,
                            public_passed, public_total, hidden_passed, hidden_total,
                            runtime_ms, submitted_at)
   values ('${roundId}', '${BOB}', 'x', 'javascript', 10000, 4, 4, 0, 2,
           ${Math.round(budget * 0.5)}, now() - interval '170 seconds')`)

q(`select public.settle_round('${roundId}')`, as(ALICE))

const parts = (p: string) =>
  q(`select correctness || '|' || tests || '|' || performance || '|' || speed || '|' || score
     from round_results where round_id = '${roundId}' and player_id = '${p}'`)
  .split('|')
  .map(Number)
const [alice, bob, cara] = [parts(ALICE), parts(BOB), parts(CARA)]
const [aCorrect, aTests, aPerf, aSpeed, aTotal] = alice
const [bCorrect, , bPerf, bSpeed, bTotal] = bob
const named = (n: number[], who: string) =>
  `correctness ${n[0]} tests ${n[1]} performance ${n[2]} speed ${n[3]} total ${n[4]} (${who})`

console.log(`  ${named(alice, 'Alice — correct, 1.5x budget, two thirds through')}`)
console.log(`  ${named(bob, 'Bob — broken, under budget, barely started')}`)
console.log(`  ${named(cara, 'Cara — never submitted')}`)

check('Correctness is binary: 50 only when every hidden test passed', `${aCorrect},${bCorrect},${cara[0]}`, '50,0,0')
check('all public tests passed earns the full 30', `${aTests},${cara[1]}`, '30,0')
check('over budget decays Performance without zeroing it', aPerf > 0 && aPerf < 10, 'true')
check('under budget earns the full 10 Performance', bPerf, '10')
check('Speed reflects how much clock was left, so the early finisher wins it', bSpeed > aSpeed, 'true')
check('Speed is proportional to time remaining', Math.abs(aSpeed - 10 * (60 / 180)) < 0.1, 'true')
check('FR8: slow correct beats fast broken', aTotal > bTotal, 'true')
check('FR8 holds with room to spare', aTotal - bTotal >= 20, 'true')
check('a missing submission scores zero across all four parts', cara.join(','), '0,0,0,0,0')
check('the total is the sum of the four parts', Math.abs(alice.slice(0, 4).reduce((x, y) => x + y, 0) - aTotal) < 0.01, 'true')
check('the round is marked settled', q(`select settled_at is not null from rounds where id = '${roundId}'`), 't')
check('everyone is resolved', q(`select count(*) from room_players where room_id = '${roomId}' and status in ('scored','timeout')`), '3')

console.log('\nidempotence — six clients all race to settle')
q(`select public.settle_round('${roundId}')`, as(BOB))
q(`select public.settle_round('${roundId}')`, as(CARA))
check('settling twice does not double-count', q(`select count(*) from round_results where round_id = '${roundId}'`), '3')
check('totals are unchanged', parts(ALICE).join(','), alice.join(','))
check('scores are not rewritten by a second settle', q(`select count(*) from round_results where round_id = '${roundId}' and score = 0`), '1')

console.log('\nstandings')
q(`update rounds set ends_at = now() - interval '1 second'`)
const next = q(`select public.next_round('${roomId}')`, as(ALICE))
check('the game advances', q(`select status from rooms where id = '${roomId}'`), 'active')
check('round 2 exists', q(`select round_number from rounds where id = '${next}'`), '2')
q(`update rooms set current_round = total_rounds where id = '${roomId}'`)
q(`update rounds set ends_at = now() - interval '1 second' where id = '${next}'`)
q(`select public.settle_round('${next}')`, as(ALICE))
check('the room finishes on the last round', q(`select status from rooms where id = '${roomId}'`), 'finished')
const standings = q(`select player_id from final_standings('${roomId}') order by total_score desc`)
check('standings rank every player', standings.split('\n').filter(Boolean).length, '3')
check('Alice is on top', standings.split('\n')[0], ALICE)

console.log(failures === 0 ? `\n${checks} checks, all passed` : `\n${failures} of ${checks} checks failed`)
process.exit(failures === 0 ? 0 : 1)
