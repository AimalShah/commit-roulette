import type { Category } from '../types'

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
