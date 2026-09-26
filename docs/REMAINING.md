# Remaining work

State as of the last commit. Architecture and the reasoning behind it are in
[`PLAN.md`](./PLAN.md); the product requirements are in [`PRD.md`](./PRD.md).

## Where the build actually is

| Area | State |
| --- | --- |
| Monorepo (pnpm + Turborepo) | done |
| Design system and all game UI | done, built and rendering |
| Database schema, RLS, state machine, scoring | done, 53 checks passing |
| Seed data generated from the challenge source | done, 7 challenges |
| Grader (Judge0 adapter, JS + Python harness, redaction) | done, 8 live tests passing |
| Clerk in the browser (sign-in, session hook, token bridge) | wired, **untested against a real Clerk project** |
| Room RPC calls from the dashboard (create/join) | wired, **never run against a real Supabase** |
| Room page driven by live room state | **not started — still the mock** |
| Realtime subscription | **not started** |
| Deployment | **not started** |

`pnpm typecheck`, `pnpm lint` (0 errors) and `pnpm build` are green.
`pnpm test:grader` and `pnpm db:check` are green.

The honest summary: **the backend and the grader are real and tested; the app
in front of them is still running on mock data.** Everything below exists to
close that gap.

---

## 1. Get a real Clerk + Supabase project talking to each other

Nothing about the Clerk or Supabase integration has been exercised against a
real project. Both sides are written; neither has ever run. Budget a morning
for this, not an afternoon, because the failure modes are quiet.

Order matters, because each step is invisible until the next one works:

1. Create the Supabase project, run `supabase db reset` to apply the four
   migrations and the seed.
2. Add Clerk as a Supabase third-party auth provider
   (Authentication → Sign In / Providers → Third-party Auth → Clerk).
3. Add `{"postgres_role": "authenticated"}` to the Clerk session token claims.
   **Without this, every request is treated as `anon` and RLS denies it.** You
   will get an empty room and no error message.
4. Set the Clerk session token lifetime to 60 seconds, so it outlives the
   realtime heartbeat (25s default).
5. Put the three browser values in `apps/web/.env.local` — see
   `apps/web/.env.example`, which has the exact click-path for each.
6. `pnpm dev`, sign in, and confirm the network tab shows a Clerk JWT going out
   as `Authorization: Bearer`.

**Accept:** a signed-in user appears in `select * from profiles` in the Supabase
SQL editor, with `id` equal to their Clerk user id.

## 2. Drive the room page from real state

`src/game/use-room.ts` still imports `RIVAL_PLAYERS` from `src/mock/session.ts`
and simulates the whole game locally. The dashboard now calls the real
`create_room` and `join_room`, so those paths are proven, but nothing past the
door is.

- Replace `use-room.ts`'s simulation with `src/lib/room-api.ts`, which already
  wraps every RPC with Postgres's error codes mapped to messages.
- `/room/:code` should read the room, round, and seated players, and render from
  that. Keep the mock path behind a flag until it works.
- Drive `host → start_game → next_round → end_game` from the host controls.
- The bot roster can stay for a solo demo, but flag it clearly: bots must not
  look like real players to the people you are demonstrating to.

**Accept:** two browsers, one room, one round, the state matches in both.

## 3. Realtime

The whole point of the database being the referee is that six clients agree.
Polling would technically work and would also be worse in the specific way that
matters here: six clients polling a room that changes on a three-minute clock is
a lot of traffic, and the last player to learn a round ended is the last player
who loses.

- Subscribe to `rooms`, `rounds`, `room_players`, `round_results` filtered to the
  room id. The publication is already set up in migration 004.
- The realtime socket needs its own Clerk token. `accessToken` in
  `src/lib/supabase.ts` already handles this, including the heartbeat.
- Re-derive the clock offset from `server_time()` on every round. A device
  clock edit must not win a round, and that guarantee lives in
  `public.server_time()`.

**Accept:** a submission in one browser shows up in the other within a second,
with no polling.

## 4. Call the grader

`supabase/functions/execute-submission` is written and its internals are tested,
but it has never been invoked over HTTP.

- `supabase functions serve execute-submission --env-file apps/web/.env.local`
- Point the CodeMirror submit button at it. The response shape is documented at
  the bottom of `index.ts`.
- **Hidden tests must not reach the browser.** The function already redacts
  them via `redactForPlayer`. Verify that by opening devtools and looking, not
  by reading the code.

**Accept:** a submission in the browser returns pass counts, and the network tab
contains no hidden test name or hidden test body.

## 5. Hidden tests — the biggest gap in the product

This is the one that should worry you most, and it is not an engineering task.

**All seven challenges currently have no hidden tests.** The seeder prints a
warning for each one. The consequence is concrete: the 50-point Correctness
component is currently satisfied by the public suite that every player can
already read, which means the 50 largest block of the score is free. A player
who hardcodes the visible tests scores 80.

The grader has a test that proves the mechanism works — a hardcoded solution
fails the hidden suite — so the machinery is ready and only the content is
missing.

- Each challenge needs tests that are *specifically* the cases a lazy fix
  misses. The cursor example in `pipeline.test.ts` is the model: the public
  tests use a limit of 2 from the first cursors, so they miss an off-by-one
  entirely, and one hidden test with a different limit catches it.
- `ch-n-plus-one-orders` also references `fakeDb()` and `fixture()` helpers that
  do not exist. It cannot run as written.

**Accept:** `pnpm seed` prints no warnings, and a hardcoded solution scores
below 50 on a challenge whose public suite it fully passes.

## 6. Deploy

Unstarted, and it is all managed services — nothing to provision.

- `apps/web` → Vercel or Netlify. Set the three `VITE_` values as build env vars.
  They are baked in at build time, so changing one means a redeploy.
- Edge Function → `supabase functions deploy execute-submission`. Set
  `SUPABASE_SERVICE_ROLE_KEY` with `supabase secrets set`. Never as a `VITE_`
  variable, and never in a file.
- Add the production URL to Clerk's redirect URLs and Supabase's Site URL.

**Accept:** the deployed URL runs a full game between two real people on
different networks.

---

## Known rough edges

- **`pnpm verify` runs everything** (typecheck, lint, build, grader tests, db
  checks) but needs a Postgres on `PGHOST`/`PGPORT` for the last step. Point it
  at a throwaway cluster; `db-check.mts` drops and recreates its own database.
- **The public Judge0 instance is a shared free service.** It worked throughout
  development and may rate-limit or vanish mid-demo. It is the single largest
  operational risk in the project. Have a self-hosted Judge0 or a paid plan as
  a backup before the demo, not after.
- **Judge0 CE ignores the multi-file `files` array**, so every submission is one
  concatenated script. That is fine now and will be the first thing to hurt when
  a challenge needs real modules.
- **TypeScript 6.0 and React 19** are new enough that a few library types are
  looser than expected. Nothing is broken, but do not trust autocomplete there.
- **The bundle is 1.37 MB** (428 kB gzipped), mostly CodeMirror. Route-level code
  splitting for the editor is the obvious win and is not urgent.
- **`docs/design.md` is referenced by the PRD but does not exist.** Either write
  it or drop the reference.

## Bugs found and fixed while building this

Worth keeping, because each was invisible until something actually ran:

- `settle_round` crashed on the final round of every game —
  `v_room.room_id` where a `rooms` row has `id`. The last round of every game
  would have failed on stage. Caught by `db:check`.
- Every RLS policy used `auth.uid()`, which is typed `uuid`, while a Clerk user
  id is text. Every policy would have failed at runtime with
  `operator does not exist: text = uuid`. Replaced with
  `public.current_player_id()`, which reads the `sub` claim as text.
- The JavaScript harness exited non-zero when tests failed, so Judge0 reported
  a Normal Wrong Answer as a runtime error and a crashed submission was
  indistinguishable from a failing one.
- The Python script builder deleted `import json as __json` from the harness
  while the harness still called it, so every Python submission raised
  `AttributeError` before running a single test.
