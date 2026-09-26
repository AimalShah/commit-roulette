import { Loader2, RotateCcw, Send, Terminal, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { PlayerChip, statusMeta } from '@/components/player-chip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCountdown } from '@/hooks/use-countdown'
import { ChallengeBrief } from '@/game/challenge-brief'
import { CodeEditor } from '@/game/code-editor'
import { CountdownRing } from '@/game/countdown-ring'
import { ScoreBreakdown, TestResults } from '@/game/score-breakdown'
import { buildRoundScore } from '@/game/simulate'
import { cn } from '@/lib/cn'
import { testPoints } from '@commit-roulette/shared/scoring'
import { initials, plural } from '@commit-roulette/shared/format'
import type { Challenge, Player, PlayerStatus, RoundScore, Submission } from '@commit-roulette/shared/types'

export function ChallengeStage({
  challenge,
  players,
  statuses,
  endsAt,
  totalMs,
  round,
  locked,
  submission,
  onSubmit,
}: {
  challenge: Challenge
  players: Player[]
  statuses: Record<string, PlayerStatus>
  endsAt: number | null
  totalMs: number
  round: number
  locked: boolean
  submission: Submission | null
  onSubmit: (code: string) => void
}) {
  const [code, setCode] = useState(challenge.starterCode)
  const [mobileTab, setMobileTab] = useState('editor')
  const { remainingMs, progress, expired } = useCountdown(endsAt, totalMs)

  // Each round loads a new challenge — reset the buffer to its starter code.
  useEffect(() => {
    setCode(challenge.starterCode)
  }, [challenge])

  const changed = code.trim() !== challenge.starterCode.trim()

  const yourScore = useMemo(
    () =>
      submission
        ? buildRoundScore({
            playerId: submission.playerId,
            challenge,
            round,
            results: submission.results,
            elapsedMs: submission.elapsedMs,
            totalMs,
          })
        : null,
    [challenge, round, submission, totalMs],
  )

  const committedCount = players.filter((p) =>
    ['committed', 'scored', 'timeout'].includes(statuses[p.id] ?? 'idle'),
  ).length

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] w-full flex-col">
      {/* ---- top bar: clock + live room ---- */}
      <div className="border-border bg-card/40 flex h-14 shrink-0 items-center gap-3 border-b px-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.16em] uppercase">
            Round {round} · {plural(challenge.tests.length, 'test')}
          </p>
          <p className="truncate text-sm font-medium">{challenge.title}</p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex -space-x-2">
              {players.map((player) => (
                <Avatar
                  key={player.id}
                  className={cn(
                    'ring-background size-7 ring-2',
                    statuses[player.id] === 'coding' && 'ring-primary',
                    statuses[player.id] === 'scored' && 'ring-success',
                    statuses[player.id] === 'timeout' && 'ring-destructive',
                  )}
                  title={`${player.name} — ${statusMeta(statuses[player.id] ?? 'idle').label}`}
                >
                  <AvatarFallback>{initials(player.name)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[0.7rem]">
              <Users className="size-3" />
              {committedCount}/{players.length} locked in
            </span>
          </div>

          <Separator orientation="vertical" className="hidden h-6 sm:block" />
          <CountdownRing remainingMs={remainingMs} totalMs={totalMs} />
        </div>
      </div>

      {/* clock burn-down */}
      <div
        className={cn(
          'h-0.5 shrink-0 transition-colors',
          remainingMs <= 10_000 ? 'bg-destructive' : remainingMs <= 30_000 ? 'bg-warning' : 'bg-primary',
        )}
        style={{ width: `${Math.max(0, 100 - progress * 100)}%` }}
        aria-hidden="true"
      />

      <Tabs value={mobileTab} onValueChange={setMobileTab} className="flex min-h-0 flex-1 flex-col">
        <div className="border-border flex shrink-0 items-center border-b px-4 py-2 lg:hidden">
          <TabsList className="w-full">
            <TabsTrigger value="editor">Code</TabsTrigger>
            <TabsTrigger value="brief">Brief</TabsTrigger>
            <TabsTrigger value="room">Room</TabsTrigger>
          </TabsList>
        </div>

        <div className="grid min-h-0 min-w-0 flex-1 lg:grid-cols-[24rem_1fr] xl:grid-cols-[27rem_1fr]">
          {/* ---------- brief ---------- */}
          <aside
            className={cn(
              'min-h-0 min-w-0 flex-col border-border border-r',
              mobileTab === 'brief' ? 'flex' : 'hidden lg:flex',
            )}
          >
            <ChallengeBrief challenge={challenge} className="min-h-0 flex-1" />
          </aside>

          {/* ---------- editor / results ---------- */}
          <section
            className={cn(
              'min-h-0 min-w-0 flex-col',
              mobileTab === 'editor' || mobileTab === 'room' ? 'flex' : 'hidden lg:flex',
            )}
          >
            {submission || locked ? (
              <SubmissionPanel
                submission={submission}
                yourScore={yourScore}
                players={players}
                statuses={statuses}
                showRoom={mobileTab === 'room'}
              />
            ) : (
              <>
                <div className="border-border bg-card/40 flex h-10 shrink-0 items-center gap-2 border-b px-4">
                  <Terminal className="text-muted-foreground size-3.5" />
                  <span className="text-muted-foreground font-mono text-[0.7rem]">
                    solution.{challenge.language === 'python' ? 'py' : 'js'}
                  </span>
                  <span className="text-muted-foreground/70 ml-auto text-[0.68rem]">
                    {changed ? 'edited' : 'starter code — make a change to score'}
                  </span>
                </div>

                <div className="min-h-0 flex-1">
                  <CodeEditor
                    value={code}
                    onChange={setCode}
                    language={challenge.language}
                    readOnly={expired}
                  />
                </div>

                <div className="border-border bg-card/40 flex shrink-0 flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center">
                  <div className="text-muted-foreground min-w-0 flex-1 text-[0.72rem]">
                    {expired
                      ? "Time's up — the round is closing."
                      : changed
                        ? 'Runs against the fixed suite in a sandbox. Partial credit for passing tests.'
                        : 'Unmodified starter code fails the suite. Make a change, then submit.'}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCode(challenge.starterCode)}
                      disabled={!changed}
                    >
                      <RotateCcw />
                      Reset
                    </Button>
                    <Button onClick={() => onSubmit(code)} disabled={expired}>
                      <Send />
                      Submit
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </Tabs>
    </div>
  )
}

function SubmissionPanel({
  submission,
  yourScore,
  players,
  statuses,
  showRoom,
}: {
  submission: Submission | null
  yourScore: RoundScore | null
  players: Player[]
  statuses: Record<string, PlayerStatus>
  showRoom: boolean
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid gap-0 lg:grid-cols-2">
        <div className="border-border p-5 lg:border-r">
          {submission && yourScore ? (
            <>
              <h3 className="text-xs font-medium tracking-[0.12em] uppercase">
                Your submission
              </h3>
              <div className="mt-4">
                <ScoreBreakdown
                  correctness={yourScore.correctness}
                  tests={testPoints(yourScore.testsPassed, yourScore.testsTotal)}
                  performance={yourScore.performance}
                  speed={yourScore.speed}
                  total={yourScore.score}
                />
              </div>
              <Separator className="my-5" />
              <TestResults results={submission.results} />
              <p className="text-muted-foreground mt-5 text-[0.72rem] leading-relaxed">
                Locked in. The room settles as soon as everyone has submitted or the clock runs out.
              </p>
            </>
          ) : (
            <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="text-primary size-6 animate-spin" />
              <p className="text-sm font-medium">Running the suite</p>
              <p className="text-muted-foreground max-w-[16rem] text-xs leading-relaxed">
                Your code is executing in the sandbox. Results land in a moment.
              </p>
            </div>
          )}
        </div>

        <div className={cn('p-5', showRoom ? 'block' : 'hidden lg:block')}>
          <h3 className="text-muted-foreground text-xs font-medium tracking-[0.12em] uppercase">
            Room status
          </h3>
          <div className="mt-4 space-y-2">
            {players.map((player) => (
              <PlayerChip
                key={player.id}
                player={player}
                status={statuses[player.id] ?? 'idle'}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
