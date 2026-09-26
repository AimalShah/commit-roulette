# Commit Roulette

Real bugs. Real deadlines. One room, one clock.

Commit Roulette is a live-coding competition: a room of 2–6 developers spins a
category wheel, everyone gets the same broken code, and the clock starts. Lock
in before the buzzer, score against the hidden test suite, and take the room.

This repository is the **frontend**. It runs entirely on mock data — no backend,
no database, no sandbox. Every page, state, and transition described in the PRD
is implemented and interactive in the browser.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # production build into dist/
npm run preview  # serve the production build
npm run lint     # oxlint
```

Node 20+ recommended.

## What's here

| Route          | What it does                                                        |
| -------------- | ------------------------------------------------------------------- |
| `/`            | Landing page: how it works, the scoring breakdown, category preview   |
| `/sign-in`     | Sign-in form (mocked — accepts anything and moves on)                |
| `/sign-up`     | Sign-up form (mocked)                                                |
| `/dashboard`   | Create a room, join with a code, see recent games                     |
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

- **Authentication** — `src/pages/auth-pages.tsx`. There is no session, no
  token, no provider. The signed-in user is a constant in `src/mock/session.ts`.
- **Room transport** — `src/game/use-room.ts` is a small state machine, not a
  socket. It models the phases, the round timer, and the leaderboard that a real
  room channel would push.
- **The other players** — bots in `src/game/simulate.ts` with a pace and a
  competence rating, so some finish clean, some finish broken, and some run out
  of time.
- **Code execution** — `runTests()` compares the submitted code against the
  starter code. Change anything and you pass; change nothing and you fail. It
  never runs your code. A real build would hand the file to a sandbox and score
  whatever comes back.
- **Challenges** — seven hand-authored challenges in `src/lib/challenges.ts`,
  each with a real bug, real acceptance criteria, a test suite, and a budget.

## Design notes

Flat dark surfaces, one acid-green accent, and a category hue per wedge.
Geist and Geist Mono are self-hosted in `public/fonts` so the demo never waits
on a font CDN. Keyboard focus is always visible, the roulette honours
`prefers-reduced-motion`, and the room reflows to tabbed panels on a phone.

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, React Router, CodeMirror, Radix
primitives, lucide-react. No component framework beyond that.

## License

MIT.
