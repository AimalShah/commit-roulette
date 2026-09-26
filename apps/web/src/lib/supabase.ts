import { useEffect, useMemo } from 'react'
import { useSession } from '@clerk/clerk-react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type ClerkSession = ReturnType<typeof useSession>['session']

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

/**
 * Supabase client that authenticates as the Clerk user: every request carries
 * the Clerk session token, so RLS policies can read `auth.jwt()->>'sub'`.
 * Supabase must have Clerk registered as a third-party auth provider — see the
 * setup steps in the README.
 */
export function createClerkSupabaseClient(session: ClerkSession): SupabaseClient {
  return createClient(supabaseUrl, supabasePublishableKey, {
    accessToken: async () => (await session?.getToken()) ?? null,
  })
}

/** `null` until Clerk has a session, or when Supabase is not configured. */
export function useClerkSupabaseClient(): SupabaseClient | null {
  const { session } = useSession()

  return useMemo(
    () => (isSupabaseConfigured && session ? createClerkSupabaseClient(session) : null),
    [session],
  )
}

/**
 * Clerk does not sync user records into Supabase, so the first authenticated
 * request creates the row. `user_id` is left out on purpose: the column
 * defaults to `auth.jwt()->>'sub'`.
 */
export function useEnsureProfile(profile: { handle: string; displayName: string } | null): void {
  const client = useClerkSupabaseClient()
  const handle = profile?.handle
  const displayName = profile?.displayName

  useEffect(() => {
    if (!client || !handle) return
    let cancelled = false

    void (async () => {
      const existing = await client.from('profiles').select('user_id').limit(1)
      if (cancelled || existing.error || existing.data?.length) return

      await client.from('profiles').insert({ handle, display_name: displayName ?? handle })
    })()

    return () => {
      cancelled = true
    }
  }, [client, handle, displayName])
}
