/**
 * The zero-dependency test harness, as source.
 *
 * This file is injected verbatim at the top of every graded submission, ahead
 * of the player's code, so its identifiers share a module scope with theirs.
 * Everything here is `__`-prefixed or a documented test API (`test`, `expect`,
 * `describe`, `it`, `hidden_test`) to keep collisions with player code
 * vanishingly unlikely.
 *
 * Two jobs beyond providing matchers:
 *   1. Mark which tests are hidden, so the 50-point Correctness component is
 *      defined by the challenge author rather than inferred from ordering.
 *   2. Measure the run in-process. Judge0's own `time` is container overhead —
 *      a trivial script reports ~1.2s there and ~40ms locally — so using it for
 *      the Performance component would hand everyone zero. See docs/PLAN.md §6.
 */

export const HARNESS_JS = String.raw`
const __tests = []

function test(name, fn, opts) {
  __tests.push({ name: String(name), fn, hidden: !!(opts && opts.hidden) })
}
test.skip = () => {}
test.only = test

function describe(_name, fn) { fn() }
function it(name, fn, opts) { test(name, fn, opts) }
function beforeEach() {}

const __fmt = (v) => {
  try {
    return JSON.stringify(v, (_k, x) => (x === undefined ? '<undefined>' : x))
  } catch {
    return String(v)
  }
}
const __deepEqual = (a, b) => __fmt(a) === __fmt(b)

function expect(received) {
  const matchers = {
    toEqual: (e) => __deepEqual(received, e),
    toStrictEqual: (e) => __deepEqual(received, e),
    toBe: (e) => Object.is(received, e),
    toBeTruthy: () => Boolean(received),
    toBeFalsy: () => !received,
    toBeNull: () => received === null,
    toBeUndefined: () => received === undefined,
    toBeDefined: () => received !== undefined,
    toBeNaN: () => Number.isNaN(received),
    toBeGreaterThan: (e) => received > e,
    toBeGreaterThanOrEqual: (e) => received >= e,
    toBeLessThan: (e) => received < e,
    toBeLessThanOrEqual: (e) => received <= e,
    toBeCloseTo: (e, p = 2) => Math.abs(received - e) < Math.pow(10, -p) / 2,
    toHaveLength: (e) => received != null && received.length === e,
    toContain: (e) => Array.from(received == null ? [] : received).some((x) => __deepEqual(x, e)),
    toContainEqual: (e) => Array.from(received == null ? [] : received).some((x) => __deepEqual(x, e)),
    toMatch: (re) => re.test(String(received)),
    toHaveProperty: (k, v) => {
      const has = received != null && k in received
      return has && (v === undefined || __deepEqual(received[k], v))
    },
    toThrow: (e) => {
      try { received() } catch (err) { return e === undefined || String(err.message).includes(e) }
      return false
    },
  }
  const api = {}
  for (const key of Object.keys(matchers)) {
    api[key] = (e) => {
      if (!matchers[key](e)) throw new Error('expected ' + __fmt(received) + ' ' + key + ' ' + __fmt(e))
    }
  }
  api.not = new Proxy({}, {
    get: (_t, key) => (e) => {
      if (matchers[key](e)) throw new Error('expected NOT ' + key + ' ' + __fmt(e))
    },
  })
  return api
}

async function __run() {
  const results = []
  let passed = 0
  const startedAt = process.hrtime.bigint()

  for (const t of __tests) {
    try {
      await t.fn()
      passed++
      results.push({ name: t.name, hidden: t.hidden, passed: true })
    } catch (err) {
      const message = err && err.message ? err.message : String(err)
      results.push({ name: t.name, hidden: t.hidden, passed: false, error: message.slice(0, 300) })
    }
  }

  const runtimeMs = Number(process.hrtime.bigint() - startedAt) / 1e6
  console.log('__CR__' + JSON.stringify({
    passed,
    total: __tests.length,
    hiddenTotal: __tests.filter((t) => t.hidden).length,
    hiddenPassed: results.filter((r) => r.hidden && r.passed).length,
    runtimeMs: Math.round(runtimeMs * 100) / 100,
    results,
  }))

  // Deliberately exits 0 even when tests fail. A failing submission is a normal
  // outcome, and a non-zero exit makes Judge0 report NZEC — indistinguishable
  // from a genuine crash. The report above is what carries the verdict; a
  // non-zero exit now means the harness itself never finished.
}
`
