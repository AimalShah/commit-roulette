# Commit Roulette

Real bugs. Real deadlines. One room, one clock.

Commit Roulette is a live-coding competition: a room of 2–6 developers spins a
category wheel, everyone gets the same broken code, and the clock starts. Lock
in before the buzzer, score against the hidden test suite, and take the room.

This repository is the **frontend** (`apps/web`) plus the shared game logic
(`packages/shared`). Authentication is real — Clerk, with Supabase as the
database behind it. Rooms, bots, and code execution are still simulated in the
browser.

## Running it

```bash
npm install
cp apps/web/.env.example apps/web/.env   # fill in the keys below
npm run dev      # http://localhost:5173
```

```bash
npm run build    # production build into apps/web/dist/
npm run preview  # serve the production build
npm run lint     # oxlint
```

Node 20+ recommended.

## Auth setup (Clerk + Supabase)

The integration follows Clerk's official Supabase guide. All of this is
dashboard work and has to be done once per environment.

1. **Clerk application** — create an app at [dashboard.clerk.com](https://dashboard.clerk.com).
   - Enable GitHub: **User & Authentication → Social Connections → GitHub**.
   - Leave **Email/password** enabled as well.
2. **Clerk → Supabase integration** — activate it at
   [dashboard.clerk.com/setup/supabase](https://dashboard.clerk.com/setup/supabase)
   and copy the **Clerk domain** it gives you.
3. **Supabase** — in the Supabase dashboard go to
   **Authentication → Sign In / Providers → Add provider → Clerk** and paste
   that Clerk domain. Supabase now accepts Clerk session tokens, and
   `auth.jwt() ->> 'sub'` resolves to the Clerk user id.
4. **Schema** — run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   in the Supabase SQL editor. It creates `profiles`, `rooms` and
   `room_players`, enables RLS, and adds the select/insert policies.
5. **Environment** — copy `apps/web/.env.example` to `apps/web/.env`:

   | Variable | Where it comes from |
   | --- | --- |
   | `VITE_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys |
   | `VITE_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | same page (the publishable/anon key) |

   Vite only exposes variables prefixed with `VITE_` — there is no
   `NEXT_PUBLIC_` here. Never put the Supabase `service_role` key in a `VITE_`
   variable; it would ship in the client bundle.

**Clerk does not sync user records into Supabase.** There is no `auth.users`
row per player: ownership columns are `text` holding the Clerk subject claim
and default to `auth.jwt() ->> 'sub'`. A `profiles` row is created on first
sign-in by `useEnsureProfile()` in `apps/web/src/lib/supabase.ts`, which inserts
`handle`/`display_name` only and lets the column default fill in `user_id`.

All Supabase access goes through `createClerkSupabaseClient(session)`, which
passes the Clerk session token as the Supabase `accessToken`.

## What's here

| Route          | What it does                                                        |
| -------------- | ------------------------------------------------------------------- |
| `/`            | Landing page: how it works, the scoring breakdown, category preview   |
| `/sign-in`     | Clerk `<SignIn />` — GitHub OAuth or email/password                  |
| `/sign-up`     | Clerk `<SignUp />`                                                   |
| `/dashboard`   | Create a room, join with a code, see recent games (sign-in required)  |
| `/room/:code`  | The whole game: lobby → spin → challenge → results → final standings   |
| anything else  | 404                                                                  |

## The round loop

1. **Lobby** — share the six-character join code. Rivals trickle in on their
   own; the host starts once the room can fill.
2. **Spin** — the wheel picks a category and a challenge from it. The winner is
   chosen before the wheel moves, so the spin is a fixed 1.5s and always lands
   honestly.
3. **Challenge** — three minutes on the clock, a CodeMirror editor, and the
   brief: the bug, the acceptance criteria, the hints, and the visible test
   suite. Lock in any time; the code freezes and runs.
4. **Results** — who scored, what broke, and where the points came from. The
   host spins the next round or ends the game early.
5. **Final standings** — five rounds of cumulative scoring, a podium, and the
   full round-by-round history. Play again, or back to the dashboard.

## Scoring

Correctness carries the room, exactly as specified in the PRD:

| Component     | Points | What it measures                                     |
| ------------- | ------ | ---------------------------------------------------- |
| Correctness   | 50     | Hidden tests that only the brief hints at            |
| Tests passing | 30     | The public suite you can see                         |
| Performance   | 10     | Build time and bundle size against the budget        |
| Time          | 10     | How much of the three minutes you left on the table  |

Anyone who does not lock in before the buzzer scores zero. Late submissions are
rejected rather than scored.

## Where the fake parts are

Everything below is deliberately simulated, and isolated so a real service can
replace it one piece at a time:

- **Room transport** — `apps/web/src/game/use-room.ts` is a small state machine, not a
  socket. It models the phases, the round timer, and the leaderboard that a real
  room channel would push.
- **The other players** — bots in `apps/web/src/game/simulate.ts` with a pace and a
  competence rating, so some finish clean, some finish broken, and some run out
  of time.
- **Code execution** — `runTests()` compares the submitted code against the
  starter code. Change anything and you pass; change nothing and you fail. It
  never runs your code. A real build would hand the file to a sandbox and score
  whatever comes back.
- **Challenges** — seven hand-authored challenges in `packages/shared/src/challenges.ts`,
  each with a real bug, real acceptance criteria, a test suite, and a budget.

Authentication is the one piece that is no longer faked. Hosting requires a
Clerk session; joining a room with a code stays open to anyone, so `/room/:code`
and the landing page are public while `/dashboard` redirects to `/sign-in`.
`?room=K7X2QM` on an auth link lands the user in that room after signing in.

## Design notes

Flat dark surfaces, one acid-green accent, and a category hue per wedge.
Geist and Geist Mono are self-hosted in `apps/web/public/fonts` so the demo never waits
on a font CDN. Keyboard focus is always visible, the roulette honours
`prefers-reduced-motion`, and the room reflows to tabbed panels on a phone.

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Clerk, Supabase,
CodeMirror, Radix primitives, lucide-react. No component framework beyond that.

## License

MIT.
