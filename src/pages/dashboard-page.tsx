import { ArrowRight, Check, Copy, Crown, Hash, Play, Plus, Trophy, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { CategoryChip } from '@/components/category-chip'
import { SiteHeader } from '@/components/site-header'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { CATEGORY_MAP } from '@/lib/challenges'
import { cn } from '@/lib/cn'
import { initials, ordinal, plural, relativeTime } from '@/lib/format'
import { generateJoinCode, isValidJoinCode, normaliseJoinCode } from '@/lib/join-code'
import { currentUser } from '@/mock/session'
import { PLAYER_STATS, RECENT_GAMES } from '@/mock/recent-games'
import type { Category } from '@/lib/types'

export function DashboardPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [newCode, setNewCode] = useState(() => generateJoinCode())
  const [copied, setCopied] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const join = (event: React.FormEvent) => {
    event.preventDefault()
    const value = normaliseJoinCode(code)
    if (!isValidJoinCode(value)) {
      setJoinError('Room codes are six letters and numbers.')
      return
    }
    setJoinError(null)
    navigate(`/room/${value}`)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(newCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const solveRate = Math.round((PLAYER_STATS.solved / PLAYER_STATS.attempts) * 100)

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader showAuth={false} />

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* greeting */}
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="size-12">
            <AvatarFallback className="bg-primary/15 text-primary text-sm">
              {initials(currentUser.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              Hey {currentUser.name.split(' ')[0]}
            </h1>
            <p className="text-muted-foreground text-sm">
              {PLAYER_STATS.gamesPlayed} {plural(PLAYER_STATS.gamesPlayed, 'game')} played ·{' '}
              {PLAYER_STATS.roundsWon} {plural(PLAYER_STATS.roundsWon, 'round')} won
            </p>
          </div>
          <Badge variant="primary" className="ml-auto">
            <Crown className="size-3" />
            {currentUser.plan}
          </Badge>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          {/* ---------- create ---------- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="text-primary size-4" />
                Create a room
              </CardTitle>
              <CardDescription>
                You host, you control the round flow. Share the code and the game starts when you say
                so.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="bg-secondary/50 flex items-center gap-4 rounded-lg border p-4">
                <Hash className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-[0.62rem] tracking-[0.14em] uppercase">
                    Join code
                  </p>
                  <p className="font-mono text-2xl font-semibold tracking-[0.22em]">{newCode}</p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copy}
                  aria-label="Copy join code"
                >
                  {copied ? <Check className="text-success" /> : <Copy />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setNewCode(generateJoinCode())}
                  aria-label="New code"
                >
                  <ArrowRight />
                </Button>
              </div>

              <Button asChild size="lg" className="w-full">
                <Link to={`/room/${newCode}`}>
                  <Play />
                  Create and enter
                </Link>
              </Button>

              <p className="text-muted-foreground text-[0.72rem] leading-relaxed">
                Rooms hold up to six players and run five rounds of three minutes each.
              </p>
            </CardContent>
          </Card>

          {/* ---------- join ---------- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="text-primary size-4" />
                Join a room
              </CardTitle>
              <CardDescription>
                Got a code from a friend? Drop it in. No account needed to join.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={join} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="join-code">Room code</Label>
                  <Input
                    id="join-code"
                    value={code}
                    onChange={(event) => {
                      setCode(normaliseJoinCode(event.target.value))
                      setJoinError(null)
                    }}
                    placeholder="K7X2QM"
                    maxLength={6}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={Boolean(joinError)}
                    className="h-12 text-center font-mono text-lg tracking-[0.3em] uppercase"
                  />
                  {joinError && (
                    <p role="alert" className="text-destructive text-xs">
                      {joinError}
                    </p>
                  )}
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={!code}>
                  Join room
                  <ArrowRight />
                </Button>
              </form>

              <Separator className="my-6" />

              <div className="space-y-2">
                <p className="text-muted-foreground text-[0.62rem] tracking-[0.14em] uppercase">
                  Solo? Try a room
                </p>
                <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                  <Link to="/room/K7X2QM" className="font-mono">
                    /room/K7X2QM
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---------- stats ---------- */}
        <section className="mt-10">
          <h2 className="text-muted-foreground text-[0.7rem] tracking-[0.16em] uppercase">
            Your form
          </h2>
          <div className="mt-4 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Best game score', value: PLAYER_STATS.bestScore, mono: true },
              { label: 'Rounds won', value: PLAYER_STATS.roundsWon, mono: true },
              { label: 'Rounds solved', value: `${PLAYER_STATS.solved}/${PLAYER_STATS.attempts}`, mono: true },
              { label: 'Favourite wedge', value: PLAYER_STATS.favouriteCategory },
            ].map((stat) => (
              <div key={stat.label} className="bg-card p-5">
                <p className="text-muted-foreground text-[0.68rem] tracking-wide uppercase">
                  {stat.label}
                </p>
                <p
                  className={cn(
                    'mt-2 text-2xl font-semibold tracking-tight',
                    stat.mono && 'tnum font-mono',
                  )}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-card mt-px flex flex-wrap items-center gap-4 rounded-b-xl border p-5">
            <div className="min-w-[12rem] flex-1">
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground text-[0.68rem] tracking-wide uppercase">
                  Solve rate
                </span>
                <span className="tnum font-mono text-sm font-semibold">{solveRate}%</span>
              </div>
              <Progress value={solveRate} className="mt-2" />
            </div>
            <p className="text-muted-foreground text-[0.72rem]">
              Solved means the full suite went green. Partial passes still score.
            </p>
          </div>
        </section>

        {/* ---------- recent ---------- */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-muted-foreground text-[0.7rem] tracking-[0.16em] uppercase">
              Recent games
            </h2>
            <span className="text-muted-foreground font-mono text-xs">
              {RECENT_GAMES.length} shown
            </span>
          </div>

          <ul className="mt-4 space-y-2">
            {RECENT_GAMES.map((game) => (
              <li key={game.id}>
                <Link
                  to={`/room/${game.code}`}
                  className="group bg-card flex flex-wrap items-center gap-4 rounded-xl border p-4 transition-colors hover:border-muted-foreground/40"
                >
                  <span className="bg-secondary/60 group-hover:bg-primary/15 grid size-10 shrink-0 place-items-center rounded-lg font-mono text-xs font-semibold tracking-wider transition-colors">
                    {game.code.slice(0, 3)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold tracking-[0.16em]">
                        {game.code}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs',
                          game.position === 1 ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {game.position === 1 && <Trophy className="size-3" />}
                        {ordinal(game.position)} · {plural(game.players, 'player')}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {game.categories.map((category, i) => (
                        <CategoryChip
                          key={`${category}-${i}`}
                          category={category as Category}
                          size="sm"
                          className="opacity-80"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="tnum font-mono text-lg font-semibold">{game.score}</p>
                    <p className="text-muted-foreground text-[0.7rem]">
                      {game.rounds} {plural(game.rounds, 'round')} ·{' '}
                      {relativeTime(game.startedAt)}
                    </p>
                  </div>

                  <ArrowRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-muted-foreground mt-10 text-center text-[0.72rem]">
          Best room so far:{' '}
          <span className="text-foreground font-mono">
            {CATEGORY_MAP['bug-fix'].label} rounds on the{' '}
            {RECENT_GAMES[0]?.categories.length} wedges you have played.
          </span>
        </p>
      </main>
    </div>
  )
}
