// The first-aid time log. Every step is stamped with the phone's time the moment it is tapped and kept on the
// phone first, so nothing is lost if the laptop is out of reach; it is sent (and re-sent) until the laptop
// confirms. The laptop turns ids into card text from the guide pack.
import { api, ApiError } from './api'
import type { Session } from './types'
import { rid } from './ui'

export interface PendingEvent {
  id: string
  kind: 'guide_open' | 'done' | 'choice' | 'cpr_start' | 'cpr_stop'
  guide: string
  step?: string
  choice?: string
  at: string
}

const KEY = 'aura.pendingEvents'
let pending: PendingEvent[] = load()
let sending = false
const listeners = new Set<(n: number) => void>()
let onSession: ((s: Session) => void) | null = null

function load(): PendingEvent[] {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '[]') as PendingEvent[]
  } catch {
    return []
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(pending))
  } catch {
    /* private mode or blocked storage: the queue still lives in memory */
  }
  listeners.forEach((fn) => fn(pending.length))
}

export function logEvent(ev: Omit<PendingEvent, 'id' | 'at'>): PendingEvent {
  const full: PendingEvent = { ...ev, id: `${Date.now().toString(36)}${rid()}`, at: new Date().toISOString() }
  pending = [...pending, full]
  persist()
  void flush()
  return full
}

export async function flush() {
  if (sending || pending.length === 0) return
  sending = true
  const batch = pending.slice(0, 50)
  try {
    const r = await api.sendEvents(batch)
    const sent = new Set(batch.map((e) => e.id))
    pending = pending.filter((e) => !sent.has(e.id))
    persist()
    onSession?.(r.session)
  } catch (err) {
    // 409 = no session on the laptop yet; 0 = laptop unreachable. Keep the events and try again later.
    if (err instanceof ApiError && err.status === 422) {
      pending = pending.filter((e) => !batch.includes(e))
      persist()
    }
  } finally {
    sending = false
  }
  if (pending.length && retryTimer === null) {
    retryTimer = window.setTimeout(() => {
      retryTimer = null
      void flush()
    }, 15000)
  }
}

let retryTimer: number | null = null

export function clearPending() {
  pending = []
  persist()
}

export const pendingCount = () => pending.length

export function subscribe(fn: (n: number) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function setSessionListener(fn: (s: Session) => void) {
  onSession = fn
}
