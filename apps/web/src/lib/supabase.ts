import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { clerkConfig } from './clerk-config'

/**
 * One Supabase client for the whole app, wrapped in a Clerk token provider.
 *
 * The `accessToken` callback is the entire Clerk/Supabase integration on this
 * side: Clerk mints a JWT for the signed-in user, Supabase verifies it with the
 * shared secret, and Postgres reads `sub` to get the Clerk user id. There is no
 * session to manage, no refresh loop, and no second set of credentials.
 *
 * `persistSession: false` matters. Clerk is the session owner; letting
 * supabase-js also write a session to localStorage would give us two sources of
 * truth and a guaranteed desync on sign-out.
 *
 * A throwaway client stands in before keys exist so importing this module never
 * takes the app down. Nothing that needs a real identity may use it.
 */
let client: SupabaseClient | null = null
let realClient: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!clerkConfig.configured) {
    if (!client) {
      client = createClient(
        'http://localhost:54321',
        'public-anon-key-placeholder',
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
      )
    }
    return client
  }

  if (!realClient) {
    realClient = createClient(clerkConfig.supabaseUrl, clerkConfig.supabaseAnonKey, {
      // Clerk owns the session, so supabase-js must not keep one. Handing it an
      // `accessToken` callback makes it fetch a fresh Clerk JWT per request and
      // per realtime heartbeat, which is exactly what Supabase expects from a
      // third-party auth provider.
      accessToken: async () => (isSignedIn() ? await getToken() : null),
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }
  return realClient
}

// Assigned by providers.tsx once ClerkProvider is mounted. Reading it lazily
// rather than through context keeps this module free of React, so it can be
// imported by tests and scripts without a React runtime.
let getToken: () => Promise<string | null> = async () => null
let isSignedIn: () => boolean = () => false

/**
 * Clerk's `useAuth().getToken`, hoisted out of React by providers.tsx. Also
 * takes an `isSignedIn` predicate so we never ask Clerk for a token from a
 * signed-out session, which it rejects with.
 */
export function bindClerkTokenProvider(get: () => Promise<string | null>, signedIn: () => boolean) {
  getToken = get
  isSignedIn = signedIn
}
