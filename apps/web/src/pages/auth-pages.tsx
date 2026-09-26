import { Link, useSearchParams } from 'react-router-dom'
import { SignIn, SignUp } from '@clerk/clerk-react'

import { Wordmark } from '@/components/brand'
import { isValidJoinCode, normaliseJoinCode } from '@commit-roulette/shared/join-code'

/**
 * Clerk's prebuilt components. The social buttons (GitHub, and anything else
 * enabled in the Clerk dashboard) are rendered by Clerk itself.
 */
const appearance = {
  variables: {
    colorBackground: '#1f1f22',
    colorPrimary: '#b8f24a',
    colorText: '#fafafa',
    colorTextSecondary: '#a6a6ad',
    colorInputBackground: '#161618',
    colorInputText: '#fafafa',
    borderRadius: '0.6rem',
  },
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full shadow-none',
    card: 'bg-transparent shadow-none border-none',
    footer: 'bg-transparent',
  },
}

/**
 * `?room=K7X2QM` on the auth links keeps the old join-code flow: land in the
 * room instead of the dashboard once the user is authenticated.
 */
function useRedirectUrl(): string {
  const [params] = useSearchParams()
  const room = normaliseJoinCode(params.get('room') ?? '')
  if (isValidJoinCode(room)) return `/room/${room}`
  return params.get('redirect_url') ?? '/dashboard'
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Link to="/" className="w-fit" aria-label="Back to home">
          <Wordmark />
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="flex w-full max-w-sm justify-center">{children}</div>
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
            <span className="text-foreground block font-medium">Accounts are real</span>
            Sign in with GitHub or an email and password. Joining a room still needs nothing but
            the code.
          </div>
        </div>
      </aside>
    </div>
  )
}

export function SignInPage() {
  const redirectUrl = useRedirectUrl()

  return (
    <AuthLayout>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl={redirectUrl}
        appearance={appearance}
      />
    </AuthLayout>
  )
}

export function SignUpPage() {
  const redirectUrl = useRedirectUrl()

  return (
    <AuthLayout>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl={redirectUrl}
        appearance={appearance}
      />
    </AuthLayout>
  )
}
