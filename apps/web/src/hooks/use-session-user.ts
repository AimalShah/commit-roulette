import { useUser } from '@clerk/clerk-react'
import { useMemo } from 'react'

import { currentUser, you } from '@/mock/session'
import { authConfigured } from '@/providers'

export type SessionUser = {
  id: string
  name: string
  handle: string
  initials: string
  memberSince: string | null
  avatarUrl: string | null
}

/**
 * The one place the app asks "who am I". Before Clerk existed this returned a
 * constant; now it returns Clerk's user when configured and the mock when not,
 * so every screen keeps working before anyone has pasted a key.
 *
 * `initial` is Clerk's initial load. It is null while Clerk is fetching, and it
 * is a real signed-out state afterwards. Those must not collapse into one:
 * flashing the mock for a genuinely signed-out visitor would look like a bug.
 */
export function useSessionUser(): {
  user: SessionUser
  isLoading: boolean
  isSignedIn: boolean
  isMock: boolean
} {
  const configured = authConfigured
  const { user, isLoaded, isSignedIn } = useUser()

  const mock = useMemo<SessionUser>(
    () => ({
      id: currentUser.id,
      name: currentUser.name,
      handle: currentUser.handle,
      initials: currentUser.initials,
      memberSince: currentUser.memberSince,
      avatarUrl: null,
    }),
    [],
  )

  const live = useMemo<SessionUser | null>(() => {
    if (!user) return null
    const name =
      user.fullName ?? (typeof user.username === 'string' ? user.username : null) ?? 'Player'
    const handle =
      typeof user.username === 'string'
        ? user.username
        : (user.emailAddresses[0]?.emailAddress.split('@')[0] ?? user.id.slice(-6))
    return {
      id: user.id,
      name,
      handle,
      initials: initialsOf(name),
      memberSince: user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 10) : null,
      avatarUrl: user.imageUrl,
    }
  }, [user])

  if (!configured) {
    return { user: mock, isLoading: false, isSignedIn: true, isMock: true }
  }

  return {
    user: live ?? mock,
    isLoading: !isLoaded,
    isSignedIn: Boolean(isSignedIn && live),
    isMock: false,
  }
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts.at(-1)![0]}`.toUpperCase()
}

/** Signed-in profile shaped like the game's Player, for the room controller. */
export function useSelfPlayer() {
  const { user, isSignedIn } = useSessionUser()
  return useMemo(
    () =>
      isSignedIn
        ? {
            id: user.id,
            name: user.name,
            handle: user.handle,
            avatarSeed: user.handle,
            isHost: you.isHost,
            isYou: true,
            total: 0,
            rounds: [],
          }
        : null,
    [user, isSignedIn],
  )
}
