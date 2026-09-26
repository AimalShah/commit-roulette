import type { Challenge } from '../types'

/** ch-n-plus-one-orders — owned by the challenges workstream. See docs/PLAN.md §7. */
export const ch_n_plus_one_orders: Challenge = {
  id: 'ch-n-plus-one-orders',
  title: 'The orders page fires 240 queries per load',
  category: 'database',
  difficulty: 'hard',
  language: 'javascript',
  tagline: 'One query per order, every single request.',
  description: `\`GET /orders?userIds=1,2,3\` loops over the ids and issues a separate \`SELECT\` for each one, then another for each order's items. At 40 orders per user that is 120+ round trips per page load.

The endpoint contract is frozen — same JSON shape, same ordering, same totals. Batch the reads into a fixed number of queries and group the results in memory.`,
  acceptance: [
    'A fixed number of queries regardless of user count',
    'Every order maps back to the right user',
    'Users with no orders are present in the result with an empty list',
  ],
  starterCode: `// GET /orders?userIds=1,2,3
export async function loadOrders(db, userIds) {
const byUser = {}

for (const userId of userIds) {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [userId])
  const orders = await db.query('SELECT * FROM orders WHERE user_id = $1', [userId])

  for (const order of orders.rows) {
    order.items = await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id])
  }

  byUser[userId] = { user: user.rows[0], orders }
}

return byUser
}`,
  testCode: `import { loadOrders } from './solution'

test('issues two queries total, not one per user', async () => {
const db = fakeDb(fixture())
await loadOrders(db, [1, 2, 3])
expect(db.queryCount).toBeLessThanOrEqual(3)
})

test('orders are grouped under the right user', async () => {
const db = fakeDb(fixture())
const result = await loadOrders(db, [1, 2])
expect(result[1].orders.map((o) => o.id)).toEqual([10, 11])
expect(result[2].orders.map((o) => o.id)).toEqual([20])
})

test('items are attached to each order', async () => {
const db = fakeDb(fixture())
const result = await loadOrders(db, [1])
expect(result[1].orders[0].items).toHaveLength(2)
})

test('user with no orders is still present', async () => {
const db = fakeDb(fixture())
const result = await loadOrders(db, [1, 99])
expect(result[99]).toEqual({ user: null, orders: [] })
})`,
  tests: [
    { id: 't1', name: 'fixed query count for any user count', input: '3 users', expected: '<= 3 queries' },
    { id: 't2', name: 'orders grouped under the right user', input: 'users 1, 2', expected: 'no cross-contamination' },
    { id: 't3', name: 'items attached to every order', input: 'order 10', expected: '2 items' },
    { id: 't4', name: 'user with no orders is present', input: 'user 99', expected: '{ user: null, orders: [] }' },
    { id: 't5', name: 'duplicate userIds are de-duplicated', input: '[1, 1, 2]', expected: '1 query set' },
  ],
  parMinutes: 8,
  tags: ['n-plus-one', 'batching', 'joins'],
}
