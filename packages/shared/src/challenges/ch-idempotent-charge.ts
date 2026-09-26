import type { Challenge } from '../types'

/** ch-idempotent-charge — owned by the challenges workstream. See docs/PLAN.md §7. */
export const ch_idempotent_charge: Challenge = {
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
}
