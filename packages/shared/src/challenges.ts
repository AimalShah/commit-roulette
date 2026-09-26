import type { Category, Challenge } from './types'

/**
 * The seed set is fixed and hand-checked (PRD §6). One challenge per
 * category so the roulette always has something to land on.
 */
export const CATEGORIES: {
  id: Category
  label: string
  short: string
  blurb: string
  accent: string
}[] = [
  {
    id: 'bug-fix',
    label: 'Bug Fix',
    short: 'BUG',
    blurb: 'Something is broken. Find out what.',
    accent: 'var(--cat-bug)',
  },
  {
    id: 'performance',
    label: 'Performance',
    short: 'PERF',
    blurb: 'It works. Just not fast enough.',
    accent: 'var(--cat-performance)',
  },
  {
    id: 'security',
    label: 'Security',
    short: 'SEC',
    blurb: 'Ship the hole before someone finds it.',
    accent: 'var(--cat-security)',
  },
  {
    id: 'testing',
    label: 'Testing',
    short: 'TEST',
    blurb: 'The suite already knows the answer.',
    accent: 'var(--cat-testing)',
  },
  {
    id: 'refactoring',
    label: 'Refactoring',
    short: 'REFA',
    blurb: 'Same behaviour, cleaner shape.',
    accent: 'var(--cat-refactoring)',
  },
  {
    id: 'database',
    label: 'Database',
    short: 'DATA',
    blurb: 'The query is fine. The round trip is not.',
    accent: 'var(--cat-database)',
  },
  {
    id: 'api',
    label: 'API',
    short: 'API',
    blurb: 'The contract says one thing, the handler says another.',
    accent: 'var(--cat-api)',
  },
]

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<Category, (typeof CATEGORIES)[number]>

export const CHALLENGES: Challenge[] = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
    id: 'ch-access-guard',
    title: 'Four boolean parameters, zero readable call sites',
    category: 'refactoring',
    difficulty: 'standard',
    language: 'python',
    tagline: 'A permission check with a signature nobody can remember.',
    description: `Every call site in the codebase reads like this:

    can_access(user, resource, is_admin=False, is_owner=False, is_banned=False, plan="free")

Four positional booleans in a row is a bug factory — nobody can tell which flag is which. The behaviour is well tested and must not change. Reshape the interface so the call sites read themselves.`,
    acceptance: [
      'No boolean positional parameters in the public signature',
      'Existing behaviour for all 16 flag combinations is preserved',
      'Deny-by-default: unknown combinations are denied',
    ],
    starterCode: `def can_access(user, resource, is_admin=False, is_owner=False, is_banned=False, plan="free"):
    if is_banned:
        return False
    if is_admin:
        return True
    if is_owner:
        return True
    if plan in ("pro", "team"):
        return resource.visibility == "org"
    return resource.visibility == "public"


# call sites, everywhere
can_access(user, doc, is_admin=True, is_banned=False, plan="free")
can_access(user, doc, is_owner=False, is_banned=True, plan="pro")`,
    testCode: `from solution import can_access, AccessRequest

def test_admin_is_allowed_even_when_banned():
    assert can_access(AccessRequest(role="admin", banned=True, plan="free"), doc)

def test_banned_owner_is_denied():
    assert not can_access(AccessRequest(role="user", banned=True, plan="pro", owns=True), doc)

def test_paid_plan_unlocks_org_visibility():
    assert can_access(AccessRequest(role="user", plan="pro"), doc_org)

def test_free_plan_cannot_read_org_doc():
    assert not can_access(AccessRequest(role="user", plan="free"), doc_org)

def test_public_doc_is_readable_by_anyone_active():
    assert can_access(AccessRequest(role="user", plan="free"), doc_public)`,
    tests: [
      { id: 't1', name: 'banned admin is denied', input: 'role=admin, banned=True', expected: 'False' },
      { id: 't2', name: 'owner can read their own private doc', input: 'owns=True', expected: 'True' },
      { id: 't3', name: 'pro plan unlocks org docs', input: 'plan=pro, org doc', expected: 'True' },
      { id: 't4', name: 'free plan is denied org docs', input: 'plan=free, org doc', expected: 'False' },
      { id: 't5', name: 'unknown request shape is denied', input: 'role=None', expected: 'False' },
    ],
    parMinutes: 7,
    tags: ['refactoring', 'api-design', 'flags'],
  },
  {
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
  },
  {
    id: 'ch-idempotent-charge',
    title: 'Double-charged on retry',
    category: 'api',
    difficulty: 'hard',
    language: 'javascript',
    tagline: 'The client retried, the handler charged twice.',
    description: `The payments webhook times out at 3s. When it does, the client retries with the same \`Idempotency-Key\` — and the handler charges the customer again. Three support tickets this week, same root cause.

Per the HTTP spec, replaying a request with the same key must return the *original* response, not run the handler again. The first caller still gets \`201\`; every replay gets the stored response and a \`Idempotency-Replayed: true\` header.`,
    acceptance: [
      'The handler body runs once per key',
      'Replays return the first response, byte for byte',
      'Concurrent replays wait for the in-flight request instead of duplicating it',
    ],
    starterCode: `// POST /payments  (header: Idempotency-Key: <uuid>)
export async function handler(req, res, deps) {
  const key = req.header('Idempotency-Key')
  if (!key) return res.status(400).json({ error: 'Idempotency-Key required' })

  // TODO: we store the key *after* charging, so a retry in between charges twice
  const charge = await deps.payments.charge(req.body.amount, req.body.customer)

  await deps.store.set('idem:' + key, JSON.stringify({ charge }), 'EX', 86400)

  res.set('Idempotency-Replayed', 'false')
  return res.status(201).json({ charge })
}`,
    testCode: `import { handler } from './solution'

const deps = fakeDeps()

test('first call creates a charge', async () => {
  const res = await invoke(handler, deps, { key: 'k1', amount: 100 })
  expect(res.status).toBe(201)
  expect(deps.payments.chargeCount).toBe(1)
})

test('replay returns the stored response and does not charge again', async () => {
  await invoke(handler, deps, { key: 'k2', amount: 100 })
  const res = await invoke(handler, deps, { key: 'k2', amount: 100 })
  expect(deps.payments.chargeCount).toBe(1)
  expect(res.headers['Idempotency-Replayed']).toBe('true')
  expect(res.body.charge.id).toBe('ch_first')
})

test('different keys create different charges', async () => {
  await invoke(handler, deps, { key: 'k3', amount: 100 })
  await invoke(handler, deps, { key: 'k4', amount: 100 })
  expect(deps.payments.chargeCount).toBe(2)
})

test('concurrent replays collapse into one charge', async () => {
  await Promise.all([
    invoke(handler, deps, { key: 'k5', amount: 100 }),
    invoke(handler, deps, { key: 'k5', amount: 100 }),
  ])
  expect(deps.payments.chargeCount).toBe(1)
})`,
    tests: [
      { id: 't1', name: 'first call creates a charge', input: 'key=k1', expected: '201, chargeCount 1' },
      { id: 't2', name: 'replay returns the stored response', input: 'key=k2 twice', expected: 'chargeCount 1' },
      { id: 't3', name: 'replay sets the replay header', input: 'second call', expected: 'Idempotency-Replayed: true' },
      { id: 't4', name: 'missing key is a 400', input: 'no header', expected: '400' },
      { id: 't5', name: 'concurrent replays collapse to one charge', input: '2 parallel, same key', expected: 'chargeCount 1' },
    ],
    parMinutes: 9,
    tags: ['idempotency', 'retries', 'http-semantics'],
  },
]

export const CHALLENGE_MAP = Object.fromEntries(
  CHALLENGES.map((c) => [c.id, c]),
) as Record<string, Challenge>
