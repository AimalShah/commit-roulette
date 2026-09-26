export interface RecentGame {
  id: string
  code: string
  startedAt: string
  rounds: number
  players: number
  position: number
  score: number
  categories: string[]
}

/** Stands in for the rooms the signed-in user has hosted or played. */
export const RECENT_GAMES: RecentGame[] = [
  {
    id: 'g1',
    code: 'K7X2QM',
    startedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    rounds: 5,
    players: 4,
    position: 1,
    score: 431,
    categories: ['security', 'performance', 'api', 'bug-fix', 'testing'],
  },
  {
    id: 'g2',
    code: 'M4TP9Z',
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    rounds: 5,
    players: 3,
    position: 2,
    score: 388,
    categories: ['database', 'refactoring', 'bug-fix', 'api', 'database'],
  },
  {
    id: 'g3',
    code: 'R8WD3K',
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    rounds: 3,
    players: 5,
    position: 4,
    score: 197,
    categories: ['testing', 'performance', 'bug-fix'],
  },
]

export const PLAYER_STATS = {
  gamesPlayed: 12,
  roundsWon: 27,
  solved: 41,
  attempts: 60,
  bestScore: 431,
  favouriteCategory: 'Bug Fix',
}
