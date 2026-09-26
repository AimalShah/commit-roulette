import { useEffect, useState } from 'react'

import { CategoryChip } from '@/components/category-chip'
import { PlayerChip } from '@/components/player-chip'
import { usePrefersReducedMotion } from '@/hooks/use-media-query'
import { RouletteWheel } from '@/game/roulette-wheel'
import { CATEGORY_MAP } from '@commit-roulette/shared/challenges'
import { cn } from '@/lib/cn'
import type { Category, Player, PlayerStatus } from '@commit-roulette/shared/types'

export function SpinStage({
  landed,
  round,
  players,
  statuses,
  spinCount,
}: {
  landed: Category | null
  round: number
  players: Player[]
  statuses: Record<string, PlayerStatus>
  spinCount: number
}) {
  const reducedMotion = usePrefersReducedMotion()
  const [settled, setSettled] = useState(false)

  // The wheel transition is 1500ms; hold the reveal until it lands.
  useEffect(() => {
    setSettled(false)
    const id = window.setTimeout(() => setSettled(true), reducedMotion ? 60 : 1500)
    return () => clearTimeout(id)
  }, [landed, reducedMotion, spinCount])

  const meta = landed ? CATEGORY_MAP[landed] : null

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-12 sm:px-6 sm:py-20">
      <span className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
        Round {round}
      </span>

      <div className="relative mt-6">
        <RouletteWheel
          landed={landed}
          spinning
          spinCount={spinCount}
          reducedMotion={reducedMotion}
          className={cn('transition-opacity duration-500', settled ? 'opacity-100' : 'opacity-90')}
        />
      </div>

      <div className="mt-10 flex min-h-[7.5rem] flex-col items-center justify-center text-center">
        {meta && settled ? (
          <div className="animate-in fade-in-0 zoom-in-95 duration-300 flex flex-col items-center gap-3">
            <CategoryChip category={meta.id} />
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{meta.label}</h2>
            <p className="text-muted-foreground text-sm">{meta.blurb}</p>
          </div>
        ) : (
          <p className="text-muted-foreground font-mono text-sm tracking-widest uppercase">
            Spinning…
          </p>
        )}
      </div>

      <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        {players.map((player) => (
          <PlayerChip
            key={player.id}
            player={player}
            status={statuses[player.id] ?? 'idle'}
            className="opacity-80"
          />
        ))}
      </div>
    </div>
  )
}
