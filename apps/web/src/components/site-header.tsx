import { GitCommitHorizontal, LogIn } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Wordmark } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { useSessionUser } from '@/hooks/use-session-user'

export function SiteHeader({ showAuth = true }: { showAuth?: boolean }) {
  const { user, isSignedIn } = useSessionUser()

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="shrink-0" aria-label="Commit Roulette home">
          <Wordmark />
        </Link>

        <nav className="ml-6 hidden items-center gap-6 text-sm md:flex">
          <a href="/#how" className="text-muted-foreground transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="/#categories" className="text-muted-foreground transition-colors hover:text-foreground">
            Challenges
          </a>
          <a href="/#scoring" className="text-muted-foreground transition-colors hover:text-foreground">
            Scoring
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
            <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="Source on GitHub">
              <GitCommitHorizontal />
            </a>
          </Button>
          {showAuth && !isSignedIn && (
            <>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link to="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/dashboard">
                  <LogIn />
                  Play
                </Link>
              </Button>
            </>
          )}
          {(!showAuth || isSignedIn) && (
            <span className="text-muted-foreground hidden font-mono text-xs sm:inline">
              {user.handle}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
