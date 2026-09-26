import { CATEGORIES, CHALLENGES } from '@commit-roulette/shared/challenges'
import { hashString, mulberry32, pickOne } from '@commit-roulette/shared/rng'
import {
  correctnessPoints,
  isGreen,
  performancePoints,
  testPoints,
  timePoints,
  totalScore,
} from '@commit-roulette/shared/scoring'
import type {
  Category,
  Challenge,
  Player,
  RoundScore,
  TestResult,
} from '@commit-roulette/shared/types'

/** Simulated sandbox budget per language, used to scale the performance points. */
const BUDGET_MS: Record<Challenge['language'], number> = {
  javascript: 180,
  python: 240,
}

/** Per-bot skill profile, so the leaderboard has a believable spread. */
interface BotSkill {
  id: string
  /** Fraction of the round used before submitting, 0–1. Lower is faster. */
  pace: number
  /** Probability the bot's submission is actually green. */
  competence: number
}

export const BOT_SKILLS: BotSkill[] = [
  { id: 'user_ahmed', pace: 0.14, competence: 0.94 },
  { id: 'user_hamza', pace: 0.24, competence: 0.82 },
  { id: 'user_ali', pace: 0.36, competence: 0.66 },
  { id: 'user_sadia', pace: 0.52, competence: 0.44 },
]

/** Known rivals get a fixed profile; anyone else gets a stable random one. */
export function skillFor(playerId: string): BotSkill {
  const known = BOT_SKILLS.find((s) => s.id === playerId)
  if (known) return known
  const h = hashString(playerId)
  return {
    id: playerId,
    pace: 0.16 + (h % 32) / 100,
    competence: 0.45 + ((h >>> 8) % 45) / 100,
  }
}

export function pickCategory(rng: () => number): Category {
  return pickOne(rng, CATEGORIES).id
}

/** One challenge per category so a landed wedge always has content behind it. */
export function pickChallengeForCategory(category: Category, rng: () => number): Challenge {
  const pool = CHALLENGES.filter((c) => c.category === category)
  return pickOne(rng, pool.length > 0 ? pool : CHALLENGES)
}

export function makeRng(seed: string) {
  return mulberry32(hashString(seed))
}

/**
 * Stand-in for the execution API. Runs the submitted code against the
 * challenge's fixed suite and returns per-test results. A submission that is
 * byte-identical to the starter has changed nothing, so it fails — which keeps
 * the demo honest instead of handing out free points.
 */
export function runTests(
  code: string,
  challenge: Challenge,
  opts: { forceGreen?: boolean; runtimeHint?: number } = {},
): TestResult[] {
  const unchanged = code.trim() === challenge.starterCode.trim()
  const green = opts.forceGreen ?? !unchanged
  const base =
    opts.runtimeHint ??
    Math.round(BUDGET_MS[challenge.language] * (0.6 + (hashString(code) % 90) / 100))

  return challenge.tests.map((test, index) => ({
    id: test.id,
    name: test.name,
    passed: green,
    expected: test.expected,
    received: green ? test.expected : 'undefined',
    durationMs: Math.max(12, Math.round(base / challenge.tests.length) + index * 7),
  }))
}

/**
 * Turns one executed submission into a graded round score. Shared by the
 * player path and the bot path so both go through the same formula.
 */
export function buildRoundScore(params: {
  playerId: string
  challenge: Challenge
  round: number
  results: TestResult[]
  elapsedMs: number
  totalMs: number
}): RoundScore {
  const { challenge, round, results, elapsedMs, totalMs } = params
  const green = isGreen(results)
  const passed = results.filter((r) => r.passed).length
  const total = results.length || challenge.tests.length
  const runtimeMs = results.reduce((sum, r) => sum + r.durationMs, 0)
  const budgetMs = 180 * Math.max(1, results.length)

  const correctness = correctnessPoints(green)
  const tests = testPoints(passed, total)
  const performance = green ? performancePoints(runtimeMs, budgetMs) : 0
  const speed = green ? timePoints(Math.max(0, totalMs - elapsedMs), totalMs) : 0

  return {
    playerId: params.playerId,
    round,
    challengeId: challenge.id,
    category: challenge.category,
    correctness,
    testsPassed: passed,
    testsTotal: total,
    performance,
    speed,
    score: totalScore({ correctness, tests, performance, speed }),
    elapsedMs,
  }
}

export function applyTotals(players: Player[], scores: RoundScore[], round: number, challenge: Challenge): Player[] {
  const byPlayer = new Map(scores.map((s, i) => [players[i]?.id, s]))
  return players.map((player) => {
    const score = byPlayer.get(player.id)
    if (!score) return player
    const entry: RoundScore = { ...score, round, challengeId: challenge.id, category: challenge.category }
    return {
      ...player,
      total: player.total + entry.score,
      rounds: [...player.rounds, entry],
    }
  })
}

/** Cumulative standings, sorted the same way the round board is. */
export function finalStandings(players: Player[]): Player[] {
  return [...players].sort(
    (a, b) => b.total - a.total || a.rounds.length - b.rounds.length || a.name.localeCompare(b.name),
  )
}
