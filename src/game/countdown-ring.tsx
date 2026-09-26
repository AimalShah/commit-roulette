import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/format'

const SIZE = 68
const STROKE = 5
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function CountdownRing({
  remainingMs,
  totalMs,
  className,
}: {
  remainingMs: number
  totalMs: number
  className?: string
}) {
  const progress = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0
  const urgent = remainingMs <= 30_000
  const critical = remainingMs <= 10_000

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full -rotate-90" aria-hidden="true">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={critical ? 'var(--destructive)' : urgent ? 'var(--warning)' : 'var(--primary)'}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            style={{ transition: 'stroke 400ms linear' }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center">
          <span
            className={cn(
              'tnum font-mono text-sm font-semibold',
              critical && 'text-destructive',
              urgent && !critical && 'text-warning',
            )}
          >
            {formatClock(remainingMs)}
          </span>
        </span>
      </div>
    </div>
  )
}
