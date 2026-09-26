import { ArrowRight, Flag, Trophy } from 'lucide-react'

import { CategoryChip } from '@/components/category-chip'
import { Button } from '@/components/ui/button'
import { RoundScoreTable } from '@/game/score-table'
import { cn } from '@/lib/cn'
import { ordinal, plural } from '@commit-roulette/shared/format'
import type { Challenge, Player, PlayerStatus, RoundScore } from '@commit-roulette/shared/types'

export function RoundResultsStage({
  round,
  totalRounds,
  challenge,
  scores,
  players,
  statuses,
  isHost,
  onNextRound,
  onEndGame,
}: {
  round: number
  totalRounds: number
  challenge: Challenge | null
  scores: RoundScore[]
  players: Player[]
  statuses: Record<string, PlayerStatus>
  isHost: boolean
  onNextRound: () => void
  onEndGame: () => void
}) {
  const leader = scores[0]
  const leaderPlayer = players.find((p) => p.id === leader?.playerId)
  const isLast = round >= totalRounds

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="text-center">
        <span className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
          Round {round} of {totalRounds}
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {leader ? `${leaderPlayer?.name ?? 'Nobody'} takes the round` : 'No scores this round'}
        </h1>
        {challenge && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <CategoryChip category={challenge.category} />
            <span className="text-muted-foreground text-sm">{challenge.title}</span>
          </div>
        )}
      </div>

      <RoundScoreTable
        scores={scores}
        players={players}
        challenge={challenge}
        statuses={statuses}
        className="mt-10"
      />

      <div className="mt-8 flex flex-col items-center gap-3">
        {isHost ? (
          <>
            <Button size="lg" onClick={onNextRound} className="w-full sm:w-auto">
              {isLast ? <Trophy /> : <ArrowRight />}
              {isLast ? 'See final standings' : `Spin round ${round + 1}`}
            </Button>
            <Button variant="ghost" size="sm" onClick={onEndGame} className="text-muted-foreground">
              <Flag />
              End game now
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Waiting for the host to spin {ordinal(round + 1)}…
          </p>
        )}
      </div>

      <ScoringLegend className="mt-12" />
    </div>
  )
}

/** FR8, spelled out once so nobody has to guess how the number was made. */
export function ScoringLegend({ className }: { className?: string }) {
  const rows = [
    { label: 'Correctness', points: 50, note: 'Full suite green' },
    { label: 'Tests passed', points: 30, note: 'Partial credit' },
    { label: 'Performance', points: 10, note: 'Runtime against budget' },
    { label: 'Time', points: 10, note: 'Left on the clock' },
  ]

  return (
    <div className={cn('border-t pt-6', className)}>
      <p className="text-muted-foreground text-[0.7rem] tracking-[0.16em] uppercase">
        How the 100 points are split
      </p>
      <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 border-b pb-2">
            <div>
              <dt className="text-sm font-medium">{row.label}</dt>
              <dd className="text-muted-foreground text-[0.7rem]">{row.note}</dd>
            </div>
            <span className="tnum font-mono text-sm font-semibold">{row.points}</span>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground/80 mt-4 text-[0.72rem] leading-relaxed">
        Correctness is all-or-nothing, so a fast broken submission can never outscore a slow correct
        one. 2–6 {plural(1, 'player')} per room, {plural(5, 'round')} per game.
      </p>
    </div>
  )
}
