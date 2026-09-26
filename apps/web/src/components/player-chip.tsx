import { Crown, Loader2, Radio, Check, X, Code2 } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/cn'
import { initials } from '@commit-roulette/shared/format'
import type { Player, PlayerStatus } from '@commit-roulette/shared/types'

const STATUS_META: Record<PlayerStatus, { label: string; icon: typeof Code2; className: string }> = {
  idle: { label: 'Ready', icon: Radio, className: 'text-muted-foreground' },
  coding: { label: 'Coding', icon: Code2, className: 'text-primary' },
  committed: { label: 'Running', icon: Loader2, className: 'text-warning' },
  scored: { label: 'Committed', icon: Check, className: 'text-success' },
  timeout: { label: 'No submit', icon: X, className: 'text-destructive' },
}

export function statusMeta(status: PlayerStatus) {
  return STATUS_META[status] ?? STATUS_META.idle
}

export function PlayerChip({
  player,
  status,
  score,
  className,
}: {
  player: Player
  status: PlayerStatus
  score?: number
  className?: string
}) {
  const meta = statusMeta(status)
  const Icon = meta.icon

  return (
    <div
      className={cn(
        'bg-card flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors',
        player.isYou && 'border-primary/40 bg-primary/[0.06]',
        className,
      )}
    >
      <div className="relative">
        <Avatar className="size-7">
          <AvatarFallback
            className={cn(
              player.isYou && 'bg-primary/20 text-primary',
            )}
          >
            {initials(player.name)}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            'absolute -right-0.5 -bottom-0.5 grid size-3.5 place-items-center rounded-full border border-card',
            status === 'coding' && 'bg-primary/20',
            status === 'committed' && 'bg-warning/20',
            status === 'scored' && 'bg-success/20',
            status === 'timeout' && 'bg-destructive/20',
            status === 'idle' && 'bg-muted',
          )}
        >
          <Icon className={cn('size-2.5', meta.className, status === 'committed' && 'animate-spin')} />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1 truncate text-[0.82rem] leading-tight font-medium">
          {player.name}
          {player.isHost && <Crown className="size-3 shrink-0 text-warning" aria-label="Host" />}
          {player.isYou && <span className="text-muted-foreground text-[0.7rem]">(you)</span>}
        </span>
        <span className={cn('truncate text-[0.68rem] leading-tight', meta.className)}>{meta.label}</span>
      </div>

      {score !== undefined && (
        <span className="tnum shrink-0 font-mono text-sm font-semibold">{score}</span>
      )}
    </div>
  )
}
