/**
 * Parses the harness report and turns it into the numbers `settle_round()`
 * scores from. No scoring happens here — the database is the authority, because
 * a client that could write its own score would make PRD FR8 meaningless.
 */

export interface HarnessResult {
  name: string
  hidden: boolean
  passed: boolean
  error?: string
}

export interface HarnessReport {
  passed: number
  total: number
  hiddenTotal: number
  hiddenPassed: number
  /** Measured in-process by the harness. This is what Performance scores on. */
  runtimeMs: number
  results: HarnessResult[]
}

const MARKER = '__CR__'

/** Judge0 truncates stdout; find the marker within what came back. */
export function parseReport(stdout: string): HarnessReport | null {
  const at = stdout.lastIndexOf(MARKER)
  if (at === -1) return null

  const line = stdout.slice(at + MARKER.length).split('\n')[0] ?? ''
  try {
    const parsed = JSON.parse(line) as HarnessReport
    if (typeof parsed.total !== 'number' || !Array.isArray(parsed.results)) return null
    return parsed
  } catch {
    return null
  }
}

export interface GradedCounts {
  publicPassed: number
  publicTotal: number
  hiddenPassed: number
  hiddenTotal: number
  runtimeMs: number
  executionStatus: 'accepted' | 'compile_error' | 'runtime_error' | 'timeout' | 'grader_unavailable'
}

export function grade(
  report: HarnessReport | null,
  executionStatus: GradedCounts['executionStatus'],
): GradedCounts {
  if (!report) {
    // No report means the script never finished: a syntax error, a throw before
    // the runner, or a kill. Nothing passed, and that is the honest answer.
    return {
      publicPassed: 0,
      publicTotal: 0,
      hiddenPassed: 0,
      hiddenTotal: 0,
      runtimeMs: 0,
      executionStatus: executionStatus === 'accepted' ? 'runtime_error' : executionStatus,
    }
  }

  return {
    publicPassed: report.results.filter((r) => !r.hidden && r.passed).length,
    publicTotal: report.results.filter((r) => !r.hidden).length,
    hiddenPassed: report.hiddenPassed,
    hiddenTotal: report.hiddenTotal,
    runtimeMs: Math.round(report.runtimeMs),
    executionStatus,
  }
}

/**
 * What the player is allowed to see about their own submission. Hidden test
 * names are redacted, so the UI cannot be used to enumerate the suite — the
 * counts are enough to understand the score and not enough to game it.
 */
export function redactForPlayer(results: HarnessResult[]): Array<{
  name: string
  passed: boolean
  error?: string
}> {
  return results.map((r) =>
    r.hidden
      ? { name: 'Hidden test', passed: r.passed }
      : { name: r.name, passed: r.passed, error: r.error },
  )
}
