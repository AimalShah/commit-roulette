import { Check, Copy, LogOut, Radio, Wifi } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Wordmark } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/cn'
import type { RoomPhase } from '@/lib/types'

const PHASE_LABEL: Record<RoomPhase, string> = {
  lobby: 'Lobby',
  spinning: 'Spinning',
  challenge: 'Coding',
  waiting: 'Running tests',
  'round-results': 'Round results',
  'final-results': 'Final results',
}

function JoinCodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="group border-border bg-secondary/60 hover:border-primary/50 flex h-8 items-center gap-2 rounded-md border px-2.5 transition-colors"
      aria-label={`Copy room code ${code}`}
    >
      <span className="text-muted-foreground text-[0.6rem] tracking-[0.12em] uppercase">Room</span>
      <span className="font-mono text-sm font-semibold tracking-[0.18em]">{code}</span>
      {copied ? (
        <Check className="text-success size-3.5" />
      ) : (
        <Copy className="text-muted-foreground size-3.5 group-hover:text-foreground" />
      )}
    </button>
  )
}

function RoundPips({ round, total, done }: { round: number; total: number; done: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Round ${round} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const index = i + 1
        const state = index < round ? 'done' : index === round ? 'active' : 'pending'
        return (
          <span
            key={index}
            className={cn(
              'h-1.5 w-5 rounded-full transition-colors',
              state === 'done' && 'bg-primary/50',
              state === 'active' && 'bg-primary',
              state === 'pending' && 'bg-muted',
            )}
            title={`Round ${index}`}
          />
        )
      })}
      <span className="text-muted-foreground ml-1 font-mono text-[0.7rem]">
        {done}/{total}
      </span>
    </div>
  )
}

export function RoomHeader({
  code,
  phase,
  round,
  totalRounds,
  doneRounds,
  connected = true,
}: {
  code: string
  phase: RoomPhase
  round: number
  totalRounds: number
  doneRounds: number
  connected?: boolean
}) {
  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[110rem] items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="shrink-0" aria-label="Commit Roulette home">
          <Wordmark className="hidden sm:flex" />
          <Wordmark className="sm:hidden [&>span:last-child]:hidden" />
        </Link>

        <Separator orientation="vertical" className="hidden h-6 sm:block" />

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <JoinCodeChip code={code} />
          {phase !== 'lobby' && <RoundPips round={round} total={totalRounds} done={doneRounds} />}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'hidden items-center gap-1.5 rounded-md border px-2 py-1 text-[0.68rem] font-medium tracking-wide uppercase sm:inline-flex',
              connected ? 'border-success/30 text-success' : 'border-warning/30 text-warning',
            )}
          >
            {connected ? <Wifi className="size-3" /> : <Radio className="size-3 animate-tick" />}
            {connected ? 'Live' : 'Reconnecting'}
          </span>

          <span className="text-muted-foreground hidden font-mono text-xs md:inline">
            {PHASE_LABEL[phase]}
          </span>

          <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
            <Link to="/dashboard" aria-label="Leave room">
              <LogOut />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
