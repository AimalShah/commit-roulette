import type { Challenge } from '../types'

/** ch-group-by-logs — owned by the challenges workstream. See docs/PLAN.md §7. */
export const ch_group_by_logs: Challenge = {
  id: 'ch-group-by-logs',
  title: 'The log dashboard takes 40 seconds to load',
  category: 'performance',
  difficulty: 'standard',
  language: 'javascript',
  tagline: 'Quadratic grouping over 200k log lines. Make it linear.',
  description: `The ops dashboard groups a day of logs by \`service\` then by \`level\`. At 200k lines the endpoint takes ~40s and occasionally times out.

The current implementation rebuilds an intermediate array on every iteration, so the work grows with the square of the input. The output shape must not change — the dashboard contract is fixed.`,
  acceptance: [
    'One pass over the input, no nested re-scan',
    'Identical output object shape and key ordering',
    'Handles an empty input without throwing',
  ],
  starterCode: `// GET /ops/summary?day=2026-01-14
export function summarize(logs) {
const services = []

for (const log of logs) {
  // ...and then we scan every service again for every line
  const existing = services.filter((s) => s.name === log.service)
  if (existing.length === 0) {
    services.push({ name: log.service, levels: [{ level: log.level, count: 1 }] })
  } else {
    const bucket = existing[0].levels.filter((l) => l.level === log.level)
    if (bucket.length === 0) {
      existing[0].levels.push({ level: log.level, count: 1 })
    } else {
      bucket[0].count += 1
    }
  }
}

return services
}`,
  testCode: `import { summarize } from './solution'

const logs = [
{ service: 'api', level: 'info' },
{ service: 'api', level: 'info' },
{ service: 'api', level: 'error' },
{ service: 'worker', level: 'info' },
]

test('groups by service and level', () => {
expect(summarize(logs)).toEqual([
  { name: 'api', levels: [{ level: 'info', count: 2 }, { level: 'error', count: 1 }] },
  { name: 'worker', levels: [{ level: 'info', count: 1 }] },
])
})

test('preserves first-seen service order', () => {
expect(summarize(logs).map((s) => s.name)).toEqual(['api', 'worker'])
})

test('empty input returns an empty array', () => {
expect(summarize([])).toEqual([])
})`,
  tests: [
    { id: 't1', name: 'groups by service and level', input: '4 mixed logs', expected: '2 services, 3 buckets' },
    { id: 't2', name: 'preserves first-seen order', input: 'mixed services', expected: "['api', 'worker']" },
    { id: 't3', name: 'empty input returns empty array', input: '[]', expected: '[]' },
    { id: 't4', name: '200k lines under 250ms', input: '200000 logs', expected: '< 250ms' },
  ],
  parMinutes: 6,
  tags: ['complexity', 'aggregation', 'hot path'],
}
