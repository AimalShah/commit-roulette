import { ArrowRight, Boxes, Code2, Dices, Gauge, Play, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Logo, Wordmark } from '@/components/brand'
import { CategoryChip } from '@/components/category-chip'
import { SiteHeader } from '@/components/site-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CHALLENGES } from '@/lib/challenges'
import { cn } from '@/lib/cn'
import { formatClock } from '@/lib/format'

const STEPS = [
  {
    n: '01',
    icon: Users,
    title: 'Create a room',
    body: 'Sign in, create a room, share the six-character code. Everyone joins from the same link — no installs, no accounts for spectators.',
  },
  {
    n: '02',
    icon: Dices,
    title: 'Spin the wheel',
    body: 'The roulette lands on one of seven categories and locks. Every player in the room gets the identical challenge for that round.',
  },
  {
    n: '03',
    icon: Code2,
    title: 'Race the clock',
    body: 'Three minutes, a real starter repo, and the same test suite for everyone. Commit early or hold your solution back.',
  },
  {
    n: '04',
    icon: Gauge,
    title: 'Watch it score',
    body: 'Submissions run against the fixed suite in a sandbox outside our infrastructure. Results land live, ranked, every round.',
  },
]

const SCORE_ROWS = [
  { label: 'Correctness', points: 50, note: 'All tests green' },
  { label: 'Tests passed', points: 30, note: 'Partial credit' },
  { label: 'Performance', points: 10, note: 'Runtime vs budget' },
  { label: 'Time', points: 10, note: 'Remaining on clock' },
]

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />

      {/* ---------------- hero ---------------- */}
      <section className="relative overflow-hidden border-b">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-70" />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-72"
          style={{
            background:
              'radial-gradient(60% 100% at 50% 0%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 70%)',
          }}
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-6 font-mono">
              <span className="bg-primary mr-1.5 inline-block size-1.5 animate-tick rounded-full" />
              Multiplayer coding challenge
            </Badge>

            <h1 className="text-balance text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
              Real bugs. Real deadlines.
              <br />
              <span className="text-primary">One room, one clock.</span>
            </h1>

            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-balance">
              Commit Roulette turns the software problems developers actually fix on a Tuesday —
              a pagination bug, an N+1, a leaky secret — into a live multiplayer race. Spin the
              wheel, race the timer, ship code that passes.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to="/dashboard">
                  <Play />
                  Create a room
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link to="/dashboard">
                  Join with a code
                  <ArrowRight />
                </Link>
              </Button>
            </div>

            <p className="text-muted-foreground mt-4 font-mono text-xs">
              No credit card · 3-minute rounds · runs in the browser
            </p>
          </div>

          {/* fake editor preview */}
          <div className="mx-auto mt-16 max-w-4xl">
            <PreviewPanel />
          </div>
        </div>
      </section>

      {/* ---------------- how it works ---------------- */}
      <section id="how" className="border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading
            eyebrow="The loop"
            title="Four steps, about four minutes"
            body="A judge can watch a full round — spin, code, submit, results — start to finish without reading a word of documentation."
          />

          <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n} className="bg-card flex flex-col p-6">
                <div className="flex items-center justify-between">
                  <step.icon className="text-primary size-5" />
                  <span className="text-muted-foreground font-mono text-xs">{step.n}</span>
                </div>
                <h3 className="mt-5 text-[0.95rem] font-semibold tracking-tight">{step.title}</h3>
                <p className="text-muted-foreground mt-2 text-[0.85rem] leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- categories ---------------- */}
      <section id="categories" className="border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading
            eyebrow="The wheel"
            title="Seven categories, all of them real work"
            body="No algorithm trivia. Every wedge is a ticket someone has actually shipped — and every round runs the same challenge for every player in the room."
          />

          <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CHALLENGES.map((challenge) => (
              <li
                key={challenge.id}
                className="group bg-card flex flex-col rounded-xl border p-5 transition-colors hover:border-muted-foreground/40"
              >
                <CategoryChip category={challenge.category} />
                <h3 className="mt-4 text-[0.95rem] leading-snug font-semibold tracking-tight text-balance">
                  {challenge.title}
                </h3>
                <p className="text-muted-foreground mt-2 flex-1 text-[0.85rem] leading-relaxed">
                  {challenge.tagline}
                </p>
                <div className="text-muted-foreground mt-4 flex items-center gap-3 font-mono text-[0.7rem]">
                  <span>{challenge.tests.length} tests</span>
                  <span aria-hidden="true">·</span>
                  <span>par ~{challenge.parMinutes}m</span>
                  <span aria-hidden="true">·</span>
                  <span>{challenge.language}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------- scoring ---------------- */}
      <section id="scoring" className="border-b">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              eyebrow="Scoring"
              title="Correctness dominates, on purpose"
              body="A fast broken submission must never outscore a slow correct one. Correctness is all-or-nothing, so everything else is a tiebreaker between people who actually solved it."
            />
            <div className="mt-8 flex flex-col gap-2.5">
              {SCORE_ROWS.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center gap-4 rounded-lg border p-3"
                >
                  <span className="w-36 shrink-0 text-sm font-medium">{row.label}</span>
                  <span className="bg-muted relative h-2 flex-1 overflow-hidden rounded-full">
                    <span
                      className="bg-primary absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${(row.points / 50) * 100}%` }}
                    />
                  </span>
                  <span className="text-muted-foreground w-28 shrink-0 text-right text-xs">
                    {row.note}
                  </span>
                  <span className="tnum w-8 shrink-0 text-right font-mono text-sm font-semibold">
                    {row.points}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border p-6">
            <div className="flex items-center gap-2.5">
              <Boxes className="text-primary size-4" />
              <span className="text-xs font-medium tracking-[0.14em] uppercase">
                Round format
              </span>
            </div>
            <dl className="mt-5 space-y-3">
              {[
                ['Rounds per game', '5'],
                ['Time per round', formatClock(3 * 60 * 1000)],
                ['Players per room', '2–6'],
                ['Languages', 'JavaScript · Python'],
                ['Sandbox', 'External, isolated per submission'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b pb-3 last:border-b-0">
                  <dt className="text-muted-foreground text-sm">{k}</dt>
                  <dd className="text-right font-mono text-sm">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ---------------- cta ---------------- */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <div className="bg-grid relative overflow-hidden rounded-2xl border px-6 py-16 text-center">
            <div className="relative">
              <Logo className="mx-auto size-10" />
              <h2 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Spin it once. You&apos;ll be back for round five.
              </h2>
              <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-[0.95rem] leading-relaxed">
                Create a room, send the code to whoever is nearest, and find out who on your team
                actually ships.
              </p>
              <Button asChild size="lg" className="mt-8">
                <Link to="/dashboard">
                  <Play />
                  Start a game
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs sm:flex-row sm:px-6">
          <Wordmark />
          <p>Built for hackathon demos. Code runs in a third-party sandbox, never on our servers.</p>
        </div>
      </footer>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string
  title: string
  body: string
}) {
  return (
    <div className="max-w-2xl">
      <span className="text-primary font-mono text-xs tracking-[0.2em] uppercase">{eyebrow}</span>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h2>
      <p className="text-muted-foreground mt-3 text-[0.95rem] leading-relaxed">{body}</p>
    </div>
  )
}

const PREVIEW_LINES: { indent: number; text: string; accent?: string }[] = [
  { indent: 0, text: '// GET /feed?cursor=<token>&limit=25' },
  { indent: 0, text: 'export function paginate(rows, cursor, limit) {' },
  { indent: 1, text: 'const startIndex = cursor ? findIndex(rows, cursor) : 0' },
  { indent: 1, text: 'const page = rows.slice(startIndex, startIndex + limit)', accent: 'text-destructive' },
  { indent: 1, text: 'return { page, nextCursor: page[page.length - 1] }', accent: 'text-warning' },
  { indent: 0, text: '}' },
  { indent: 0, text: '' },
  { indent: 0, text: '// ✗ the first row of every page after the first is missing' },
]

function PreviewPanel() {
  return (
    <div className="bg-card overflow-hidden rounded-xl border shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
      <div className="border-border bg-card/50 flex items-center gap-2 border-b px-4 py-2.5">
        <span className="bg-destructive/70 size-2.5 rounded-full" />
        <span className="bg-warning/70 size-2.5 rounded-full" />
        <span className="bg-success/70 size-2.5 rounded-full" />
        <span className="text-muted-foreground ml-2 font-mono text-[0.7rem]">solution.js</span>
        <span className="text-muted-foreground/70 ml-auto font-mono text-[0.65rem]">
          02:14 left
        </span>
      </div>

      <div className="grid sm:grid-cols-[1fr_15rem]">
        <div className="border-border p-4 font-mono text-[0.72rem] leading-relaxed sm:border-r">
          {PREVIEW_LINES.map((line, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-muted-foreground/40 w-4 shrink-0 text-right select-none">
                {i + 1}
              </span>
              <span className={cn('truncate', line.accent)} style={{ paddingLeft: line.indent * 12 }}>
                {line.text || '\u00a0'}
              </span>
            </div>
          ))}
        </div>

        <div className="hidden p-4 sm:block">
          <span className="text-muted-foreground text-[0.62rem] tracking-[0.14em] uppercase">
            Test suite
          </span>
          <ul className="mt-3 space-y-2">
            {[
              ['first page returns the newest rows', true],
              ['boundary row is not skipped', false],
              ['ties on created_at are stable', false],
              ['all rows returned exactly once', null],
            ].map(([label, state]) => (
              <li key={label as string} className="flex items-start gap-2 text-[0.7rem]">
                <span
                  className={cn(
                    'mt-px grid size-3.5 shrink-0 place-items-center rounded-full text-[0.5rem]',
                    state === true && 'bg-success/20 text-success',
                    state === false && 'bg-destructive/20 text-destructive',
                    state === null && 'bg-muted text-muted-foreground',
                  )}
                >
                  {state === true ? '✓' : state === false ? '✕' : '·'}
                </span>
                <span className="text-muted-foreground leading-snug">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
