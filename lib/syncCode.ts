// Household codes: 12 characters from an alphabet without look-alikes (no 0/O, 1/I/L),
// shown in three groups of four. About 60 bits, so codes can't be guessed.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const LENGTH = 12

export function newHouseholdCode(): string {
  const bytes = new Uint8Array(LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

/** Read a code the way people type it: any case, with spaces or dashes. */
export function normalizeCode(input: string): string | undefined {
  const c = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
  return c.length === LENGTH && [...c].every((ch) => ALPHABET.includes(ch)) ? c : undefined
}

/** "ABCD-EFGH-JKMN" */
export const formatCode = (code: string) => code.match(/.{1,4}/g)?.join('-') ?? code
