import type { Challenge } from '../types'

import { ch_access_guard } from './ch-access-guard'
import { ch_group_by_logs } from './ch-group-by-logs'
import { ch_idempotent_charge } from './ch-idempotent-charge'
import { ch_n_plus_one_orders } from './ch-n-plus-one-orders'
import { ch_order_search_injection } from './ch-order-search-injection'
import { ch_pagination_cursor } from './ch-pagination-cursor'
import { ch_stable_sort } from './ch-stable-sort'

export { CATEGORIES, CATEGORY_MAP } from './categories'

/**
 * The seed set is fixed and hand-checked (PRD §6). One challenge per category
 * so the roulette always has something to land on.
 *
 * This array is the single source of truth for challenge content: `supabase/seed.mts`
 * reads it and emits `supabase/seed.sql`, so a change here reaches the database
 * with `pnpm seed`. Do not hand-edit `seed.sql`.
 */
export const CHALLENGES: Challenge[] = [
  ch_pagination_cursor,
  ch_group_by_logs,
  ch_order_search_injection,
  ch_stable_sort,
  ch_access_guard,
  ch_n_plus_one_orders,
  ch_idempotent_charge,
]

export const CHALLENGE_MAP = Object.fromEntries(
  CHALLENGES.map((c) => [c.id, c]),
) as Record<string, Challenge>
