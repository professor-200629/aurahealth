// Bridge to the AuraHealth Android app. In a normal browser none of this exists and the app falls back to what
// a web page can do (no listening at night, no automatic calls or texts).

export interface Contact {
  name: string
  number: string
}
export interface Contacts {
  neighbour: Contact
  family: Contact
}

export interface GuardStatus {
  on: boolean
  permissions: Record<string, boolean>
  batteryOptimised: boolean
}

interface Bridge {
  isNative?: () => boolean
  speak?: (text: string) => void
  stopSpeaking?: () => void
  getContacts?: () => string
  saveContacts?: (json: string) => void
  startGuard?: () => string
  stopGuard?: () => void
  guardStatus?: () => string
  cancelAlert?: () => void
  testAlert?: () => void
  requestPermissions?: () => void
  openBatterySettings?: () => void
  getQueue?: () => string
  setQueue?: (json: string) => void
  drainEvents?: () => string
  getHub?: () => string
  setHub?: (url: string, code: string) => void
  getMorning?: () => string
  setMorning?: (on: boolean, hhmm: string) => void
  checkIn?: (kind: string) => void
}

export type AlertReason = 'knock' | 'silence' | 'test'

export type NativeEvent =
  | { type: 'alert'; stage: 'countdown' | 'calling' | 'done' | 'cancelled'; seconds?: number; test?: boolean; reason?: AlertReason }
  | { type: 'guard'; on: boolean }
  | { type: 'knock'; count: number }
  | { type: 'level'; value: number }
  | { type: 'queue' }
  | { type: 'permissions' }

export const native = (): Bridge | undefined => (window as unknown as { AuraNative?: Bridge }).AuraNative
export const isNativeApp = () => {
  try {
    return !!native()?.isNative?.()
  } catch {
    return false
  }
}

const listeners = new Set<(e: NativeEvent) => void>()
;(window as unknown as { auraNativeEvent: (e: NativeEvent) => void }).auraNativeEvent = (e) => listeners.forEach((fn) => fn(e))
export function onNativeEvent(fn: (e: NativeEvent) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

const EMPTY: Contacts = { neighbour: { name: '', number: '' }, family: { name: '', number: '' } }
const CONTACTS_KEY = 'aura.contacts'

/** Phone numbers stay on the phone: in the app they are kept by Android, never sent to the laptop. */
export function loadContacts(): Contacts {
  try {
    const raw = native()?.getContacts?.() ?? window.localStorage.getItem(CONTACTS_KEY)
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Contacts) } : EMPTY
  } catch {
    return EMPTY
  }
}

export function saveContacts(c: Contacts) {
  const json = JSON.stringify(c)
  try {
    if (native()?.saveContacts) native()!.saveContacts!(json)
    else window.localStorage.setItem(CONTACTS_KEY, json)
  } catch {
    /* storage blocked */
  }
}

export interface MorningCheck {
  on: boolean
  time: string
}

/** The morning check lives in the Android app: no "Good morning" by this time while the guard is on → alert. */
export function loadMorning(): MorningCheck | null {
  try {
    const raw = native()?.getMorning?.()
    return raw ? (JSON.parse(raw) as MorningCheck) : null
  } catch {
    return null
  }
}

export function saveMorning(m: MorningCheck) {
  try {
    native()?.setMorning?.(m.on, m.time)
  } catch {
    /* not in the app */
  }
}

export function guardStatus(): GuardStatus | null {
  try {
    const raw = native()?.guardStatus?.()
    return raw ? (JSON.parse(raw) as GuardStatus) : null
  } catch {
    return null
  }
}
