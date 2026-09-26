import { cn } from '@/lib/cn'

/** Roulette wedge mark — three sectors, one lit. Reads at 20px. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn('size-7', className)} aria-hidden="true">
      <circle cx="16" cy="16" r="14" className="stroke-border" strokeWidth="2" />
      <path d="M16 2a14 14 0 0 1 12.124 7L16 16Z" fill="var(--cat-api)" opacity="0.9" />
      <path d="M28.124 9A14 14 0 0 1 28.124 23L16 16Z" fill="var(--cat-security)" opacity="0.75" />
      <path d="M16 16h12.124A14 14 0 0 1 16 30Z" fill="var(--cat-refactoring)" opacity="0.55" />
      <path d="M16 16 4 23A14 14 0 0 1 16 2Z" fill="var(--primary)" />
      <circle cx="16" cy="16" r="4.25" fill="var(--background)" />
      <circle cx="16" cy="16" r="2" fill="var(--primary)" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <Logo />
      <span className="text-[0.95rem] leading-none font-semibold tracking-tight">
        Commit<span className="text-primary">Roulette</span>
      </span>
    </span>
  )
}
