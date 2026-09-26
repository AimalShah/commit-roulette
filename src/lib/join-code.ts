/** Unambiguous alphabet — no O/0, I/1, so codes can be read aloud on stage. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateJoinCode(random: () => number = Math.random, length = 6): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(random() * ALPHABET.length) % ALPHABET.length]
  }
  return out
}

export function normaliseJoinCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

export function isValidJoinCode(input: string): boolean {
  return /^[A-HJ-NP-Z2-9]{4,6}$/.test(normaliseJoinCode(input))
}
