import { Crown, Minus, Timer } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/cn'
import { formatClock, formatElapsed, initials } from '@commit-roulette/shared/format'
import type { Challenge, Player, PlayerStatus, RoundScore } from '@commit-roulette/shared/types'
import { statusMeta } from '@/components/player-chip'

const MEDALS = ['text-primary', 'text-foreground/80', 'text-warning']

/** Ranked board for a single round. */
export function RoundScoreTable({
  scores,
  players,
  challenge,
  statuses,
  highlightId,
  className,
}: {
  scores: RoundScore[]
  players: Player[]
  challenge: Challenge | null
  statuses: Record<string, PlayerStatus>
  highlightId?: string
  className?: string
}) {
  const rows = scores.map((score) => ({
    score,
    player: players.find((p) => p.id === score.playerId) ?? null,
  }))
  const top = rows[0]?.score.score ?? 0

  return (
    <div className={cn('overflow-hidden rounded-xl border', className)}>
      <div className="bg-card/50 border-border grid grid-cols-[2.25rem_1fr_5.5rem_4.5rem_4rem] items-center gap-2 border-b px-3 py-2 text-[0.62rem] tracking-[0.14em] uppercase sm:grid-cols-[2.5rem_1fr_8rem_6rem_5rem] sm:px-4">
        <span>#</span>
        <span>Player</span>
        <span className="hidden sm:block">Tests</span>
        <span className="text-right">Time</span>
        <span className="text-right">Score</span>
      </div>

      <ul>
        {rows.map(({ score, player }, index) => {
          return (
            <li
              key={score.playerId}
              className={cn(
                'grid grid-cols-[2.25rem_1fr_5.5rem_4.5rem_4rem] items-center gap-2 border-b px-3 py-2.5 last:border-b-0 sm:grid-cols-[2.5rem_1fr_8rem_6rem_5rem] sm:px-4',
                index % 2 === 1 && 'bg-secondary/20',
                player?.isYou && 'bg-primary/[0.07]',
                highlightId && player?.id === highlightId && 'ring-primary/40 ring-1 ring-inset',
              )}
            >
              <span
                className={cn(
                  'tnum font-mono text-sm font-semibold',
                  index === 0 ? MEDALS[0] : index === 1 ? MEDALS[1] : index === 2 ? MEDALS[2] : 'text-muted-foreground',
                )}
              >
                {index + 1}
              </span>

              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar className="size-7">
                  <AvatarFallback>{player ? initials(player.name) : '?'}</AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {player?.name ?? 'Unknown'}
                    {player?.isYou && <span className="text-muted-foreground text-[0.7rem]">(you)</span>}
                    {index === 0 && <Crown className="size-3.5 shrink-0 text-primary" />}
                  </span>
                  <span className="text-muted-foreground block truncate text-[0.68rem]">
                    {statuses[player?.id ?? '']
                      ? statusMeta(statuses[player?.id ?? ''] ?? 'idle').label
                      : challenge
                        ? challenge.title
                        : '—'}
                  </span>
                </span>
              </span>

              <span className="hidden items-center gap-1.5 sm:flex">
                <span className="tnum font-mono text-xs">
                  {score.testsPassed}/{score.testsTotal}
                </span>
                {score.correctness > 0 ? (
                  <span className="text-success text-[0.65rem]">green</span>
                ) : (
                  <span className="text-destructive text-[0.65rem]">failing</span>
                )}
              </span>

              <span className="text-muted-foreground tnum text-right font-mono text-xs">
                {score.elapsedMs >= 180_000 ? <Minus className="ml-auto size-3" /> : formatClock(score.elapsedMs)}
              </span>

              <span className="text-right">
                <span className="tnum font-mono text-sm font-semibold">{score.score}</span>
                {top > 0 && (
                  <span className="text-muted-foreground/70 ml-1 hidden font-mono text-[0.6rem] lg:inline">
                    {Math.round((score.score / top) * 100)}%
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Compact score history for the final board. */
export function RoundHistoryStrip({
  players,
  className,
}: {
  players: Player[]
  className?: string
}) {
  const rounds = Math.max(0, ...players.map((p) => p.rounds.length))

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[30rem] border-collapse text-sm">
        <thead>
          <tr className="text-muted-foreground text-[0.62rem] tracking-[0.14em] uppercase">
            <th className="px-3 py-2 text-left font-medium">Player</th>
            {Array.from({ length: rounds }, (_, i) => (
              <th key={i} className="px-2 py-2 text-center font-medium">
                R{i + 1}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id} className="border-border/70 border-t">
              <td className="flex items-center gap-2 px-3 py-2">
                <Avatar className="size-6">
                  <AvatarFallback>{initials(player.name)}</AvatarFallback>
                </Avatar>
                <span className="truncate text-[0.82rem] font-medium">
                  {player.name}
                  {player.isYou && <span className="text-muted-foreground text-[0.7rem]"> (you)</span>}
                </span>
              </td>
              {Array.from({ length: rounds }, (_, i) => {
                const entry = player.rounds[i]
                return (
                  <td key={i} className="px-2 py-2 text-center">
                    {entry ? (
                      <span
                        className={cn(
                          'tnum inline-block min-w-[2.1rem] rounded px-1.5 py-0.5 font-mono text-xs',
                          entry.correctness > 0
                            ? 'bg-primary/15 text-primary'
                            : 'bg-destructive/10 text-destructive/80',
                        )}
                      >
                        {entry.score}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 text-xs">—</span>
                    )}
                  </td>
                )
              })}
              <td className="tnum px-3 py-2 text-right font-mono text-sm font-semibold">
                {player.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ElapsedPill({ ms }: { ms: number }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 font-mono text-xs">
      <Timer className="size-3" />
      {formatElapsed(ms)}
    </span>
  )
}
