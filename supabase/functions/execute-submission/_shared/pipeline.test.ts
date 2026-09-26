/**
 * Integration tests for the grading pipeline, against the real ce.judge0.com.
 *
 * These are the tests that matter. The whole design rests on three claims that
 * are easy to get wrong and impossible to eyeball:
 *   - one concatenated script runs (Judge0 drops the multi-file `files` array)
 *   - a buggy solution and a fixed one are actually told apart
 *   - a hardcoded solution cannot beat the hidden tests
 *
 * Run with: node --experimental-strip-types --test
 * They hit a shared free instance, so they are not part of `turbo test` — wire
 * them to a manual `pnpm test:grader` so a flaky network cannot fail a build.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildJsScript, buildPythonScript, JUDGE0_LANGUAGE_IDS } from './build-script.ts'
import { createJudge0Adapter } from './judge0.ts'
import { grade, parseReport, redactForPlayer } from './grading.ts'

const adapter = createJudge0Adapter('https://ce.judge0.com')

const PAGINATION_TEST = `
const rows = [
  { id: 'a', created_at: '2026-01-01T10:00:00Z' },
  { id: 'b', created_at: '2026-01-01T10:00:00Z' },
  { id: 'c', created_at: '2026-01-01T09:00:00Z' },
  { id: 'd', created_at: '2025-12-31T18:00:00Z' },
]

test('first page returns the newest rows', () => {
  const { page } = paginate(rows, null, 2)
  expect(page.map((r) => r.id)).toEqual(['a', 'b'])
})

test('the boundary row is not skipped', () => {
  const { page } = paginate(rows, { id: 'b' }, 2)
  expect(page.map((r) => r.id)).toEqual(['c', 'd'])
})

test('every row appears exactly once across all pages', () => {
  const seen = new Set()
  let cursor = null
  do {
    const res = paginate(rows, cursor, 2)
    res.page.forEach((r) => seen.add(r.id))
    cursor = res.nextCursor
  } while (cursor)
  expect(seen.size).toBe(4)
})

test('a cursor cannot be used to skip rows', () => {
  const { page } = paginate(rows, { id: 'a' }, 3)
  expect(page.map((r) => r.id)).toEqual(['b', 'c', 'd'])
})
`

const BUGGY = `export function paginate(rows, cursor, limit) {
  const startIndex = cursor ? rows.findIndex((r) => r.id === cursor.id) : 0
  const page = rows.slice(startIndex, startIndex + limit)
  return { page, nextCursor: page.length < limit ? null : page[page.length - 1] }
}`

const FIXED = `export function paginate(rows, cursor, limit) {
  const startIndex = cursor ? rows.findIndex((r) => r.id === cursor.id) + 1 : 0
  const page = rows.slice(startIndex, startIndex + limit)
  return { page, nextCursor: page.length < limit ? null : page[page.length - 1] }
}`

async function runJs(solution: string, testCode = PAGINATION_TEST) {
  const outcome = await adapter.run({
    language: 'javascript',
    script: buildJsScript(solution, testCode),
  })
  return { outcome, report: parseReport(outcome.stdout) }
}

test('a buggy solution is graded below a fixed one', async () => {
  const buggy = await runJs(BUGGY)
  const fixed = await runJs(FIXED)

  assert.equal(buggy.outcome.status, 'accepted', 'the script itself should run')
  assert.equal(fixed.outcome.status, 'accepted')
  assert.ok(buggy.report, 'a report should be emitted')
  assert.ok(fixed.report)

  assert.ok(
    fixed.report!.passed > buggy.report!.passed,
    `expected the fix to score higher, got fixed=${fixed.report!.passed} buggy=${buggy.report!.passed}`,
  )
  assert.equal(fixed.report!.total, 4)
  assert.equal(fixed.report!.passed, 4, 'the fixed solution should be fully green')
})

test('a hidden test failure costs the 50-point correctness component', async () => {
  // A boundary case the public suite does not cover: the public tests all use
  // limit 2 from the first two cursors, so they miss the off-by-one entirely.
  // This is the shape of test that earns its 50 points.
  const withHidden = `${PAGINATION_TEST}

test('a cursor deep in the list resumes after its row', () => {
  const { page } = paginate(rows, { id: 'c' }, 2)
  expect(page.map((r) => r.id)).toEqual(['d'])
}, { hidden: true })
`
  const fixed = await runJs(FIXED, withHidden)
  assert.ok(fixed.report)
  assert.equal(fixed.report!.hiddenTotal, 1)
  assert.equal(fixed.report!.hiddenPassed, 1)

  // Same hidden test, buggy solution: the public suite is unaffected, the
  // hidden one is not. That asymmetry is the whole point of having both.
  const broken = await runJs(BUGGY, withHidden)
  assert.ok(broken.report)
  assert.equal(broken.report!.hiddenPassed, 0, 'the off-by-one must fail the hidden test')
  assert.ok(
    broken.report!.passed >= 2,
    'the public suite should mostly pass, so the failure is genuinely hidden',
  )
})

test('a hardcoded solution cannot pass tests it was never shown', async () => {
  const withHidden = `${PAGINATION_TEST}

test('the cursor never leaks a raw row id', () => {
  const { nextCursor } = paginate(rows, { id: 'b' }, 2)
  expect(nextCursor).not.toEqual({ id: 'd', created_at: '2025-12-31T18:00:00Z' })
}, { hidden: true })
`
  // Answers every visible assertion by lookup table. The hidden test asks for
  // something the table was never built for, so Correctness must stay at zero —
  // that is the whole reason hidden tests exist.
  const cheater = await runJs(
    `const __table = {
      'null|2': ['a', 'b'],
      'b|2': ['c', 'd'],
      'a|3': ['b', 'c', 'd'],
    }
     const __rows = [
       { id: 'a', created_at: '2026-01-01T10:00:00Z' },
       { id: 'b', created_at: '2026-01-01T10:00:00Z' },
       { id: 'c', created_at: '2026-01-01T09:00:00Z' },
       { id: 'd', created_at: '2025-12-31T18:00:00Z' },
     ]
     export function paginate(rows, cursor, limit) {
       const key = (cursor ? cursor.id : 'null') + '|' + limit
       const page = (__table[key] ?? []).map((id) => rows.find((r) => r.id === id))
       const seen = new Set()
       page.forEach((r) => seen.add(r.id))
       return { page, nextCursor: seen.size === 4 ? null : page[page.length - 1] }
     }`,
    withHidden,
  )
  assert.ok(cheater.report, 'the cheater should still produce a parseable report')
  const counts = grade(cheater.report, 'accepted')
  assert.equal(counts.publicPassed, counts.publicTotal, 'the cheater should pass the public suite')
  assert.equal(counts.hiddenPassed, 0, 'and must fail the hidden one')
  assert.ok(counts.hiddenTotal > 0)
})

test('an infinite loop is stopped and reported as a timeout', async () => {
  const outcome = await adapter.run({
    language: 'javascript',
    script: buildJsScript('while (true) {}', ''),
    timeoutMs: 4000,
    cpuSeconds: 2,
  })
  assert.equal(outcome.status, 'timeout')
  assert.equal(parseReport(outcome.stdout), null, 'a killed run emits no report')
  assert.equal(grade(null, outcome.status).executionStatus, 'timeout')
})

test('a syntax error is reported, not thrown', async () => {
  const { outcome } = await runJs('export function paginate( {{{ oops')
  const counts = grade(parseReport(outcome.stdout), outcome.status)
  assert.equal(counts.publicPassed, 0)
  assert.ok(['compile_error', 'runtime_error'].includes(counts.executionStatus))
})

test('python grades through the same pipeline', async () => {
  const pythonTests = `from solution import add

def test_adds():
    assert add(2, 2) == 4

def test_adds_negatives():
    assert add(-1, 1) == 0

@hidden_test
def handles_large_integers():
    assert add(2**31, 1) == 2**31 + 1
`
  const buggy = await adapter.run({
    language: 'python',
    script: buildPythonScript('def add(a, b):\n    return a - b\n', pythonTests),
  })
  const correct = await adapter.run({
    language: 'python',
    script: buildPythonScript('def add(a, b):\n    return a + b\n', pythonTests),
  })

  const buggyReport = parseReport(buggy.stdout)
  const correctReport = parseReport(correct.stdout)
  assert.ok(buggyReport, `expected a report, got: ${buggy.stdout} ${buggy.stderr}`)
  assert.ok(correctReport, `expected a report, got: ${correct.stdout} ${correct.stderr}`)

  // Same three tests, one character apart in the solution.
  assert.equal(correctReport!.total, 3)
  assert.equal(correctReport!.passed, 3)
  assert.equal(correctReport!.hiddenTotal, 1)
  assert.equal(correctReport!.hiddenPassed, 1)

  assert.equal(buggyReport!.total, 3)
  assert.equal(buggyReport!.passed, 0)
  assert.equal(buggyReport!.hiddenPassed, 0)

  // The in-process timer, which is what Performance scores on.
  assert.ok(correctReport!.runtimeMs >= 0)
})

test('the language ids are the ones ce.judge0.com actually serves', async () => {
  const res = await fetch('https://ce.judge0.com/languages/?default=true')
  const languages = (await res.json()) as Array<{ id: number; name: string }>
  for (const [language, id] of Object.entries(JUDGE0_LANGUAGE_IDS)) {
    assert.ok(
      languages.some((l) => l.id === id),
      `judge0 no longer serves language_id ${id} for ${language}`,
    )
  }
})

test('hidden test names are redacted before the player sees them', () => {
  const redacted = redactForPlayer([
    { name: 'public one', passed: true },
    { name: 'the secret assertion', passed: false, hidden: true, error: 'leaked' },
  ])
  assert.equal(redacted[0]?.name, 'public one')
  assert.equal(redacted[1]?.name, 'Hidden test')
  assert.equal(redacted[1]?.error, undefined, 'the failure reason must not leak either')
})
