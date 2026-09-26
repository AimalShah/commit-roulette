import type { Player } from '@commit-roulette/shared/types'

/**
 * Stands in for the Clerk session while the backend is out of scope.
 * Everything downstream reads `currentUser`, so swapping in the real
 * `useAuth()` hook is a one-file change.
 */
export const currentUser = {
  id: 'user_aimal',
  name: 'Aimal Shah',
  handle: 'aimal',
  initials: 'AS',
  plan: 'Pro',
  memberSince: '2026-01-04',
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

export const you: Player = {
  id: currentUser.id,
  name: currentUser.name,
  handle: currentUser.handle,
  avatarSeed: currentUser.handle,
  isHost: true,
  isYou: true,
  total: 0,
  rounds: [],
}

/** Bot roster used to fill a room so a solo demo still looks live. */
export const RIVAL_PLAYERS = RIVALS

export const BOT_NAMES = RIVALS.map((p) => p.name)
