# Commit Roulette — Backend & Monorepo Plan

Turns the mock-only frontend in this repo into a live multiplayer game on Clerk +
Supabase, with a hosted sandbox grading player code. No custom backend.

Companion to `PRD.md` (what to build) and `README.md` (what exists today).

---

## 0. Verified findings

These were checked live against real services before this plan was written. They
change the design, so they lead.

| # | Finding | Consequence |
|---|---|---|
| 1 | **Piston is dead.** `POST https://emkc.org/api/v2/piston/execute` returns `HTTP 401 — "Public Piston API is now whitelist only as of 2/15/2026"`. | PRD §10's first choice no longer works. Execution moves to **Judge0 CE**. |
| 2 | **Judge0 CE works with no API key.** `https://ce.judge0.com` — verified `JavaScript (Node.js 22.08.0)` id `102` and `Python (3.12.5)` id `100` both execute. Returns `time` (s), `memory` (KB), `exit_code`, `status`, `stdout`, `stderr`. `wait=true` gives a synchronous single round-trip. | Cheapest viable grader. No signup, no key, nothing to leak. |
| 3 | **Judge0 CE ignores the multi-file `files` array.** It writes `source_code` to `/box/script.js` and drops the rest — `ERR_MODULE_NOT_FOUND: /box/harness.mjs`. Also `source_code` is required (`422 {"source_code":["can't be blank"]}`). | The Edge Function must ship **one concatenated script** per submission. See §6. |
| 4 | **The seed `testCode` is Vitest/Jest dialect** — `test()`, `expect().toEqual()`, `import { x } from './solution'` — which Judge0 cannot run. | Needs a **~90-line zero-dependency harness** injected by the Edge Function. Designed to keep the existing test bodies *unchanged*. See §6.2. |
| 5 | **Judge0's `time` field is container overhead.** A trivial script reports `~1.17s`; the same script locally takes `~40ms`. | Performance points must come from an **in-process timer inside the harness**, not from Judge0's number. Otherwise everyone scores 0 on Performance. |
| 6 | **Two seed challenges reference undefined helpers** — `ch-n-plus-one-orders` calls `fakeDb()` and `fixture()` that appear nowhere in its `testCode`. | Challenge content is not finished. §7 (Hamza). |
| 7 | **ce.judge0.com is a shared free instance** — rate limits and outages are someone else's problem. | One execution per player per round (DB-enforced), a 20s budget, graceful degradation, and an adapter seam to swap in e2b during hardening. §10. |

Verified working end-to-end before committing to this design:

```
buggy solution  → status: Runtime Error (NZEC)  stdout: __CR__{"passed":2,"total":3,…}
fixed solution  → status: Accepted             stdout: __CR__{"passed":3,"total":3,…}
hardcoded cheat → caught by the negative assertions
infinite loop   → status: Time Limit Exceeded, no __CR__ line
```

---

## 1. Decisions

| Decision | Choice | Why |
|---|---|---|
| Package manager | **pnpm workspaces** | What Turborepo is built on; strict `node_modules`, `workspace:*` protocol. |
| Task runner | **Turborepo** | Requested. Caches build/lint/typecheck/test across packages. |
| Web app | **Vite + React Router 7, unchanged** | ~4,900 lines of finished UI. Clerk and Supabase both ship first-class Vite clients. Porting to Next.js is a rewrite, not a refactor. |
| Auth | **Clerk**, with Supabase as a third-party JWT verifier | PRD FR14. Clerk signs the JWT; Postgres `auth.uid()` returns the Clerk user id. No auth code of ours. |
| Data + realtime | **Supabase Postgres + Realtime** | PRD §11. |
| Code execution | **Judge0 CE via a Supabase Edge Function** | Finding #1 and #2. |
| Sign-in to **join** a room | **Required, same as creating** | PRD FR14 says joining *may* be open. Requiring it removes the entire guest-token class of auth bugs for ~4 seconds of Clerk OAuth on stage. §9 has the escape hatch if Ali decides otherwise. |

### What "no custom backend" permits

| Allowed | Not allowed |
|---|---|
| Supabase Postgres, RLS, `SECURITY DEFINER` RPCs | A Node/Express/Fastify/Next server |
| Supabase Realtime | Cloudflare Workers, Railway, Fly, Render, any VM |
| Supabase Edge Functions (Supabase's own Deno runtime, `supabase functions deploy`) | Redis, or any queue/broker |
| Clerk (hosted) | Custom auth, custom sessions |
| Judge0 CE (hosted) | **Any sandbox we run ourselves — this is PRD §12's hard line** |

Supabase Edge Functions are Supabase's own managed runtime, not infrastructure we
own. The critical property: **the function never executes player code.** It
validates, forwards to Judge0, and records the result. §12 holds.

---

## 2. Monorepo layout

```
game-ui/
├── package.json              # pnpm workspaces + turbo scripts, no deps
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .env.example
│
├── apps/
│   └── web/                  # @commit-roulette/web — the existing Vite app
│       ├── src/              #   moved verbatim from ./src
│       ├── index.html
│       ├── vite.config.ts
│       ├── tsconfig.json     #   extends ../../tsconfig.base.json
│       ├── .env.example
│       └── package.json
│
├── packages/
│   └── shared/               # @commit-roulette/shared — isomorphic, zero deps
│       └── src/
│           ├── types.ts      #   Category, Challenge, TestResult, RoundScore…
│           ├── scoring.ts    #   FR8 formula (mirrors the SQL; parity-tested)
│           ├── join-code.ts
│           ├── rng.ts
│           ├── format.ts
│           └── challenges/   #   the 7 seeds — the source the seeder reads
│               ├── index.ts
│               └── ch-pagination-cursor.ts …
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 202609260001_schema.sql
│   │   ├── 202609260002_rls.sql
│   │   ├── 202609260003_functions.sql
│   │   └── 202609260004_realtime.sql
│   ├── seed.sql              # GENERATED from packages/shared/challenges
│   ├── seed.mts              # the generator — `pnpm seed`
│   └── functions/
│       └── execute-submission/
│           ├── index.ts
│           └── _shared/
│               ├── judge0.ts     # the execution adapter
│               ├── build-script.ts
│               ├── harness/js.ts
│               ├── harness/python.ts
│               └── grading.ts
│
└── docs/
    ├── PRD.md
    ├── PLAN.md               # this file
    └── REHEARSAL.md          # Ali's demo runbook
```

Two packages, not five. `packages/config` (shared eslint/tsconfig presets) is
nice-to-have; skip it until someone actually needs it.

**The overlap problem.** `packages/shared` and the Edge Function both need the
scoring formula and the types, but Supabase only deploys files under
`supabase/functions/`, so the Edge Function cannot import a workspace package.
Resolution: **Postgres is the scoring authority** (it must be — a client must not
be able to declare its own score), `packages/shared/scoring.ts` mirrors it, and a
`test:parity` turbo task greps the weights out of the migration and asserts the
TypeScript matches. Cheap, and it fails the build on drift.

### Turbo pipeline

```jsonc
"build":     { "dependsOn": ["^build"],       "outputs": ["dist/**"] }
"typecheck": { "dependsOn": ["^build"] }
"lint":      { "dependsOn": ["^build"] }
"test":      { "dependsOn": ["^build"] }
"dev":       { "cache": false, "persistent": true }   // apps/web only
```

Root scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`,
`pnpm test`, `pnpm seed`, `pnpm db:reset`, `pnpm db:types`.

---

## 3. Auth — Clerk into Supabase

Clerk issues the session JWT; Supabase verifies it as a third-party auth provider.
`auth.uid()` in Postgres then returns the Clerk user id, and **every RLS policy in
§4 is written against `auth.uid()`** with no custom auth code anywhere.

One-time setup:

1. Clerk Dashboard → **Sessions → Customize session token**, add claim
   `"aud": "authenticated"` (Supabase's issuer check requires it).
2. Clerk Dashboard → **Webhooks → Add Endpoint** → Supabase project URL is the
   audience for `user.created` / `user.updated`.
3. Supabase Dashboard → **Authentication → Sign In / Up → Third-party Auth →
   Clerk**, paste the Clerk domain. Paste the same domain into
   **Authentication → URL Configuration → Additional Redirect URLs** for dev.
4. Web: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

In code, `apps/web/src/lib/supabase/client.ts` passes Clerk's token as the
Supabase access token via `createClient(url, key, { accessToken: async () => getToken() })`.
That is the whole integration. The Edge Function does the same thing with the
incoming `Authorization` header, so `auth.uid()` works inside it too.

> **Anonymous access is off by default.** With third-party auth configured,
> Supabase does not implicitly allow unauthenticated PostgREST traffic the way
> the built-in providers do. Set **Authentication → API → "Allow public sign-ups"**
> accordingly, or every read 401s. This is the single most common Clerk+Supabase
> integration failure — check it first when the lobby is empty.

---

## 4. Data model

PRD §9, adjusted where reality demanded it. Every deviation is called out.

```sql
users            →  profiles        id is Clerk's user id (user_xxx)
rooms                            + spin_seed, round_seconds, current_round
room_players                      + status, is_host
challenges       →  challenges      public columns only
                   challenge_grading  hidden: full suite + budget_ms
rounds                             + category, settled_at, unique(room_id, round_number)
submissions                        + language, public/hidden pass counts, runtime, memory, status
                   round_results  computed, never client-written
```

### The four changes that matter

1. **`profiles` instead of `users`.** `users` is a reserved word in Postgres and
   a schema-qualified pain everywhere else. `id text primary key` holds the Clerk
   id directly — no mapping table, no join, `auth.uid()` is the id.

2. **`challenge_grading` is a separate table, not a hidden column.** A
   column-level `REVOKE` looks tidier but breaks `select=*` in PostgREST, which
   is exactly what the client will type. A separate table with no RLS policy is
   default-deny, and `select=*` on `challenges` keeps working. The Edge Function
   uses the service role and reads it.

3. **`round_results` is computed in SQL.** PRD FR8 says correctness must dominate
   — that guarantee is worthless if a client can write its own score. A
   `settle_round()` RPC derives every score from the stored submissions. It is
   idempotent, so all clients can call it and the first one through wins; everyone
   converges on the same numbers. **No server cron needed.**

4. **`rounds` carries the category, chosen by the database.** The roulette wedge
   is derived in SQL from `hash(join_code, round_number)`, so every client
   animates to the same wedge without coordinating. The client no longer picks —
   it reads the round row and renders what the server decided.

### `submissions` enforces the anti-abuse rule

```sql
unique (round_id, player_id)
```

One lock-in per round, matching the UI's "lock in and it freezes". This is also
what keeps a 6-player × 5-round game at 30 Judge0 calls instead of an open meter.

### RLS summary

| Table | anon | authenticated (Clerk) | service_role |
|---|---|---|---|
| `challenges` | read | read | rw |
| `challenge_grading` | — | — | read |
| `profiles` | — | read all, write own | rw |
| `rooms` | — | read all, **insert own as host**, **update own room only** | rw |
| `room_players` | — | read room members, **insert self**, update own row | rw |
| `rounds` | — | read room members | rw |
| `submissions` | — | **read own only**, insert blocked (Edge Function only) | rw |
| `round_results` | — | read room members | rw |

Every write that advances the game state goes through a `SECURITY DEFINER` RPC
that re-checks the caller's identity in plpgsql. RLS on its own cannot express
"only the host, only in the lobby, only if ≥2 players" — the RPCs can, and they
are the only write path for `rooms`, `rounds` and `round_results`.

---

## 5. Room / round state machine

`RoomPhase` is unchanged from the frontend, but **the server owns it**. The
client's `useRoom` becomes a projection of `rooms.status` + the current `rounds`
row — the same reducer, minus every `setTimeout` that used to fake it.

```
lobby ──start_game()──▶ spinning ──▶ challenge ──▶ waiting ──▶ round-results
  │                        ▲                                      │
  │                        └────────── next_round() ◀─────────────┤
  └──────────────────────── end_game() ──────────────────────────▶ final-results
```

| RPC | Caller | Guard |
|---|---|---|
| `create_room(username)` | any signed-in user | inserts room + host player row, returns join code |
| `join_room(join_code, username)` | any signed-in user | status = `lobby`, players < 6, code not already claimed |
| `leave_room(room_id)` | member | — |
| `start_game(room_id)` | **host** | `lobby`, ≥ 2 players; picks round 1, sets `ends_at = now() + round_seconds` |
| `next_round(room_id)` | **host** | previous round settled, rounds < `total_rounds` |
| `end_game(room_id)` | **host** | sets `finished` |
| `settle_round(round_id)` | **any member** | only when `now() >= ends_at` or every member is `scored`/`timeout`; idempotent |
| `mark_coding(round_id)` | member | flips you to `coding` the moment the challenge opens |
| `ensure_profile(username)` | signed-in user | idempotent profile upsert, called on app load |
| `server_time()` | any | returns `now()` — the clock-skew probe (§8) |

### The timer never trusts a client

`ends_at` is set once, by the database, when the round opens. Every client renders
`ends_at − (Date.now() + skew)`. A laptop with a fast clock cannot win a round by
lying, and a dropped connection that reconnects four seconds later recomputes the
correct remaining time instead of resuming a stale local countdown.

### Scoring in SQL

`settle_round()` implements PRD FR8 exactly, mirroring `packages/shared/scoring.ts`:

| Component | Points | Formula |
|---|---|---|
| Correctness | 50 | **binary** — every hidden test passed |
| Tests passed | 30 | `30 × public_passed / public_total` |
| Performance | 10 | 10 at or under `budget_ms`, linear decay to 0 at 3× |
| Time | 10 | `10 × (ends_at − submitted_at) / round_ms` |

A player who never submitted scores 0 on all four. Because Correctness is binary
at 50 points, the maximum a fully-broken-but-fast submission can reach is 50
(30 tests + 10 perf + 10 time) — strictly below a correct submission's floor of
50+10. FR8's "a fast broken submission must not outscore a slow correct one"
holds by construction.

---

## 6. Code execution — Edge Function → Judge0 CE

`supabase/functions/execute-submission`

```
POST /functions/v1/execute-submission
Authorization: Bearer <clerk session JWT>
{ "round_id": "uuid", "code": "…" }

 1. auth.uid()                      Clerk JWT verified by Supabase
 2. load round + challenge_grading  service role
 3. reject: not active, now() > ends_at, already submitted
 4. build one script                harness + solution + tests
 5. POST ce.judge0.com              wait=true, cpu 3s, wall 8s, mem 128MB, network off
 6. parse __CR__                    per-test pass/fail + in-process ms
 7. insert submission               service role
 8. return own results              hidden test names redacted
```

The function **never runs the code**. It is a validator, a forwarder and a
recorder. Three independent rejections (step 3) sit in front of the one outbound
call, so the Judge0 meter cannot be run up by a bored lobby.

### 6.1 One concatenated script (finding #3)

```
┌─ harness/js.ts  (test, expect, describe, __run)   injected, never player-controlled
├─ solution       player code, `export ` stripped   → plain module scope
├─ test code      `import … from './solution'` line stripped
└─ await __run()  prints __CR__{…} and sets exit code
```

```
        Harness (test / expect / __run)
                  ↓
             Solution code      ← `export function foo` → `function foo`
                  ↓
   Test code − `import {x} from './solution'`
                  ↓
        `await __run()` → __CR__{"passed":2,"total":3,"results":[…],"runtimeMs":41}
```

The transform is four regexes in `build-script.ts`. It is a *fixed seed set*, not
an arbitrary-code sandbox (PRD §6 explicitly cuts that), so a bounded,
documented transform is the right trade — it is what lets Hamza keep the existing
test bodies verbatim.

### 6.2 The harness keeps Vitest syntax alive

`test()`, `describe()`, and `expect()` with `toEqual / toBe / toBeTruthy /
toBeFalsy / toBeNull / toBeUndefined / toBeGreaterThan(OrEqual) /
toBeLessThan(OrEqual) / toBeCloseTo / toHaveLength / toContain / toMatch /
toHaveProperty`, plus `.not`. Async test bodies are awaited — the n-plus-one
challenge needs it. No dependencies, no `node:test`, no transpiler.

Python needs no `expect` at all — the seed tests are plain `assert`, so the Python
harness just collects `test_*` functions and runs them. A `SyntaxError` becomes a
clean `compile_error` result instead of an opaque NZEC.

**Hidden tests** are marked in the test code, not inferred:

```js
test('handles null', () => { … })                        // public
test('does not leak the cursor', () => { … }, { hidden: true })   // hidden
```
```python
@hidden_test
def sql_injection_is_escaped(): …
```

Only the counts cross to the client; hidden test *names* are redacted in the
player's own results so the suite cannot be enumerated from the UI.

**`runtimeMs` is measured inside the harness**, around the test run (finding #5).
Judge0's `time` is container overhead and is stored separately as
`runtime_ms_wall` for debugging only — it never feeds a score.

---

## 7. Challenge content — the real remaining work

Seven seeds exist in `src/lib/challenges.ts` with descriptions, acceptance
criteria and starter code. They are **not shippable yet**:

- Every `testCode` is in Vitest dialect and needs the harness import stripped
  (mechanical — §6.1 does it at build time, not by hand).
- **Hidden tests do not exist.** FR8's 50-point Correctness component is defined
  as "hidden tests that only the brief hints at". There are currently none, which
  means Correctness would be worth 50 points for passing the visible suite — a
  hardcode scores 100. Each challenge needs 2–4 hidden tests.
- **`ch-n-plus-one-orders` calls `fakeDb()` and `fixture()`, which are defined
  nowhere** (finding #6). The suite cannot run as written.
- `par_minutes` and `budget_ms` need real values. The frontend invents
  `BUDGET_MS = { javascript: 180, python: 240 }`; per-challenge budgets are better
  and needed for the Performance component to mean anything.

This is the work judges actually read, and it is the workstream most likely to
eat the schedule. Do it in parallel with the backend, not after it.

---

## 8. Realtime

PRD §13 asks for "one Supabase Realtime channel per room". The literal mechanism
is Postgres Changes — a single multiplexed socket with server-side filters, not
per-room channels. The intent behind that line is *"as few moving parts as
possible"*, so the plan honours the intent:

| Subscription | Table | Filter | Drives |
|---|---|---|---|
| 1 | `room_players` | `room_id=eq.<id>` | live lobby, `coding… → committed → scored` (FR10) |
| 2 | `rounds` | `room_id=eq.<id>` | spin landed, challenge payload, `ends_at` → the clock |
| 3 | `submissions` | `round_id=eq.<id>` | how many rivals have locked in |

Plus one `round_results` read when the round settles — it is immutable once
written, so a subscription would be waste.

Resilient enough that Broadcast is unnecessary. If a round-open insert ever feels
slow on stage, a `room:<id>` Broadcast channel carrying a bare `round_opened`
nudge is a ten-line addition. Do not build it speculatively.

### Reconnect and resync

`supabase-js` reconnects on its own but replays nothing. On every transition into
`SUBSCRIBED`, run `resync()`: re-fetch the room, its players, the current round and
your own submission, then re-derive. Combined with `server_time()` for skew, a
dropped connection is invisible except for a brief "reconnecting" pill.

---

## 9. Guests, if Ali wants them

The plan requires sign-in to **join**. If open joining turns out to matter, the
minimum viable version: a `guest_secret` on `profiles`, a generated
`guest_<uuid>` id in `localStorage`, and RLS predicates that bind a caller to
their row by hashing the secret. It is roughly 40 lines across the migration and
the client, and it is a real source of auth bugs.

**Do it only if the demo needs it.** Three people scanning a Clerk QR code on
stage is not a problem worth 40 lines of risk.

---

## 10. Failure modes, and what happens on stage

| Failure | Behaviour | Player sees |
|---|---|---|
| Judge0 429 / 5xx | Edge Function returns `{ status: 'grader_unavailable' }` after 2 retries (250ms, 750ms) | Their own submission shows "grader busy", tests 0. **The round still settles** — the game does not block. |
| Judge0 fully down | Same, once | Same. Nothing hangs, nothing desyncs. |
| Submission never arrives | `settle_round()` marks the player `timeout` when `now() >= ends_at` | "No submission", 0 points |
| Player submits at 2:59 | `now() > ends_at` check in the function rejects it | "Time's up", 0 points |
| Player edits after locking in | `unique (round_id, player_id)` rejects the second write | Editor is read-only |
| Realtime drops | Auto-reconnect + `resync()` | "Reconnecting…" pill, then silent recovery |
| Two hosts click Start | `start_game()` guards on `status = 'lobby'`; the loser gets a toast | — |
| Everyone submits at 0:10 | `settle_round()` fires 1.2s after the last one settles rather than waiting out the clock | Results immediately |

The `settle_round()` "everyone settled" path is load-bearing for a 3-minute
demo — the current mock already does this with `SETTLE_GRACE_MS`. Keep it.

**Recorded fallback clip** (PRD §13) is cheap insurance. Record a full
3-player game on the day it works.

---

## 11. Build order

Mapped to PRD §15. Each phase ends at something demonstrable.

**Phase 0 — Monorepo (~half a day).** pnpm + turbo, `apps/web`, `packages/shared`,
`supabase/`. `pnpm build` green before anything else changes. *Everything below
assumes this.*

**Phase 1 — Foundation (~15%).** Clerk→Supabase auth. Migrations 0001–0004
applied to a real project. `create_room` / `join_room` working. Lobby shows two
real browsers. **Then, before any other feature: one hardcoded challenge graded
through Judge0** (PRD §13 says pick the execution API on day one). This is the
single biggest schedule risk and it gets retired first.

**Phase 2 — Core loop (~40%).** `start_game` → spin → challenge read → editor →
lock-in → `execute-submission` → `settle_round` → round results. One room, real
data, ugly UI — the existing stage components are already built, so this is
plumbing, not design.

**Phase 3 — Content & polish (~25%).** Hidden tests for all seven challenges,
missing helpers written, real budgets. `design.md` pass. Multi-round loop and
final leaderboard. **Start the challenge work here in parallel with Phase 1** —
it is the long pole and it has no dependencies.

**Phase 4 — Hardening (~20%).** Reconnect/resync, clock skew, Judge0 failure
mode, the three-player rehearsal, pitch rehearsal against the running app. No new
features. If Judge0 CE misbehaved during rehearsal, swap the e2b driver into
`judge0.ts` — the adapter interface exists for exactly this.

---

## 12. Ownership

PRD §14's concern was four people fighting over the same files. The file tree
below is the actual division — if a file is not listed, ask before touching it.

| Person | Owns (exclusive) |
|---|---|
| **Aimal** — tech lead | `supabase/migrations/*`, `supabase/functions/execute-submission/_shared/judge0.ts`, `apps/web/src/lib/supabase/*`, `apps/web/src/game/use-room-channel.ts`, `packages/shared/src/types.ts` |
| **Ahmed** — frontend | `apps/web/src/game/*-stage.tsx`, `apps/web/src/game/roulette-wheel.tsx`, `apps/web/src/components/**`, `apps/web/src/index.css` |
| **Hamza** — challenges & scoring | `packages/shared/src/challenges/*`, `supabase/functions/execute-submission/_shared/harness/*`, `apps/web/src/lib/scoring.ts` ↔ `settle_round()` in `0003_functions.sql` |
| **Ali** — QA & demo | `apps/web/src/dev/bots.ts`, `docs/REHEARSAL.md`. Nothing else in `src/`. |

`build-script.ts` is Aimal's; the harness contract it depends on is Hamza's. They
should land the harness first — Aimal's builder is a thin shim over it.

### Demo bot mode

`?bots=1` inserts three bot players through the *same* `join_room` RPC a human
uses, so a solo rehearsal exercises the real path. PRD §13's "third player
doesn't join in time" is the most likely on-stage failure; this is the mitigation.
`apps/web/src/dev/bots.ts`, Ali's file, off unless the flag is set.

---

## 13. Explicit non-goals

PRD §6's cut list stands unchanged, plus three this plan adds:

- **No Next.js.** Vite ships the same SPA with a fraction of the work.
- **No `packages/config`, no shared eslint preset.** Two packages do not need one.
- **No self-hosted Judge0, no Redis, no custom queue.** PRD §12.

And the one that matters most: **no challenge builder UI, no dynamic challenge
generation, no arbitrary-code sandbox.** A fixed hand-checked seed set is what
makes the execution integration tractable, and it is why this plan can promise that
player code never touches first-party infrastructure.
