/**
 * The execution adapter. One interface, one implementation.
 *
 * ce.judge0.com is a shared free instance, so this is deliberately the only
 * file that knows the grader exists. If it rate-limits during rehearsal, an
 * e2b driver drops in here and nothing else changes — that seam is the reason
 * `ExecutionAdapter` is a type rather than a bare fetch. See docs/PLAN.md §10.
 *
 * This module never executes player code. It forwards a string to a hosted
 * sandbox and reads back a report, which is what keeps PRD §12's hard line
 * intact: no user-submitted code ever runs in first-party infrastructure.
 */

import { JUDGE0_LANGUAGE_IDS, type Language } from './build-script.ts'

const DEFAULT_ENDPOINT = 'https://ce.judge0.com'

/** Judge0 status ids we care about. Everything else is a failure mode. */
const STATUS_ACCEPTED = 3
const STATUS_TLE = 5
const STATUS_COMPILE_ERROR = 6
const STATUS_RUNTIME_ERROR = 11

export interface ExecutionRequest {
  language: Language
  script: string
  /** Wall clock ceiling. Judge0 kills the process and reports a timeout. */
  timeoutMs?: number
  /** Hard CPU ceiling, so an infinite loop with output cannot run forever. */
  cpuSeconds?: number
  memoryKb?: number
}

export interface ExecutionOutcome {
  status: 'accepted' | 'compile_error' | 'runtime_error' | 'timeout' | 'grader_unavailable'
  stdout: string
  stderr: string
  /** Judge0's wall time in ms. Container overhead — never feeds a score. */
  wallMs: number
  memoryKb: number
}

export interface ExecutionAdapter {
  run(req: ExecutionRequest): Promise<ExecutionOutcome>
}

const unavailable = (stderr: string): ExecutionOutcome => ({
  status: 'grader_unavailable',
  stdout: '',
  stderr,
  wallMs: 0,
  memoryKb: 0,
})

/** Two retries with a short backoff, because a stage demo cannot absorb a 429. */
const RETRY_DELAYS_MS = [250, 750]

export function createJudge0Adapter(
  endpoint: string = Deno.env.get('JUDGE0_ENDPOINT') ?? DEFAULT_ENDPOINT,
  fetchImpl: typeof fetch = fetch,
): ExecutionAdapter {
  return {
    async run(req) {
      const languageId = JUDGE0_LANGUAGE_IDS[req.language]
      const wallSeconds = Math.ceil((req.timeoutMs ?? 8000) / 1000)

      const body = {
        language_id: languageId,
        source_code: req.script,
        stdin: '',
        cpu_time_limit: req.cpuSeconds ?? 3,
        wall_time_limit: wallSeconds,
        memory_limit: req.memoryKb ?? 128_000,
        // Belt and braces: even if a container escapes, it gets no network.
        enable_network: false,
      }

      let lastError = ''
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]))
        }

        // The Edge Function is the timeout ceiling, not Judge0 — a public
        // instance can queue for longer than any round should wait.
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), (req.timeoutMs ?? 8000) + 4000)

        try {
          const res = await fetchImpl(
            `${endpoint}/submissions/?base64_encoded=false&wait=true`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
              signal: controller.signal,
            },
          )

          if (!res.ok) {
            lastError = `judge0 responded ${res.status}`
            // 4xx other than 429 is our bug and will not fix itself on retry.
            if (res.status < 500 && res.status !== 429) break
            continue
          }

          const json = await res.json()
          return {
            status: mapStatus(json.status?.id, json.compile_output, json.stderr),
            stdout: json.stdout ?? '',
            stderr: [json.compile_output, json.stderr].filter(Boolean).join('\n'),
            wallMs: Math.round(parseFloat(json.time ?? '0') * 1000),
            memoryKb: Math.round(parseFloat(json.memory ?? '0')),
          }
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err)
        } finally {
          clearTimeout(timer)
        }
      }

      return unavailable(lastError || 'judge0 unreachable')
    },
  }
}

/**
 * `execution_status` describes whether *grading completed*, not whether the
 * player passed — a failing submission is a normal outcome. The harness always
 * exits 0 once it has emitted a report, so Accepted here means "the tests ran"
 * and the pass/fail counts in the report carry the verdict.
 */
function mapStatus(
  statusId: number | undefined,
  compileOutput: string | null,
  stderr: string | null,
): ExecutionOutcome['status'] {
  if (statusId === STATUS_ACCEPTED) return 'accepted'
  if (statusId === STATUS_TLE) return 'timeout'
  if (statusId === STATUS_COMPILE_ERROR) return 'compile_error'
  if (compileOutput && statusId === undefined) return 'compile_error'
  if (statusId === STATUS_RUNTIME_ERROR) return 'runtime_error'
  if (stderr) return 'runtime_error'
  return 'runtime_error'
}
