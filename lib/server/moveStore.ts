// Short-lived handover packages for moving to Plantry's new address. The old address saves
// a phone's data here under a random token; the new address collects it once and it is gone.
// Uses the same Upstash Redis as household sync, compressed so a full kitchen fits easily.

import { gunzipSync, gzipSync } from 'node:zlib'

export const MOVE_TTL_SECONDS = 60 * 60 * 24
export const MAX_MOVE_BYTES = 6_000_000

export interface MoveStore {
  put(token: string, text: string): Promise<void>
  /** Returns the package and deletes it. */
  take(token: string): Promise<string | null>
}

const key = (token: string) => `plantry:move:${token}`
const pack = (text: string) => gzipSync(Buffer.from(text, 'utf8')).toString('base64')
const unpack = (v: string) => gunzipSync(Buffer.from(v, 'base64')).toString('utf8')

function memoryStore(): MoveStore {
  const g = globalThis as unknown as { __plantryMove?: Map<string, { v: string; until: number }> }
  const map = (g.__plantryMove ??= new Map())
  return {
    async put(token, text) {
      map.set(token, { v: pack(text), until: Date.now() + MOVE_TTL_SECONDS * 1000 })
    },
    async take(token) {
      const hit = map.get(token)
      map.delete(token)
      return hit && hit.until > Date.now() ? unpack(hit.v) : null
    },
  }
}

function upstashStore(url: string, token: string): MoveStore {
  async function call(cmd: (string | number)[]) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Upstash ${res.status}`)
    const body = (await res.json()) as { result?: unknown; error?: string }
    if (body.error) throw new Error(body.error)
    return body.result
  }
  return {
    async put(t, text) {
      await call(['SET', key(t), pack(text), 'EX', MOVE_TTL_SECONDS])
    },
    async take(t) {
      const v = await call(['GETDEL', key(t)])
      return typeof v === 'string' && v ? unpack(v) : null
    },
  }
}

/** The store to use, or null when no server storage is set up on this deployment. */
export function getMoveStore(): MoveStore | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) return upstashStore(url, token)
  if (process.env.NODE_ENV !== 'production' || process.env.PLANTRY_SYNC_MEMORY === '1')
    return memoryStore()
  return null
}

export const isMoveToken = (t: string) => /^[a-f0-9]{32}$/.test(t)
