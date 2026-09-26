import { Check, X } from 'lucide-react'

import { SCORE_BREAKDOWN } from '@commit-roulette/shared/scoring'
import { cn } from '@/lib/cn'
import { formatDuration } from '@commit-roulette/shared/format'
import type { TestResult } from '@commit-roulette/shared/types'

/** The four weighted components from PRD FR8, with their actual contribution. */
export function ScoreBreakdown({
  correctness,
  tests,
  performance,
  speed,
  total,
  className,
}: {
  correctness: number
  tests: number
  performance: number
  speed: number
  total: number
  className?: string
}) {
  const values = { correctness, tests, performance, speed }

  return (
    <div className={cn('space-y-2.5', className)}>
      {SCORE_BREAKDOWN.map((row) => {
        const value = values[row.key]
        const pct = (value / row.points) * 100
        return (
          <div key={row.key} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3">
            <span className="text-muted-foreground text-[0.7rem] tracking-wide uppercase">
              {row.label}
            </span>
            <span className="bg-muted relative h-1.5 overflow-hidden rounded-full">
              <span
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full transition-[width] duration-500',
                  value > 0 ? 'bg-primary' : 'bg-transparent',
                )}
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </span>
            <span className="tnum text-right font-mono text-xs">
              {value.toFixed(0)}
              <span className="text-muted-foreground">/{row.points}</span>
            </span>
          </div>
        )
      })}

      <div className="border-border flex items-baseline justify-between border-t pt-3">
        <span className="text-xs font-medium tracking-[0.12em] uppercase">Round score</span>
        <span className="tnum text-primary font-mono text-2xl font-semibold">{total}</span>
      </div>
    </div>
  )
}

export function TestResults({
  results,
  className,
}: {
  results: TestResult[]
  className?: string
}) {
  const passed = results.filter((r) => r.passed).length
  const green = results.length > 0 && passed === results.length

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-[0.12em] uppercase">Test suite</span>
        <span
          className={cn(
            'font-mono text-xs',
            green ? 'text-success' : 'text-destructive',
          )}
        >
          {passed}/{results.length} passing
        </span>
      </div>

      <ul className="space-y-1.5">
        {results.map((result) => (
          <li
            key={result.id}
            className={cn(
              'flex items-start gap-2.5 rounded-md border px-2.5 py-2 text-xs',
              result.passed
                ? 'border-success/25 bg-success/[0.06]'
                : 'border-destructive/30 bg-destructive/[0.07]',
            )}
          >
            <span
              className={cn(
                'mt-px grid size-4 shrink-0 place-items-center rounded-full',
                result.passed ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive',
              )}
            >
              {result.passed ? <Check className="size-2.5" /> : <X className="size-2.5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block leading-snug font-medium">{result.name}</span>
              {!result.passed && (
                <span className="text-muted-foreground mt-0.5 block font-mono text-[0.68rem]">
                  expected {result.expected} · received {result.received}
                </span>
              )}
            </span>
            <span className="text-muted-foreground tnum shrink-0 font-mono text-[0.68rem]">
              {formatDuration(result.durationMs)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
