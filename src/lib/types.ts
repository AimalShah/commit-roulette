export type Category =
  | 'bug-fix'
  | 'performance'
  | 'security'
  | 'testing'
  | 'refactoring'
  | 'database'
  | 'api'

export type Difficulty = 'warmup' | 'standard' | 'hard'

export type Language = 'javascript' | 'python'

export interface TestCase {
  id: string
  name: string
  input: string
  expected: string
}

export interface Challenge {
  id: string
  title: string
  category: Category
  difficulty: Difficulty
  language: Language
  /** One-line framing shown under the title. */
  tagline: string
  /** The bug report / ticket body. Plain text, paragraph separated by \n\n. */
  description: string
  /** Bullet list of what the graded test suite checks. */
  acceptance: string[]
  /** Realistic broken starting point. */
  starterCode: string
  testCode: string
  tests: TestCase[]
  /** Rough solve time, used for the "expected" hint on the lobby. */
  parMinutes: number
  tags: string[]
}

export type PlayerStatus = 'idle' | 'coding' | 'committed' | 'scored' | 'timeout'

export interface Player {
  id: string
  name: string
  handle: string
  avatarSeed: string
  isHost: boolean
  isYou: boolean
  /** Total score across all finished rounds. */
  total: number
  rounds: RoundScore[]
}

export interface RoundScore {
  playerId: string
  round: number
  challengeId: string
  category: Category
  correctness: number
  testsPassed: number
  testsTotal: number
  performance: number
  speed: number
  score: number
  elapsedMs: number
}

export interface TestResult {
  id: string
  name: string
  passed: boolean
  expected: string
  received: string
  durationMs: number
}

export interface Submission {
  playerId: string
  code: string
  submittedAt: number
  elapsedMs: number
  results: TestResult[]
  score: number
}

export interface HistoryEntry {
  round: number
  challengeId: string
  category: Category
}

export type RoomPhase =
  | 'lobby'
  | 'spinning'
  | 'challenge'
  | 'waiting'
  | 'round-results'
  | 'final-results'

export interface GameState {
  phase: RoomPhase
  round: number
  challenge: Challenge | null
  endsAt: number | null
  players: Player[]
  submissions: Submission[]
  roundResults: RoundScore[]
  history: HistoryEntry[]
}
