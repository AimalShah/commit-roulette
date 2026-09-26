import { useMemo } from 'react'
import { useUser } from '@clerk/clerk-react'

import { initials } from '@commit-roulette/shared/format'
import type { Player } from '@commit-roulette/shared/types'

export interface CurrentUser {
  id: string
  name: string
  handle: string
  initials: string
}

/** Shown to anyone who opens a room link without signing in. */
export const GUEST_USER: CurrentUser = {
  id: 'guest',
  name: 'Guest',
  handle: 'guest',
  initials: 'G',
}

/** Plans are not modelled anywhere yet; the badge is still cosmetic. */
export const DEMO_PLAN = 'Pro'

function handleFor(user: {
  username: string | null
  primaryEmailAddress: { emailAddress: string } | null
  id: string
}): string {
  if (user.username) return user.username
  const email = user.primaryEmailAddress?.emailAddress
  if (email) return email.split('@')[0]
  return user.id.replace(/^user_/, '').slice(0, 8).toLowerCase()
}

/**
 * The signed-in Clerk user in the shape the rest of the app reads.
 * `null` while Clerk is still loading, or when nobody is signed in.
 */
export function useCurrentUser(): CurrentUser | null {
  const { isLoaded, isSignedIn, user } = useUser()

  return useMemo(() => {
    if (!isLoaded || !isSignedIn || !user) return null
    const handle = handleFor(user)
    const name = user.fullName ?? user.username ?? handle
    return { id: user.id, name, handle, initials: initials(name) }
  }, [isLoaded, isSignedIn, user])
}

/** The `you` seat in a room — a guest seat until Clerk resolves a user. */
export function useYouPlayer(): Player {
  const currentUser = useCurrentUser()

  return useMemo(() => {
    const { id, name, handle } = currentUser ?? GUEST_USER
    return {
      id,
      name,
      handle,
      avatarSeed: handle,
      isHost: true,
      isYou: true,
      total: 0,
      rounds: [],
    }
  }, [currentUser])
}

const RIVALS: Omit<Player, 'total' | 'rounds'>[] = [
  {
    id: 'user_ahmed',
    name: 'Ahmed Raza',
    handle: 'ahmed',
    avatarSeed: 'ahmed',
    isHost: false,
    isYou: false,
  },
  {
    id: 'user_hamza',
    name: 'Hamza Iqbal',
    handle: 'hamza',
    avatarSeed: 'hamza',
    isHost: false,
    isYou: false,
  },
  {
    id: 'user_ali',
    name: 'Ali Zaman',
    handle: 'ali',
    avatarSeed: 'ali',
    isHost: false,
    isYou: false,
  },
  {
    id: 'user_sadia',
    name: 'Sadia Noor',
    handle: 'sadia',
    avatarSeed: 'sadia',
    isHost: false,
    isYou: false,
  },
]

/** Bot roster used to fill a room so a solo demo still looks live. */
export const RIVAL_PLAYERS = RIVALS

export const BOT_NAMES = RIVALS.map((p) => p.name)
