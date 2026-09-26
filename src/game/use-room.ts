import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { rankScores } from '@/lib/scoring'
import type {
  Category,
  Challenge,
  GameState,
  Player,
  PlayerStatus,
  RoomPhase,
  RoundScore,
  Submission,
} from '@/lib/types'
import { you, RIVAL_PLAYERS } from '@/mock/session'
import { makeRng, pickCategory, pickChallengeForCategory, runTests, skillFor } from './simulate'
import { buildRoundScore } from './simulate'

export const ROUND_MS = 3 * 60 * 1000
export const TOTAL_ROUNDS = 5
/** PRD §12 — the spin is a fixed 1.5s regardless of network conditions. */
export const SPIN_MS = 1500
/** Simulated sandbox round-trip, so a submit feels like it hit a real API. */
export const EXECUTE_MS = 1100
/**
 * Once you have locked in, the board closes this long after the last rival
 * settles. Without a backend there is no real "still typing" signal, and a
 * three-minute wait on stage is a dead demo — so the round closes itself.
 */
export const SETTLE_GRACE_MS = 20_000
const MIN_PLAYERS = 2
const MAX_PLAYERS = 6

export interface RoomController extends GameState {
  joinCode: string
  roundMs: number
  totalRounds: number
  phaseStartedAt: number
  you: Player
  landedCategory: Category | null
  spinCount: number
  isHost: boolean
  canStart: boolean
  ranked: RoundScore[]
  startGame: () => void
  submit: (code: string) => void
  nextRound: () => void
  endGame: () => void
  returnToLobby: () => void
  addPlayer: (name: string) => void
  statuses: Record<string, PlayerStatus>
}

const idleStatuses = (players: Player[]): Record<string, PlayerStatus> =>
  Object.fromEntries(players.map((p) => [p.id, 'idle' as PlayerStatus]))

export function normaliseRoomCode(input?: string): string {
  return (input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

export function useRoom(codeFromUrl?: string): RoomController {
  const joinCode = useMemo(() => normaliseRoomCode(codeFromUrl) || 'K7X2QM', [codeFromUrl])
  const rng = useMemo(() => makeRng(joinCode), [joinCode])

  const [phase, setPhase] = useState<RoomPhase>('lobby')
  const [phaseStartedAt, setPhaseStartedAt] = useState(() => Date.now())
  const [round, setRound] = useState(1)
  const [players, setPlayers] = useState<Player[]>(() => [you])
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [landedCategory, setLandedCategory] = useState<Category | null>(null)
  const [spinCount, setSpinCount] = useState(0)
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [roundResults, setRoundResults] = useState<RoundScore[]>([])
  const [statuses, setStatuses] = useState<Record<string, PlayerStatus>>(() => idleStatuses([you]))
  const [history, setHistory] = useState<GameState['history']>([])

  const timers = useRef<number[]>([])
  const botDelays = useRef<Map<string, number>>(new Map())
  const nextGuestId = useRef(1)

  // Refs so callbacks never close over stale state.
  // Timers and callbacks need the latest committed values without being
  // re-created on every render.
  const playersRef = useRef(players)
  const challengeRef = useRef(challenge)
  const endsAtRef = useRef(endsAt)
  const submissionsRef = useRef(submissions)
  const statusesRef = useRef(statuses)

  useEffect(() => {
    playersRef.current = players
    challengeRef.current = challenge
    endsAtRef.current = endsAt
    submissionsRef.current = submissions
    statusesRef.current = statuses
  })

  const after = useCallback((fn: () => void, ms: number): number => {
    const id = window.setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }, [])

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  const enter = useCallback((next: RoomPhase) => {
    setPhase(next)
    setPhaseStartedAt(Date.now())
  }, [])

  const setStatus = useCallback((id: string, status: PlayerStatus) => {
    setStatuses((prev) => (prev[id] === status ? prev : { ...prev, [id]: status }))
  }, [])

  /* ---------------------------------------------------------------- *
   * Bots — stand in for the other clients on the room channel.
   * ---------------------------------------------------------------- */
  const scheduleBots = useCallback(
    (active: Challenge) => {
      botDelays.current = new Map(
        playersRef.current
          .filter((p) => !p.isYou)
          .map((p) => {
            const profile = skillFor(p.id)
            const jitter = (Math.random() - 0.5) * 9_000
            return [p.id, Math.max(4_000, Math.min(ROUND_MS + 6_000, profile.pace * ROUND_MS + jitter))]
          }),
      )

      botDelays.current.forEach((delay, playerId) => {
        const player = playersRef.current.find((p) => p.id === playerId)
        if (!player) return
        const profile = skillFor(playerId)
        const solved = Math.random() < profile.competence

        if (delay > ROUND_MS) {
          // Ran out of time — submitted nothing.
          after(() => {
            setStatus(playerId, 'timeout')
            setSubmissions((prev) => [...prev.filter((s) => s.playerId !== playerId)])
          }, delay)
          return
        }

        after(() => {
          setStatus(playerId, 'committed')
          after(() => {
            const code = solved
              ? `${active.starterCode}\n\n// ${player.handle}: fixed in ${Math.round(profile.pace * active.parMinutes * 10) / 10}m\n`
              : active.starterCode
            const results = runTests(code, active)
            setSubmissions((prev) => [
              ...prev.filter((s) => s.playerId !== playerId),
              {
                playerId,
                code,
                submittedAt: Date.now(),
                elapsedMs: Math.min(delay, ROUND_MS),
                results,
                score: 0,
              },
            ])
            setStatus(playerId, 'scored')
          }, EXECUTE_MS)
        }, delay)
      })
    },
    [after, setStatus],
  )

  /* ---------------------------------------------------------------- *
   * Round lifecycle
   * ---------------------------------------------------------------- */
  /**
   * Two halves of a spin, deliberately separate. `drawRound` picks the wedge
   * and mounts the wheel already aimed at it, so it has something to travel
   * to; `openChallenge` fires only once that travel is done. Folding these
   * into one callback made the wheel unmount on the same tick it got a
   * target, and the spin was invisible.
   */
  const drawRound = useCallback(() => {
    const category = pickCategory(rng)
    const picked = pickChallengeForCategory(category, rng)
    setLandedCategory(category)
    setChallenge(picked)
    setSubmissions([])
    setRoundResults([])
    setEndsAt(null)
    setSpinCount((n) => n + 1)
    enter('spinning')
    return picked
  }, [enter, rng])

  const openChallenge = useCallback(
    (roundNumber: number, picked: Challenge) => {
      setRound(roundNumber)
      setEndsAt(Date.now() + ROUND_MS)
      setStatuses((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([id, s]) => [id, s === 'idle' || s === 'scored' ? 'coding' : s]),
        ),
      )
      enter('challenge')
      scheduleBots(picked)
    },
    [enter, scheduleBots],
  )

  const startGame = useCallback(() => {
    if (playersRef.current.length < MIN_PLAYERS) return
    setHistory([])
    const picked = drawRound()
    after(() => openChallenge(1, picked), SPIN_MS)
  }, [after, drawRound, openChallenge])

  const nextRound = useCallback(() => {
    const roundNumber = round + 1
    const picked = drawRound()
    after(() => openChallenge(roundNumber, picked), SPIN_MS)
  }, [after, drawRound, openChallenge, round])

  const settleRound = useCallback(() => {
    const active = challengeRef.current
    if (!active) return
    clearTimers()

    // Anyone still mid-flight when the clock dies is a timeout.
    for (const player of playersRef.current) {
      const status = statusesRef.current[player.id]
      if (status === 'coding' || status === 'idle') setStatus(player.id, 'timeout')
    }

    after(() => {
      const finalSubmissions = submissionsRef.current

      const scores = playersRef.current.map<RoundScore>((player) => {
        const submission = finalSubmissions.find((s) => s.playerId === player.id)
        return buildRoundScore({
          playerId: player.id,
          challenge: active,
          round,
          results: submission?.results ?? [],
          elapsedMs: submission?.elapsedMs ?? ROUND_MS,
          totalMs: ROUND_MS,
        })
      })

      setRoundResults(scores)
      setPlayers((prev) =>
        prev.map((player) => {
          const own = scores.find((s) => s.playerId === player.id)
          if (!own) return player
          return { ...player, total: player.total + own.score, rounds: [...player.rounds, own] }
        }),
      )
      setHistory((prev) => [
        ...prev,
        { round, challengeId: active.id, category: active.category },
      ])

      enter(round >= TOTAL_ROUNDS ? 'final-results' : 'round-results')
    }, 900)
  }, [after, clearTimers, enter, round, setStatus])

  const submit = useCallback(
    (code: string) => {
      const active = challengeRef.current
      if (phase !== 'challenge' || !active) return
      if (statusesRef.current[you.id] !== 'coding') return

      const elapsedMs = Math.max(1_500, ROUND_MS - remainingOf(endsAtRef.current))
      setStatus(you.id, 'committed')
      enter('waiting')

      after(() => {
        const results = runTests(code, active)
        setSubmissions((prev) => [
          ...prev.filter((s) => s.playerId !== you.id),
          {
            playerId: you.id,
            code,
            submittedAt: Date.now(),
            elapsedMs,
            results,
            score: 0,
          },
        ])
        setStatus(you.id, 'scored')
      }, EXECUTE_MS)
    },
    [after, enter, phase, setStatus],
  )

  const endGame = useCallback(() => {
    clearTimers()
    setEndsAt(null)
    enter('final-results')
  }, [clearTimers, enter])

  const returnToLobby = useCallback(() => {
    clearTimers()
    setRound(1)
    setChallenge(null)
    setEndsAt(null)
    setSubmissions([])
    setRoundResults([])
    setLandedCategory(null)
    setHistory([])
    setPlayers([you])
    setStatuses(idleStatuses([you]))
    enter('lobby')
  }, [clearTimers, enter])

  const joinRival = useCallback(
    (bot: Omit<Player, 'total' | 'rounds'>) => {
      setPlayers((prev) => (prev.some((p) => p.id === bot.id) || prev.length >= MAX_PLAYERS ? prev : [...prev, { ...bot, total: 0, rounds: [] }]))
      setStatus(bot.id, 'idle')
    },
    [setStatus],
  )

  /** Name in, player on the roster. Guests get a generated handle. */
  const addPlayer = useCallback(
    (name: string) => {
      const known = RIVAL_PLAYERS.find((p) => p.name === name)
      if (known) {
        joinRival(known)
        return
      }
      const id = `user_guest_${nextGuestId.current++}`
      joinRival({
        id,
        name,
        handle: name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'guest',
        avatarSeed: id,
        isHost: false,
        isYou: false,
      })
    },
    [joinRival],
  )

  /* Lobby fills itself so a one-person demo still shows a live room. */
  useEffect(() => {
    if (phase !== 'lobby') return
    const bots = RIVAL_PLAYERS.slice(0, 3)
    const ids = bots.map((bot, index) =>
      after(() => addPlayer(bot.name), 1200 + index * 1700),
    )
    return () => ids.forEach(clearTimeout)
  }, [addPlayer, after, phase])

  /* Clock expiry settles the round. */
  useEffect(() => {
    if (phase !== 'challenge' && phase !== 'waiting') return
    if (!endsAt) return
    const id = window.setTimeout(settleRound, Math.max(0, endsAt - Date.now()) + 250)
    return () => clearTimeout(id)
  }, [endsAt, phase, settleRound])

  /* Everyone locked in early — don't make the room wait out the clock. */
  useEffect(() => {
    if (phase !== 'challenge' && phase !== 'waiting') return
    const active = playersRef.current
    if (active.length < MIN_PLAYERS) return

    const allSettled = active.every((p) => ['scored', 'timeout'].includes(statuses[p.id] ?? 'idle'))
    const rivalsLeft = active.filter(
      (p) => !p.isYou && !['scored', 'timeout'].includes(statuses[p.id] ?? 'idle'),
    )

    if (allSettled) {
      const id = window.setTimeout(settleRound, 1200)
      return () => clearTimeout(id)
    }

    // You are in, someone else is still going: hold the board open, but not forever.
    if (phase !== 'waiting' || rivalsLeft.length === 0) return
    const id = window.setTimeout(settleRound, SETTLE_GRACE_MS)
    return () => clearTimeout(id)
  }, [phase, settleRound, statuses])

  const ranked = useMemo(() => rankScores(roundResults), [roundResults])
  const canStart = players.length >= MIN_PLAYERS && phase === 'lobby'

  return {
    phase,
    round,
    roundMs: ROUND_MS,
    totalRounds: TOTAL_ROUNDS,
    joinCode,
    players,
    challenge,
    endsAt,
    submissions,
    roundResults: ranked,
    ranked,
    history,
    statuses,
    phaseStartedAt,
    you: players.find((p) => p.isYou) ?? you,
    landedCategory,
    spinCount,
    isHost: you.isHost,
    canStart,
    startGame,
    submit,
    nextRound,
    endGame,
    returnToLobby,
    addPlayer,
  }
}

function remainingOf(endsAt: number | null): number {
  if (!endsAt) return ROUND_MS
  return Math.max(0, endsAt - Date.now())
}
