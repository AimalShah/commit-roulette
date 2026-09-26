import { CATEGORY_MAP } from '@commit-roulette/shared/challenges'
import { cn } from '@/lib/cn'
import type { Category } from '@commit-roulette/shared/types'

export function CategoryChip({
  category,
  className,
  size = 'default',
}: {
  category: Category
  className?: string
  size?: 'sm' | 'default'
}) {
  const meta = CATEGORY_MAP[category]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border font-semibold tracking-[0.1em] uppercase whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-[0.6rem]' : 'px-2 py-0.5 text-[0.68rem]',
        className,
      )}
      style={{
        color: meta.accent,
        borderColor: `color-mix(in oklab, ${meta.accent} 35%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${meta.accent} 12%, transparent)`,
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: meta.accent }}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  )
}

export function categoryAccent(category: Category): string {
  return CATEGORY_MAP[category].accent
}
