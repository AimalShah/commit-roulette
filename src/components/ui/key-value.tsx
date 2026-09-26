import type * as React from 'react'

import { cn } from '@/lib/cn'

/** Mono label + value pair used all over the game UI. */
function KeyValue({
  label,
  value,
  className,
  mono = true,
}: {
  label: string
  value: React.ReactNode
  className?: string
  mono?: boolean
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <span className="text-muted-foreground text-xs tracking-wide uppercase">{label}</span>
      <span className={cn('text-sm font-medium', mono && 'font-mono tnum')}>{value}</span>
    </div>
  )
}

export { KeyValue }
