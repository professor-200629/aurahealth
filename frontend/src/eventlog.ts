// The time log. Every step, alert and check-in is stamped with the phone's time the moment it happens and kept
// on the phone first, so nothing is lost if the laptop is out of reach; it is sent (and re-sent) until the
// laptop confirms. The laptop turns ids into card text from the guide pack or its fixed table.
// Inside the Android app the queue lives in Android storage, so it survives switching between the bundled app
// and the laptop's copy; alerts raised by the night guard service are added from there.
import { api } from './api'
import { native, onNativeEvent } from './native'
import type { Session } from './types'
import { rid } from './ui'

export type EventKind =
  | 'guide_open'
  | 'done'
  | 'choice'
  | 'cpr_start'
  | 'cpr_stop'
  | 'checkin_night'
  | 'checkin_morning'
  | 'guard_on'
  | 'guard_off'
  | 'guard_knock'
  | 'guard_test'
  | 'guard_cancel'
  | 'guard_call'
  | 'guard_sms'
  | 'guard_failed'

export interface PendingEvent {
  id: string
  kind: EventKind
  guide?: string
  step?: string
  choice?: string
  role?: 'neighbour' | 'family'
  at: string
}

const KEY = 'aura.pendingEvents'
let pending: PendingEvent[] = load()
let sending = false
let retryTimer: number | null = null
const listeners = new Set<(n: number) => void>()
let onSession: ((s: Session) => void) | null = null

function load(): PendingEvent[] {
  try {
    const raw = native()?.getQueue?.() ?? window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as PendingEvent[]) : []
  } catch {
    return []
  }
}

function persist() {
  const json = JSON.stringify(pending)
  try {
    if (native()?.setQueue) native()!.setQueue!(json)
    else window.localStorage.setItem(KEY, json)
  } catch {
    /* private mode or blocked storage: the queue still lives in memory */
  }
  listeners.forEach((fn) => fn(pending.length))
}

/** Take events the Android night guard recorded while the page was not looking. */
function drainNative() {
  try {
    const raw = native()?.drainEvents?.()
    const extra = raw ? (JSON.parse(raw) as PendingEvent[]) : []
    if (extra.length) {
      const known = new Set(pending.map((e) => e.id))
      pending = [...pending, ...extra.filter((e) => !known.has(e.id))]
      persist()
    }
  } catch {
    /* nothing to take */
  }
}

drainNative()
onNativeEvent((e) => {
  if (e.type === 'queue') {
    drainNative()
    void flush()
  }
})

export function logEvent(ev: Omit<PendingEvent, 'id' | 'at'>): PendingEvent {
  const full: PendingEvent = { ...ev, id: `${Date.now().toString(36)}${rid()}`, at: new Date().toISOString() }
  pending = [...pending, full]
  persist()
  void flush()
  return full
}

export async function flush() {
  drainNative()
  if (sending || pending.length === 0) return
  sending = true
  const batch = pending.slice(0, 50)
  try {
    const r = await api.sendEvents(batch)
    const sent = new Set(batch.map((e) => e.id))
    pending = pending.filter((e) => !sent.has(e.id))
    persist()
    onSession?.(r.session)
  } catch {
    // 409 = no session on the laptop yet; 0 = unreachable; 422 = an older laptop version. Never drop events:
    // keep them and try again later (the laptop itself skips any single event it cannot accept).
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

export function clearPending() {
  pending = []
  persist()
}

export const pendingCount = () => pending.length
export const pendingEvents = () => pending

export function subscribe(fn: (n: number) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function setSessionListener(fn: (s: Session) => void) {
  onSession = fn
}
