import { Crown, Play, UserPlus } from 'lucide-react'
import { useState } from 'react'

import { PlayerChip } from '@/components/player-chip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { usePrefersReducedMotion } from '@/hooks/use-media-query'
import { RouletteWheel } from '@/game/roulette-wheel'
import { CATEGORIES } from '@commit-roulette/shared/challenges'
import { cn } from '@/lib/cn'
import type { Player, PlayerStatus } from '@commit-roulette/shared/types'

export function LobbyStage({
  players,
  statuses,
  canStart,
  isHost,
  onStart,
  onAddPlayer,
}: {
  players: Player[]
  statuses: Record<string, PlayerStatus>
  canStart: boolean
  isHost: boolean
  onStart: () => void
  onAddPlayer: (name: string) => void
}) {
  const reducedMotion = usePrefersReducedMotion()
  const [guestName, setGuestName] = useState('')

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_20rem] lg:gap-12">
        <div>
          <span className="text-primary font-mono text-xs tracking-[0.2em] uppercase">
            Waiting room
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {players.length === 1
              ? 'Waiting for players to join'
              : `${players.length} players are in`}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-prose text-[0.95rem] leading-relaxed">
            Everyone in this room gets the same challenge, the same three minutes, and the same
            test suite. The score is correctness first — a fast broken solution never beats a slow
            correct one.
          </p>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <Label>Players</Label>
              <span className="text-muted-foreground font-mono text-xs">
                {players.length}/6
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {players.map((player) => (
                <PlayerChip
                  key={player.id}
                  player={player}
                  status={statuses[player.id] ?? 'idle'}
                />
              ))}
              {Array.from({ length: Math.max(0, 3 - players.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="text-muted-foreground/60 flex h-[3.25rem] items-center gap-2.5 rounded-lg border border-dashed px-2.5"
                >
                  <span className="bg-muted size-7 shrink-0 rounded-full" />
                  <span className="text-xs">Joining…</span>
                </div>
              ))}
            </div>
          </div>

          <Separator className="my-6" />

          {isHost ? (
            <Button size="lg" onClick={onStart} disabled={!canStart} className="w-full sm:w-auto">
              <Play />
              {canStart ? 'Start game' : 'Need at least 2 players'}
            </Button>
          ) : (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Crown className="size-4 text-warning" />
              Waiting for the host to start the game…
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="bg-card flex flex-col items-center rounded-xl border p-5">
            <RouletteWheel landed={null} spinning={false} spinCount={0} reducedMotion={reducedMotion} />
            <p className="text-muted-foreground mt-4 text-center text-xs leading-relaxed">
              Seven categories, one challenge each. The wheel lands once per round and locks.
            </p>
          </div>

          <div className="bg-card rounded-xl border p-5">
            <Label className="mb-3">Round format</Label>
            <dl className="space-y-2 text-sm">
              {[
                ['Rounds', '5'],
                ['Time per round', '3:00'],
                ['Scoring', 'Correctness 50 · Tests 30 · Perf 10 · Time 10'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground text-xs uppercase">{k}</dt>
                  <dd className="text-right font-mono text-xs">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-card rounded-xl border p-5">
            <Label htmlFor="guest-name" className="mb-3">
              <UserPlus className="size-3.5" />
              Add a player
            </Label>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const name = guestName.trim()
                if (!name) return
                onAddPlayer(name)
                setGuestName('')
              }}
            >
              <Input
                id="guest-name"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="Teammate name"
                maxLength={24}
              />
              <Button type="submit" variant="secondary" disabled={!guestName.trim()}>
                Add
              </Button>
            </form>
            <p className="text-muted-foreground mt-3 text-[0.7rem] leading-relaxed">
              Stands in for a second browser on the same join code.
            </p>
          </div>
        </aside>
      </div>

      <CategoryLegend />
    </div>
  )
}

function CategoryLegend() {
  return (
    <div className="mt-12 border-t pt-6">
      <p className="text-muted-foreground text-[0.7rem] tracking-[0.16em] uppercase">
        What the wheel can land on
      </p>
      <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((category) => (
          <li key={category.id} className="flex items-start gap-2.5">
            <span
              className={cn('mt-1.5 size-2 shrink-0 rounded-full')}
              style={{ backgroundColor: category.accent }}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="text-sm font-medium">{category.label}</span>
              <span className="text-muted-foreground block text-xs">{category.blurb}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
