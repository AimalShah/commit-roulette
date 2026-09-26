import type { Challenge } from '../types'

/** ch-pagination-cursor — owned by the challenges workstream. See docs/PLAN.md §7. */
export const ch_pagination_cursor: Challenge = {
  id: 'ch-pagination-cursor',
  title: 'The last item on page 3 disappears',
  category: 'bug-fix',
  difficulty: 'warmup',
  language: 'javascript',
  tagline: 'A cursor boundary bug that eats exactly one row per page.',
  description: `The activity feed paginates with an opaque cursor built from \`created_at\`. Users report that the first row of every page after the first is missing — the row that should appear *between* pages never shows up.

The feed looks correct on page 1 and quietly loses one entry on every subsequent page. Support tickets say "it's just not there", nobody has touched the date logic since the index migration.`,
  acceptance: [
    'The boundary row is returned by exactly one page, never zero',
    'Cursors built from identical timestamps stay stable',
    'Existing single-page behaviour is unchanged',
  ],
  starterCode: `// GET /feed?cursor=<token>&limit=25
export function paginate(rows, cursor, limit) {
const startIndex = cursor ? findIndex(rows, cursor) : 0
const page = rows.slice(startIndex, startIndex + limit)
const nextCursor = page.length < limit ? null : page[page.length - 1]
return { page, nextCursor }
}

function findIndex(rows, cursor) {
return rows.findIndex((row) => row.id === cursor.id)
}`,
  testCode: `import { paginate } from './solution'

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

test('next page includes the boundary row, not the one after it', () => {
const { page } = paginate(rows, { id: 'b' }, 2)
expect(page.map((r) => r.id)).toEqual(['c', 'd'])
})

test('every row is returned exactly once across all pages', () => {
const seen = new Set()
let cursor = null
do {
  const res = paginate(rows, cursor, 2)
  res.page.forEach((r) => seen.add(r.id))
  cursor = res.nextCursor
} while (cursor)
expect(seen.size).toBe(4)
})`,
  tests: [
    { id: 't1', name: 'first page returns the newest rows', input: 'rows, null, 2', expected: "['a', 'b']" },
    { id: 't2', name: 'boundary row is not skipped', input: "rows, {id:'b'}, 2", expected: "['c', 'd']" },
    { id: 't3', name: 'ties on created_at are stable', input: '2 rows, same timestamp', expected: 'no duplicates' },
    { id: 't4', name: 'all rows returned exactly once', input: 'full pagination walk', expected: '4 unique ids' },
    { id: 't5', name: 'final page returns a null cursor', input: 'rows, cursor at end', expected: 'null' },
  ],
  parMinutes: 4,
  tags: ['pagination', 'cursors', 'off-by-one'],
}
