import { useEffect } from 'react'
import { ClerkProvider, useAuth } from '@clerk/clerk-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { clerkConfig, clerkOptions } from '@/lib/clerk-config'
import { bindClerkTokenProvider } from '@/lib/supabase'
import { App } from '@/App'

/**
 * Hoists Clerk's `getToken` out of React so `@/lib/supabase` can be a plain
 * module with no React import. It renders null — the only job is the binding,
 * which must happen before any child fires its first query.
 */
function ClerkTokenBridge() {
  const auth = useAuth()
  useEffect(() => {
    bindClerkTokenProvider(
      () => auth.getToken(),
      () => Boolean(auth.isSignedIn),
    )
  }, [auth])
  return null
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Live game data: the room row is the source of truth and a stale read
      // shows a player someone else's score. Realtime delivers the truth; this
      // is just a backstop for the first paint and reconnects.
      staleTime: 0,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

/**
 * With no Clerk key the app falls back to the mock session so the UI can be
 * developed and reviewed without any accounts. See SUPABASE_ENV.md.
 */
export function Providers() {
  const options = clerkOptions()

  if (!options) {
    if (import.meta.env.DEV) {
      console.warn(
        `[commit-roulette] No VITE_CLERK_PUBLISHABLE_KEY — running on the mock session. ` +
          `See SUPABASE_ENV.md for the full setup.`,
      )
    }
    return (
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    )
  }

  return (
    <ClerkProvider {...options}>
      <ClerkTokenBridge />
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ClerkProvider>
  )
}

export const authConfigured = clerkConfig.configured
