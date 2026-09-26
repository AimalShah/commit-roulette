# Commit Roulette — Product Requirements Document

Companion to `design.md` (visual system) and `commit-roulette` project notes. This document defines what gets built, in what order, and who owns what for the hackathon build.

> Team roster below uses Aimal, Ahmed, Hamza, Ali — the four names from the original concept brief. Swap in real teammates; the role split holds either way.

---

## 1. Summary

Commit Roulette is a multiplayer coding-challenge game: players join a room, spin a roulette for a random real-world dev task (bug fix, performance, security, testing, refactoring, database, API), race a timer, submit code, get scored by automated tests, and climb a round-by-round leaderboard. Think LeetCode's problem format crossed with Kahoot's live pacing — but the challenges are the kind of thing developers actually fix on a Tuesday, not algorithm trivia.

**Demo line for judges:** *"We turned real software-development problems into a multiplayer game. Create a room, spin the roulette, everyone gets the same challenge, race to solve it, and see who actually ships working code."*

## 2. Problem & opportunity

Coding-challenge platforms optimize for algorithmic puzzles that rarely resemble day-to-day engineering work. Social/live-competition formats (Kahoot, Jackbox) drive engagement through shared real-time pressure, a mechanic coding platforms rarely use. Commit Roulette sits at that intersection: real dev tasks, played live, scored automatically, in a format a judge can understand in under a minute without reading documentation.

## 3. Goals

| Goal | Type | Notes |
|---|---|---|
| Working live demo, 3+ players, one full room-to-leaderboard loop | Primary | Must survive an actual on-stage run |
| Judge understands the concept from a 60-second pitch | Primary | No walkthrough required |
| Code execution handled without a custom sandbox | Primary | Time and security constraint — see §10 |
| Clean, on-brand UI matching `design.md` | Secondary | Differentiates from a bare functional prototype |
| Foundation reusable past the hackathon | Non-goal for v1 | Nice-to-have, not a build constraint |

## 4. Target users

- **Immediate:** hackathon judges and the live audience during the demo.
- **Primary intended user (post-hackathon):** developers who want a faster, more social alternative to solo LeetCode grinding — for practice, team-building, or interview prep.

## 5. MVP scope — in

- Create a room, get a short join code
- Join a room by code
- Lobby with a live player list (host-only Start Game)
- Roulette spin — lands on one category per round
- 5–10 hand-authored challenges (starter code + description + test suite), one per category minimum
- Fixed round timer (3:00 default)
- In-browser code editor
- Submit → run predefined test suite via an external execution API → pass/fail + score
- Correctness-weighted scoring (see §8, FR8)
- Round results screen + round leaderboard
- Host can start another round or end the game
- Final leaderboard
- Clerk auth (sign up / sign in) gating room creation

## 6. Out of scope — explicitly cut for this build

- General-purpose / arbitrary code execution sandbox (predefined tests only — see §10)
- XP, levels, achievements, badges
- Global leaderboard, friends leaderboard, per-category leaderboard
- Difficulty roulette (Easy/Medium/Hard/Chaos combos)
- Dynamically generated challenges — the 5–10 seed set is fixed and hand-checked
- Public profiles

Anything in this list that shows up mid-build is a sign of scope creep — cut it, don't schedule it for "after this feature."

## 7. User flow

Full detail lives in `design.md` → **Pages & flow**. Summary:

```
/                → landing, Create Room / Join Room
/sign-in, /sign-up  → Clerk
/dashboard       → Create Room / Join Room, recent games

/room/[code]     → single mounted route, internal states only:
  lobby → spinning → challenge → waiting → round-results → (spinning | final-results)
```

The room route does not reload between states — the realtime connection stays open for the whole session.

## 8. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR1 | Host can create a room and receive a short join code | P0 |
| FR2 | Player can join a room via code | P0 |
| FR3 | Lobby shows live player list; host-only Start Game | P0 |
| FR4 | Roulette selects one category at random per round, animates once, then locks | P0 |
| FR5 | All players in a room receive the identical challenge for that round | P0 |
| FR6 | Challenge screen shows prompt, category tag, starter code, and a live countdown | P0 |
| FR7 | Player can edit and submit code before the timer expires | P0 |
| FR8 | Submission is scored: Correctness 50 · Tests passed 30 · Performance 10 · Time 10 = 100. Correctness dominates — a fast broken submission must not outscore a slow correct one | P0 |
| FR9 | Submitted code runs against the challenge's predefined test suite via an external execution API, never in-process | P0 |
| FR10 | Player status updates live: `coding…` → `committed` | P0 |
| FR11 | Round-results screen shows this round's scores, ranked | P0 |
| FR12 | Host can trigger the next round (new spin) or end the game | P0 |
| FR13 | Final-results screen shows cumulative standings across all rounds | P0 |
| FR14 | Auth via Clerk gates room creation (joining may be open) | P0 |
| FR15 | Global leaderboard, XP, achievements | P2 (stretch, post-MVP) |

## 9. Data model

```
users            id (Clerk user id), username, avatar_url

rooms            id, join_code, host_id, status (lobby|active|finished), created_at

room_players     room_id, user_id, joined_at

challenges       id, title, category, starter_code, test_code, description
                 (5–10 seeded by hand — no builder UI in v1)

rounds           id, room_id, challenge_id, started_at, ends_at

submissions      id, round_id, user_id, code, passed_tests, score, submitted_at
```

`rounds` and `submissions` are the two tables that need realtime subscriptions (player status, timer sync, live results). Everything else is fetched once per screen.

## 10. Technical approach: code execution

The hard technical problem is running player-submitted code safely. **Do not** execute it inside Supabase Postgres, an Edge Function's own runtime, or any production process. Instead:

```
Player code + challenge's test_code
        ↓
Supabase Edge Function
        ↓
Hosted sandboxed execution API (Piston, Judge0, or e2b.dev)
        ↓
Pass/fail per test → write to submissions → calculate score
```

This keeps arbitrary code off your own infrastructure entirely and is the reason a 5–10 challenge, predefined-test approach is worth the constraint — it turns an open-ended sandboxing problem into a fixed, testable integration.

## 11. Tech stack

- **Frontend:** built via Devin, styled to `design.md` (Geist / Geist Mono, flat dark UI)
- **Auth:** Clerk
- **Data + realtime:** Supabase (Postgres + Realtime channels, one per room)
- **Code execution:** external sandboxed API (Piston / Judge0 / e2b) called from a Supabase Edge Function
- **Build tool:** Devin, directed by the four team members per workstream (§14)

## 12. Non-functional requirements

- **Security:** no user-submitted code ever runs in first-party infrastructure.
- **Reliability:** realtime state should reconnect gracefully on a dropped connection — a proven pattern from prior WebSocket/Redis multiplayer work, so lean on that experience rather than re-deriving it from scratch.
- **Performance:** round transitions under 2s; roulette animation fixed at ~1.5s regardless of network conditions.
- **Accessibility / responsive:** per `design.md` — keyboard focus visible, mobile-safe layout, reduced-motion respected.

## 13. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Realtime sync breaks under time pressure | High | Keep to one Supabase Realtime channel per room; scope player-status + round-state only, nothing more |
| Code execution integration eats the whole build | High | Pick one execution API on day one, integrate it before building any other feature, never build a custom sandbox |
| Scope creep (XP, badges, global leaderboard) | Medium | §6 is the enforced cut list — anything on it that resurfaces gets rejected, not deferred |
| Demo fails live (network, third player doesn't join in time) | High | Rehearse with a pre-seeded 3-player run; have a recorded fallback clip |
| Judges don't grasp the concept fast enough | Medium | Lead every explanation with the one-line pitch in §1, not the tech stack |

## 14. Team & roles

Devin does the implementation. Each person's real job is writing a precise spec for their workstream, prompting Devin against it, and reviewing what comes back — not hand-writing every line. Split by workstream so Devin can run on parallel branches without four people fighting over the same files.

| Person | Role | Owns | Directs Devin on | Also handles |
|---|---|---|---|---|
| **Aimal** | Tech lead / realtime & backend | Supabase schema, room + round state machine, Clerk wiring | Backend edge functions, realtime channel logic, schema migrations | Final call on architecture; unblocks the other three when Devin's output needs debugging |
| **Ahmed** | Frontend lead | Lobby, roulette, challenge panel, timer, results screens | Component build-out against `design.md` tokens | Catches visual drift from the design spec before it ships |
| **Hamza** | Challenges & scoring | The 5–10 seed challenges (prompt, starter code, tests), the execution-API integration, the scoring formula | The challenge pipeline: submit → execute → score → write | Challenge quality — this is the actual content judges will read and try |
| **Ali** | Product, demo & QA | End-to-end testing across a full multi-round game, bug triage, the pitch, submission materials | Cross-cutting fixes surfaced during testing | Owns the judge-facing story and runs the live demo rehearsal |

Suggested sync cadence: short check-ins after each major Devin pass (schema done, first playable round, execution API wired, full loop working) rather than continuous pairing — keeps four people from blocking on one Devin session.

## 15. Build phases

Sized as fractions of total hackathon time, not fixed hours — map to your actual window.

1. **Foundation (~15%)** — Supabase schema live, Clerk auth working, execution API integration proven end-to-end with one hardcoded challenge.
2. **Core loop (~40%)** — full lobby → spin → challenge → submit → score → results flow working for one room, ugly UI acceptable.
3. **Content & polish (~25%)** — all 5–10 challenges written and tested, `design.md` UI applied throughout, multi-round loop and final leaderboard working.
4. **Hardening & rehearsal (~20%)** — full run-throughs with 3+ real players, bug fixes only (no new features), pitch rehearsed against the actual running app.

## 16. Success criteria

- A judge can watch one full round (spin → code → submit → results) in under 4 minutes and explain the concept back afterward.
- The app survives a live 3-player round without a realtime desync or a crashed submission.
- No feature from §6 made it into the build.
