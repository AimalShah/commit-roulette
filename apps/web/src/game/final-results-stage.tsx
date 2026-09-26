import { Award, Crown, Medal, RotateCcw, Share2, Trophy } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { CategoryChip } from '@/components/category-chip'
import { RoundHistoryStrip } from '@/game/score-table'
import { CHALLENGE_MAP } from '@commit-roulette/shared/challenges'
import { cn } from '@/lib/cn'
import { initials, plural } from '@commit-roulette/shared/format'
import { finalStandings } from '@/game/simulate'
import type { HistoryEntry, Player } from '@commit-roulette/shared/types'

export function FinalResultsStage({
  players,
  history,
  onPlayAgain,
  onBackToDashboard,
}: {
  players: Player[]
  history: HistoryEntry[]
  onPlayAgain: () => void
  onBackToDashboard: () => void
}) {
  const standings = finalStandings(players)
  const [first, second, third] = standings
  const rounds = history.length

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="text-center">
        <Trophy className="text-primary mx-auto size-8" />
        <span className="text-muted-foreground mt-4 block font-mono text-xs tracking-[0.2em] uppercase">
          Game over · {plural(rounds, 'round')} played
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          {first ? `${first.name} wins the room` : 'No winner'}
        </h1>
        {first && (
          <p className="text-muted-foreground mt-3 font-mono text-sm">
            {first.total} {plural(first.total, 'point')} across {plural(rounds, 'round')}
          </p>
        )}
      </div>

      {/* podium */}
      <div className="mt-12 grid items-end gap-3 sm:grid-cols-3">
        <Podium place={2} player={second} />
        <Podium place={1} player={first} />
        <Podium place={3} player={third} />
      </div>

      {/* full table */}
      <div className="mt-10 overflow-hidden rounded-xl border">
        <div className="bg-card/50 border-border text-muted-foreground grid grid-cols-[2.5rem_1fr_5rem] items-center gap-2 border-b px-4 py-2 text-[0.62rem] tracking-[0.14em] uppercase">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Total</span>
        </div>
        <ul>
          {standings.map((player, index) => (
            <li
              key={player.id}
              className={cn(
                'grid grid-cols-[2.5rem_1fr_5rem] items-center gap-2 border-b px-4 py-3 last:border-b-0',
                index % 2 === 1 && 'bg-secondary/20',
                player.isYou && 'bg-primary/[0.07]',
              )}
            >
              <span className="tnum text-muted-foreground font-mono text-sm">{index + 1}</span>
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar className="size-7">
                  <AvatarFallback>{initials(player.name)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {player.name}
                    {player.isYou && <span className="text-muted-foreground text-[0.7rem]"> (you)</span>}
                  </span>
                  <span className="text-muted-foreground block truncate text-[0.68rem]">
                    {player.rounds.filter((r) => r.correctness > 0).length} of{' '}
                    {player.rounds.length} solved
                  </span>
                </span>
              </span>
              <span className="tnum text-right font-mono text-sm font-semibold">{player.total}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* round by round */}
      <section className="mt-10">
        <h2 className="text-muted-foreground text-[0.7rem] tracking-[0.16em] uppercase">
          Round by round
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {history.map((entry) => {
            const challenge = CHALLENGE_MAP[entry.challengeId]
            return (
              <div
                key={entry.round}
                className="bg-card flex items-center gap-2.5 rounded-lg border px-3 py-2"
              >
                <span className="text-muted-foreground font-mono text-[0.7rem]">R{entry.round}</span>
                <CategoryChip category={entry.category} size="sm" />
                <span className="max-w-[14rem] truncate text-xs">{challenge?.title ?? '—'}</span>
              </div>
            )
          })}
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border">
          <RoundHistoryStrip players={standings} />
        </div>
      </section>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button size="lg" onClick={onPlayAgain} className="w-full sm:w-auto">
          <RotateCcw />
          Play again
        </Button>
        <Button variant="outline" size="lg" onClick={onBackToDashboard} className="w-full sm:w-auto">
          Back to dashboard
        </Button>
        <Button variant="ghost" size="lg" className="text-muted-foreground">
          <Share2 />
          Share result
        </Button>
      </div>
    </div>
  )
}

function Podium({ place, player }: { place: 1 | 2 | 3; player?: Player }) {
  if (!player) {
    return <div className="h-24 rounded-xl border border-dashed" />
  }

  const heights = { 1: 'h-32', 2: 'h-24', 3: 'h-20' } as const
  const icon = { 1: Crown, 2: Medal, 3: Award } as const
  const Icon = icon[place]

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-end rounded-xl border p-4',
        place === 1 ? 'border-primary/40 bg-primary/[0.07]' : 'bg-card',
      )}
    >
      <Icon className={cn('size-5', place === 1 ? 'text-primary' : 'text-muted-foreground')} />
      <Avatar className="mt-3 size-11">
        <AvatarFallback className="text-xs">{initials(player.name)}</AvatarFallback>
      </Avatar>
      <p className="mt-2.5 w-full truncate text-center text-sm font-medium">{player.name}</p>
      <p className="tnum font-mono text-lg font-semibold">{player.total}</p>
      <div
        className={cn(
          'text-muted-foreground/60 mt-3 w-full rounded-t-md border-t pt-2 text-center font-mono text-[0.65rem] tracking-[0.16em] uppercase',
          heights[place],
        )}
      >
        {place === 1 ? 'Winner' : place === 2 ? 'Runner up' : 'Third'}
      </div>
    </div>
  )
}
