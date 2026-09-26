import type { RoundScore, TestResult } from './types'

/** PRD FR8 — the four components, weighted so correctness always dominates. */
export const WEIGHTS = {
  correctness: 50,
  tests: 30,
  performance: 10,
  time: 10,
} as const

export const SCORE_BREAKDOWN = [
  { key: 'correctness', label: 'Correctness', points: WEIGHTS.correctness, hint: 'Full suite green' },
  { key: 'tests', label: 'Tests passed', points: WEIGHTS.tests, hint: 'Partial credit' },
  { key: 'performance', label: 'Performance', points: WEIGHTS.performance, hint: 'Runtime vs budget' },
  { key: 'speed', label: 'Time', points: WEIGHTS.time, hint: 'Remaining on the clock' },
] as const

/**
 * Correctness is binary on purpose: a broken submission can never outscore a
 * correct one, no matter how fast it was submitted.
 */
export function correctnessPoints(passed: boolean): number {
  return passed ? WEIGHTS.correctness : 0
}

export function testPoints(passedCount: number, total: number): number {
  if (total <= 0) return 0
  return (WEIGHTS.tests * Math.min(passedCount, total)) / total
}

/** Full marks under budget, decaying linearly to zero at 3x the budget. */
export function performancePoints(runtimeMs: number, budgetMs: number): number {
  if (runtimeMs <= budgetMs) return WEIGHTS.performance
  const over = (runtimeMs - budgetMs) / (budgetMs * 2)
  return Math.max(0, WEIGHTS.performance * (1 - over))
}

export function timePoints(remainingMs: number, totalMs: number): number {
  if (totalMs <= 0) return 0
  return (WEIGHTS.time * Math.max(0, Math.min(1, remainingMs / totalMs)))
}

export function totalScore(parts: {
  correctness: number
  tests: number
  performance: number
  speed: number
}): number {
  return Math.round(parts.correctness + parts.tests + parts.performance + parts.speed)
}

export function rankScores(scores: RoundScore[]): RoundScore[] {
  return [...scores].sort(
    (a, b) => b.score - a.score || a.elapsedMs - b.elapsedMs || a.round - b.round,
  )
}

export function passedCount(results: TestResult[]): number {
  return results.filter((r) => r.passed).length
}

export function isGreen(results: TestResult[]): boolean {
  return results.length > 0 && results.every((r) => r.passed)
}

export function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
