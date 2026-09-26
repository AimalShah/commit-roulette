import type { Challenge } from '../types'

/** ch-order-search-injection — owned by the challenges workstream. See docs/PLAN.md §7. */
export const ch_order_search_injection: Challenge = {
  id: 'ch-order-search-injection',
  title: 'Order search lets a customer read another store’s orders',
  category: 'security',
  difficulty: 'standard',
  language: 'javascript',
  tagline: 'A search box concatenated straight into SQL.',
  description: `A penetration test on staging found that \`/orders/search?q=\` accepts a \`'\` and closes the LIKE clause, letting a customer append \`OR 1=1\` and read every order in the database.

The fix has to keep parameterisation — escaping quotes by hand is not a fix, and stripping input is not a fix. Build the query with bound parameters.`,
  acceptance: [
    'User input is never concatenated into the SQL string',
    'Search still matches case-insensitive partials',
    'A quote in the input is treated as data, not syntax',
  ],
  starterCode: `// GET /orders/search?q=<term>
export function buildSearchQuery(term) {
const like = '%' + term + '%'
return "SELECT id, total, status FROM orders WHERE customer_id = $1 AND title LIKE '" + like + "' ORDER BY created_at DESC LIMIT 50"
}`,
  testCode: `import { buildSearchQuery } from './solution'

test('user input is not interpolated into SQL', () => {
const { sql, params } = buildSearchQuery("' OR 1=1 --")
expect(sql).not.toContain('OR 1=1')
expect(params.some((p) => String(p).includes('OR 1=1'))).toBe(true)
})

test('search term is wrapped for partial matching', () => {
const { params } = buildSearchQuery('kayak')
expect(params).toContain('%kayak%')
})`,
  tests: [
    { id: 't1', name: 'input is never interpolated into SQL', input: "' OR 1=1 --", expected: 'no raw concat' },
    { id: 't2', name: 'injection payload lands in params', input: "' OR 1=1 --", expected: 'payload bound' },
    { id: 't3', name: 'partial match is case-insensitive', input: 'kayak', expected: 'ILIKE %kayak%' },
    { id: 't4', name: 'empty term returns an empty result set', input: "''", expected: '0 rows' },
    { id: 't5', name: 'semicolon payload is inert', input: "'; DROP TABLE orders; --", expected: 'table intact' },
  ],
  parMinutes: 5,
  tags: ['sql-injection', 'parameterisation', 'owasp-a03'],
}
