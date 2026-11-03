'use client'

import { t } from '@/lib/i18n'

// Household sync: keeps this phone and the other phones in a household on the same plan,
// pantry, list, recipes and history. Data goes to Plantry's server only after someone taps
// "Share with my household", and only to the household's code.

import { create } from 'zustand'
import { nextColor, useStore, type PlantryState } from './store'
import { uid } from './utils'
import { localizeRecipes } from './seed/localize'
import { cleanData } from './schema'
import { docsEqual, emptyDoc, mergeDocs, toDoc, type SyncDoc } from './syncDoc'
import { normalizeCode } from './syncCode'

const META_KEY = 'plantry-sync'
const PULL_EVERY_MS = 20_000
const SHOPPING_EVERY_MS = 4_000
const PUSH_AFTER_MS = 1_500

interface Meta {
  code: string
  rev: number
  /** The last document both this phone and the server agreed on. */
  base: SyncDoc
  /** Which household member is the person holding this phone. */
  meId?: string
  lastSyncedAt?: string
}

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncState {
  code?: string
  status: SyncStatus
  lastSyncedAt?: string
  /** Set when the server has no sync set up, so the Settings card can say so. */
  unavailable?: boolean
  error?: string
}

export const useSync = create<SyncState>(() => ({ status: 'off' }))

function readMeta(): Meta | undefined {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return undefined
    const m = JSON.parse(raw) as Meta
    return m && typeof m.code === 'string' && typeof m.rev === 'number' && m.base ? m : undefined
  } catch {
    return undefined
  }
}

function writeMeta(m: Meta | undefined) {
  try {
    if (m) localStorage.setItem(META_KEY, JSON.stringify(m))
    else localStorage.removeItem(META_KEY)
  } catch {
    /* sync keeps working this session; it just starts over next time */
  }
}

const localDoc = () => toDoc(useStore.getState())

/** Check what came from the server the same way saved data is checked. */
function cleanDoc(raw: unknown): SyncDoc {
  const { data } = cleanData(raw)
  const r = (raw ?? {}) as Partial<SyncDoc>
  return {
    ...emptyDoc(),
    ...data,
    settings: typeof r.settings === 'object' && r.settings ? r.settings : {},
    members: (data.members ?? []).map(({ isMe: _isMe, ...m }) => m),
  } as SyncDoc
}

let applying = false

/** Put the household's data into this phone, keeping this phone's own settings. */
function apply(doc: SyncDoc, meId?: string) {
  const s = useStore.getState()
  const settings =
    cleanData({ settings: { ...s.settings, ...doc.settings } }).data.settings ?? s.settings
  applying = true
  try {
    useStore.setState({
      settings,
      members: doc.members.map((m) => (m.id === meId ? { ...m, isMe: true } : m)),
      recipes: doc.recipes.length ? localizeRecipes(doc.recipes) : s.recipes,
      pantry: doc.pantry,
      plan: doc.plan,
      shop: doc.shop,
      shopDismissed: doc.shopDismissed,
      handoffs: doc.handoffs,
      cooked: doc.cooked,
      energyByDate: doc.energyByDate,
      notes: doc.notes,
      replies: doc.replies,
      presence: doc.presence,
      presenceWeekly: doc.presenceWeekly,
      shopTrip: doc.shopTrip ?? {},
    } as Partial<PlantryState>)
  } finally {
    applying = false
  }
}

async function api<T>(
  path: string,
  init?: RequestInit
): Promise<{ status: number; body: T | undefined }> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
  let body: T | undefined
  try {
    body = (await res.json()) as T
  } catch {
    body = undefined
  }
  return { status: res.status, body }
}

type Remote = { rev: number; doc: unknown }

let running: Promise<void> | undefined
let again = false

/** Pull the household's latest, merge this phone's changes in, and push if anything changed. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = run().finally(() => {
    running = undefined
    if (again) {
      again = false
      void syncNow()
    }
  })
  return running
}

async function run() {
  const meta = readMeta()
  if (!meta) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    useSync.setState({ status: 'offline' })
    return
  }
  useSync.setState({ status: 'syncing', code: meta.code })
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const got = await api<Remote>(`/api/sync/${meta.code}`)
      if (got.status === 404) {
        fail(t('This household is gone from the server. Share again to start a new one.'))
        return
      }
      if (got.status === 503) {
        useSync.setState({
          status: 'error',
          unavailable: true,
          error: t('Sync is not set up here.'),
        })
        return
      }
      if (got.status !== 200 || !got.body) throw new Error(`pull ${got.status}`)
      const remote = cleanDoc(got.body.doc)
      const local = localDoc()
      const merged = mergeDocs(meta.base, local, remote)
      if (!docsEqual(merged, remote)) {
        const put = await api<Remote>(`/api/sync/${meta.code}`, {
          method: 'PUT',
          body: JSON.stringify({ baseRev: got.body.rev, doc: merged }),
        })
        if (put.status === 409) continue // Another phone saved first: merge again.
        if (put.status === 413) {
          fail(t('Too much data to share. Remove some photos or old recipes.'))
          return
        }
        if (put.status !== 200 || !put.body) throw new Error(`push ${put.status}`)
        finish(meta, put.body.rev, merged, local)
      } else finish(meta, got.body.rev, merged, local)
      return
    }
    throw new Error('too many conflicts')
  } catch {
    useSync.setState({
      status: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error',
      error: t('Could not reach the server. Changes stay on this phone and sync later.'),
    })
  }
}

function finish(meta: Meta, rev: number, merged: SyncDoc, localWas: SyncDoc) {
  // Changes made on this phone while the request was out are replayed on top, so they
  // aren't lost and go up on the next round.
  const now = localDoc()
  const next = docsEqual(now, localWas) ? merged : mergeDocs(localWas, now, merged)
  if (!docsEqual(next, now)) apply(next, meta.meId)
  const lastSyncedAt = new Date().toISOString()
  writeMeta({ ...meta, rev, base: merged, lastSyncedAt })
  useSync.setState({ status: 'idle', code: meta.code, lastSyncedAt, error: undefined })
}

function fail(error: string) {
  writeMeta(undefined)
  useSync.setState({ status: 'off', code: undefined, error })
}

/** Start sharing this phone's data as a new household. Returns the code. */
export async function startSharing(): Promise<string> {
  const doc = localDoc()
  const res = await api<{ code: string; rev: number; error?: string }>('/api/sync', {
    method: 'POST',
    body: JSON.stringify({ doc }),
  })
  if (res.status === 503) {
    useSync.setState({ unavailable: true })
    throw new Error(t('Sharing is not set up on this server yet.'))
  }
  if (res.status === 413) throw new Error(t('Too much data to share. Remove some photos first.'))
  if (res.status !== 200 || !res.body?.code)
    throw new Error(t('Could not reach the server. Try again.'))
  const meId = useStore.getState().members.find((m) => m.isMe)?.id
  const lastSyncedAt = new Date().toISOString()
  writeMeta({ code: res.body.code, rev: res.body.rev, base: doc, meId, lastSyncedAt })
  useSync.setState({ status: 'idle', code: res.body.code, lastSyncedAt, error: undefined })
  return res.body.code
}

/** Look at a household before joining, to show who's in it. */
export async function peekHousehold(input: string) {
  const code = normalizeCode(input)
  if (!code) throw new Error(t('That code should be 12 letters and numbers.'))
  const res = await api<Remote>(`/api/sync/${code}`)
  if (res.status === 404) throw new Error(t('No household has that code. Check it and try again.'))
  if (res.status === 503) throw new Error(t('Sharing is not set up on this server yet.'))
  if (res.status !== 200 || !res.body) throw new Error(t('Could not reach the server. Try again.'))
  return { code, rev: res.body.rev, doc: cleanDoc(res.body.doc) }
}

/**
 * Join a household. This phone's plan, pantry, list and history are replaced by the
 * household's; recipes this phone added that the household doesn't have are kept and shared.
 */
export function joinHousehold(
  peek: { code: string; rev: number; doc: SyncDoc },
  meId?: string,
  /** A new person joining: added to the household and marked as this phone. */
  newName?: string
) {
  const s = useStore.getState()
  const theirs = new Set(peek.doc.recipes.map((r) => r.id))
  const mine = s.recipes.filter((r) => r.custom && !theirs.has(r.id))
  let members = peek.doc.members
  if (newName?.trim()) {
    const m = { id: uid('m'), name: newName.trim().slice(0, 40), color: nextColor(members) }
    members = [...members, m]
    meId = m.id
  }
  const doc = { ...peek.doc, members, recipes: [...mine, ...peek.doc.recipes] }
  apply(doc, meId)
  useStore.setState({ settings: { ...useStore.getState().settings, onboarded: true } })
  // Base is the household's copy, so the kept recipes count as this phone's additions.
  writeMeta({ code: peek.code, rev: peek.rev, base: peek.doc, meId })
  useSync.setState({ status: 'idle', code: peek.code, error: undefined })
  void syncNow()
}

/** Stop syncing. Everything stays on this phone. */
export function leaveHousehold() {
  writeMeta(undefined)
  useSync.setState({ status: 'off', code: undefined, lastSyncedAt: undefined, error: undefined })
}

/** Which member this phone is, kept across syncs. */
export function setSyncMe(meId: string) {
  const m = readMeta()
  if (m) writeMeta({ ...m, meId })
}

let started = false

/** Begin background sync: after local changes, on returning to the app, and every 20 s. */
export function initSync() {
  if (started || typeof window === 'undefined') return
  started = true
  const meta = readMeta()
  if (meta) useSync.setState({ status: 'idle', code: meta.code, lastSyncedAt: meta.lastSyncedAt })

  let pushTimer: ReturnType<typeof setTimeout> | undefined
  let lastDoc = ''
  useStore.subscribe((s) => {
    if (applying || !readMeta() || !s.hydrated) return
    const text = JSON.stringify(toDoc(s))
    if (text === lastDoc) return
    lastDoc = text
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => void syncNow(), PUSH_AFTER_MS)
  })

  const visible = () => document.visibilityState === 'visible'
  document.addEventListener('visibilitychange', () => visible() && void syncNow())
  window.addEventListener('online', () => void syncNow())
  window.addEventListener('focus', () => void syncNow())
  // Every 20 s, or every 4 s while someone in the household is out shopping, so ticks
  // and late adds show up on the other phone almost at once.
  let last = 0
  setInterval(() => {
    if (!visible()) return
    const every = useStore.getState().shopTrip?.by ? SHOPPING_EVERY_MS : PULL_EVERY_MS
    if (Date.now() - last < every - 500) return
    last = Date.now()
    void syncNow()
  }, SHOPPING_EVERY_MS)
  void syncNow()
}
