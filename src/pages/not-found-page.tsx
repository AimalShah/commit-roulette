import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="bg-grid grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <p className="text-primary font-mono text-sm tracking-[0.2em] uppercase">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          No room at that address
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-sm leading-relaxed">
          The code may have expired, or the link picked up a typo. Head back and try a fresh one.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Landing page</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
