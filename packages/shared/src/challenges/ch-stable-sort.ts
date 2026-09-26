import type { Challenge } from '../types'

/** ch-stable-sort — owned by the challenges workstream. See docs/PLAN.md §7. */
export const ch_stable_sort: Challenge = {
  id: 'ch-stable-sort',
  title: 'The leaderboard reorders itself on every refresh',
  category: 'testing',
  difficulty: 'standard',
  language: 'javascript',
  tagline: 'The suite is already written. The comparator just isn’t stable.',
  description: `A flaky test suite is red roughly one run in three. \`npm test\` passes locally, fails in CI, and nobody can reproduce it.

Bisecting landed on \`stableSortBy\`: when two rows tie on the sort key, their relative order flips between runs because \`Array.sort\` is not guaranteed stable across equal keys on older engines. The tests below are fixed — make them pass by implementing the comparator correctly.`,
  acceptance: [
    'Equal keys keep their original relative order',
    'Ties fall back to the secondary key when provided',
    'Input array is never mutated',
  ],
  starterCode: `// TODO: implemented badly — Array#sort stability is not guaranteed
// for equal keys on every engine we still support.
export function stableSortBy(rows, key, fallbackKey) {
return [...rows].sort((a, b) => {
  if (a[key] > b[key]) return -1
  if (a[key] < b[key]) return 1
  return 0
})
}`,
  testCode: `import { stableSortBy } from './solution'

const rows = [
{ name: 'ada', score: 90, joined: 2 },
{ name: 'grace', score: 90, joined: 1 },
{ name: 'linus', score: 100, joined: 3 },
]

test('sorts by descending score', () => {
expect(stableSortBy(rows, 'score').map((r) => r.name)).toEqual(['linus', 'ada', 'grace'])
})

test('equal keys keep input order', () => {
expect(stableSortBy(rows, 'score').map((r) => r.name)).toEqual(['linus', 'ada', 'grace'])
})

test('fallback key breaks ties', () => {
expect(stableSortBy(rows, 'score', 'joined').map((r) => r.name)).toEqual(['linus', 'grace', 'ada'])
})

test('does not mutate the input', () => {
const copy = [...rows]
stableSortBy(rows, 'score')
expect(rows).toEqual(copy)
})`,
  tests: [
    { id: 't1', name: 'sorts by descending score', input: '3 rows', expected: "['linus','ada','grace']" },
    { id: 't2', name: 'equal keys keep input order', input: 'tie on score', expected: 'input order preserved' },
    { id: 't3', name: 'fallback key breaks ties', input: 'tie on score, joined', expected: "['linus','grace','ada']" },
    { id: 't4', name: 'does not mutate the input', input: 'frozen array', expected: 'unchanged' },
    { id: 't5', name: 'stable across 200 repeated runs', input: '200 iterations', expected: 'identical order' },
  ],
  parMinutes: 5,
  tags: ['testing', 'determinism', 'array-sort'],
}
