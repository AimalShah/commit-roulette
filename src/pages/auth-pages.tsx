import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Wordmark } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { isValidJoinCode, normaliseJoinCode } from '@/lib/join-code'

/**
 * Stands in for Clerk's pre-built component. Swapping this for
 * <SignIn /> / <SignUp /> from @clerk/clerk-react is a one-file change —
 * everything downstream reads the session from @/mock/session.
 */
export function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const navigate = useNavigate()
  const isSignUp = mode === 'sign-up'

  const [email, setEmail] = useState(isSignUp ? '' : 'aimal@commitroulette.dev')
  const [password, setPassword] = useState(isSignUp ? '' : 'roulette')
  const [username, setUsername] = useState(isSignUp ? '' : '')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (isSignUp && username.trim().length < 3) {
      setError('Pick a username of at least 3 characters.')
      return
    }
    if (!email.includes('@')) {
      setError('That email does not look right.')
      return
    }
    if (password.length < 8) {
      setError('Passwords need at least 8 characters.')
      return
    }

    setBusy(true)
    window.setTimeout(() => {
      const room = normaliseJoinCode(code)
      navigate(isValidJoinCode(room) ? `/room/${room}` : '/dashboard')
    }, 700)
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* form */}
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Link to="/" className="w-fit" aria-label="Back to home">
          <Wordmark />
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {isSignUp
                ? 'An account is only needed to host a room. Joining is open to anyone with the code.'
                : 'Sign in to host rooms and keep your score history.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="aimal"
                    autoComplete="username"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.dev"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {!isSignUp && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-primary text-[0.7rem] transition-colors"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">
                  Room code <span className="text-muted-foreground normal-case">(optional)</span>
                </Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(event) => setCode(normaliseJoinCode(event.target.value))}
                  placeholder="K7X2QM"
                  maxLength={6}
                  className="font-mono tracking-[0.2em] uppercase"
                />
              </div>

              {error && (
                <p role="alert" className="text-destructive text-xs">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? 'One moment…' : isSignUp ? 'Create account' : 'Sign in'}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-[0.7rem]">or</span>
              <Separator className="flex-1" />
            </div>

            <div className="grid gap-2">
              <Button variant="outline" type="button">
                Continue with GitHub
              </Button>
              <Button variant="outline" type="button">
                Continue with Google
              </Button>
            </div>

            <p className="text-muted-foreground mt-8 text-center text-xs">
              {isSignUp ? 'Already have an account? ' : 'No account yet? '}
              <Link
                to={isSignUp ? '/sign-in' : '/sign-up'}
                className="text-primary hover:underline"
              >
                {isSignUp ? 'Sign in' : 'Create one'}
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* aside */}
      <aside className="bg-grid relative hidden overflow-hidden border-l lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(70% 60% at 70% 20%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 70%)',
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12">
          <p className="text-muted-foreground font-mono text-xs tracking-[0.2em] uppercase">
            Why an account?
          </p>

          <div className="max-w-md">
            <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
              Hosting needs a name on the board.
            </h2>
            <ul className="mt-6 space-y-3">
              {[
                'Host rooms and control the round flow',
                'Keep your score history across games',
                'Join any room with just the code',
              ].map((item) => (
                <li key={item} className="text-muted-foreground flex items-start gap-2.5 text-sm">
                  <span className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-border text-muted-foreground rounded-xl border p-5 text-xs leading-relaxed">
            <span className="text-foreground block font-medium">Demo build</span>
            Authentication is stubbed — the form accepts anything reasonable and drops you on the
            dashboard.
          </div>
        </div>
      </aside>
    </div>
  )
}

export function SignInPage() {
  return <AuthPage mode="sign-in" />
}

export function SignUpPage() {
  return <AuthPage mode="sign-up" />
}
