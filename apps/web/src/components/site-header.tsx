import { GitCommitHorizontal, LogIn } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Wordmark } from '@/components/brand'
import { MusicToggle } from '@/components/music-toggle'
import { Button } from '@/components/ui/button'
import { currentUser } from '@/mock/session'

export function SiteHeader({ showAuth = true }: { showAuth?: boolean }) {
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
          <MusicToggle />
          <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
            <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="Source on GitHub">
              <GitCommitHorizontal />
            </a>
          </Button>
          {showAuth && (
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
          {!showAuth && (
            <span className="text-muted-foreground hidden font-mono text-xs sm:inline">
              {currentUser.handle}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
