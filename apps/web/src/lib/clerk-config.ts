/**
 * Clerk is the only identity provider. Supabase is configured as a Clerk
 * third-party auth provider, so every request below carries a Clerk JWT and
 * Postgres sees the Clerk user id as the `sub` claim.
 *
 * Keys are read at build time from Vite env vars, which is why the publishable
 * key is safe in the bundle and the secret key is not: see SUPABASE_ENV.md.
 */

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Absent in local dev until you paste your own keys. The app has to keep
 * rendering so `pnpm build` works without a Clerk project, so the mock session
 * is used until a key is present — see providers.tsx.
 */
export const isAuthConfigured = Boolean(publishableKey && supabaseUrl && supabaseAnonKey)

export const clerkConfig = {
  publishableKey: publishableKey ?? '',
  supabaseUrl: supabaseUrl ?? '',
  supabaseAnonKey: supabaseAnonKey ?? '',
  configured: isAuthConfigured,
}

export function clerkOptions() {
  if (!isAuthConfigured) return null
  return {
    publishableKey: publishableKey!,
    // No open sign-up: a room caps at six and every seat is a friend.
    signInUrl: '/sign-in',
    signUpUrl: '/sign-up',
    afterSignInUrl: '/dashboard',
    afterSignUpUrl: '/dashboard',
  }
}
