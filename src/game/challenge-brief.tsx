import { CircleDot, FlaskConical, ListChecks, Timer } from 'lucide-react'

import { CategoryChip } from '@/components/category-chip'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CATEGORY_MAP } from '@/lib/challenges'
import { cn } from '@/lib/cn'
import { plural } from '@/lib/format'
import type { Challenge } from '@/lib/types'

const DIFFICULTY_LABEL = {
  warmup: 'Warm-up',
  standard: 'Standard',
  hard: 'Hard',
} as const

export function ChallengeBrief({
  challenge,
  className,
}: {
  challenge: Challenge
  className?: string
}) {
  const accent = CATEGORY_MAP[challenge.category].accent

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="border-border flex flex-wrap items-center gap-2 border-b px-5 py-3.5">
        <CategoryChip category={challenge.category} />
        <Badge variant="outline">{DIFFICULTY_LABEL[challenge.difficulty]}</Badge>
        <Badge variant="muted" className="font-mono normal-case">
          {challenge.language}
        </Badge>
        <span className="text-muted-foreground ml-auto inline-flex items-center gap-1.5 font-mono text-[0.7rem]">
          <Timer className="size-3" />
          par ~{challenge.parMinutes}m
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <h2 className="text-[1.05rem] leading-snug font-semibold tracking-tight text-balance">
          {challenge.title}
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">{challenge.tagline}</p>

        <div className="mt-5 space-y-4">
          {challenge.description.split('\n\n').map((paragraph, i) => (
            <p key={i} className="text-[0.85rem] leading-relaxed text-foreground/85">
              {paragraph}
            </p>
          ))}
        </div>

        <Separator className="my-6" />

        <section>
          <h3 className="text-muted-foreground flex items-center gap-2 text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
            <ListChecks className="size-3.5" />
            What the suite checks
          </h3>
          <ul className="mt-3 space-y-2">
            {challenge.acceptance.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[0.82rem] leading-relaxed">
                <CircleDot className="mt-0.5 size-3.5 shrink-0" style={{ color: accent }} />
                <span className="text-foreground/85">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <Separator className="my-6" />

        <section>
          <h3 className="text-muted-foreground flex items-center gap-2 text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
            <FlaskConical className="size-3.5" />
            {challenge.tests.length} {plural(challenge.tests.length, 'test')}
          </h3>
          <ul className="mt-3 space-y-1.5">
            {challenge.tests.map((test) => (
              <li
                key={test.id}
                className="border-border/70 bg-secondary/40 flex items-baseline justify-between gap-3 rounded-md border px-2.5 py-1.5"
              >
                <span className="min-w-0 truncate font-mono text-[0.72rem]">{test.name}</span>
                <span className="text-muted-foreground shrink-0 font-mono text-[0.65rem]">
                  {test.expected}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground/80 mt-3 text-[0.7rem] leading-relaxed">
            The suite is fixed and runs in a sandbox outside our infrastructure. You only see
            pass/fail per test.
          </p>
        </section>

        <Separator className="my-6" />

        <section>
          <h3 className="text-muted-foreground text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
            Tags
          </h3>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {challenge.tags.map((tag) => (
              <span
                key={tag}
                className="border-border text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-[0.65rem]"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
