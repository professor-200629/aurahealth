// The household: the people at home (name, age, health notes), the contacts for alerts, and medicine reminders.
// Everything stays on the phone. Inside the Android app it is kept by Android (the alarms and alert texts read it
// there); in a plain browser it is kept in this browser only and reminders cannot run.
import { useEffect, useState } from 'react'
import { native } from './native'
import { rid } from './ui'

export interface Person {
  id: string
  name: string
  age: string
  blood: string
  conditions: string
  allergies: string
  medicines: string
  notes: string
  main: boolean
}

export interface HouseContact {
  id: string
  name: string
  number: string
  relation: string
  call: boolean // phoned first in a night-guard alert
  text: boolean // texted in a night-guard alert
  guardian: boolean // texted when a medicine is not marked taken
}

export type TaskKind = 'medicine' | 'food' | 'exercise' | 'care'

export interface Med {
  id: string
  person: string
  name: string
  dose: string
  times: string[] // no times: a daily item with no reminder, such as "no added salt"
  on: boolean
  wait: number
  since: number
  kind?: TaskKind // missing means medicine
  until?: number // the last moment of a course or plan
  weekday?: number // once a week on this day (0 is Sunday); missing means every day
  demo?: boolean // part of the labelled sample days: it never rings and never texts anyone
  plan?: string
}

/** A doctor's advice for a set time: daily items (kept in meds), and what to watch for. */
export interface CarePlan {
  id: string
  person: string
  title: string
  doctor: string
  start: number
  days: number
  precautions: string[]
  followUp: string
  on: boolean
  sample?: boolean
}

/** One day's record: what was ticked by hand, how the person felt, and any numbers. */
export interface DayLog {
  done: string[]
  feel?: number
  bp?: string
  sugar?: string
  temp?: string
  weight?: string
  note?: string
  sample?: boolean
}

export interface Owner {
  name: string // the person using this phone (often the carer); shown on the profile and the home greeting
  phone: string
}

export interface Household {
  version: 1
  country: string
  owner: Owner
  people: Person[]
  contacts: HouseContact[]
  meds: Med[]
  plans: CarePlan[]
  days: Record<string, DayLog>
  noStatusBar?: boolean
}

export interface Dose {
  key: string
  med: string
  name: string
  dose: string
  person: string
  due: number
  wait: number
  status: 'scheduled' | 'due' | 'taken' | 'missed'
  takenAt?: number
  guardians?: number
  test?: boolean
}

const KEY = 'aura.household'
const EMPTY: Household = { version: 1, country: 'IN', owner: { name: '', phone: '' }, people: [], contacts: [], meds: [], plans: [], days: {} }

export const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0)
export function dayKey(ms = Date.now()): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const newPerson = (main: boolean): Person => ({
  id: `p${rid()}`,
  name: '',
  age: '',
  blood: '',
  conditions: '',
  allergies: '',
  medicines: '',
  notes: '',
  main,
})
export const newContact = (): HouseContact => ({ id: `c${rid()}`, name: '', number: '', relation: '', call: false, text: true, guardian: true })
export const newPlan = (person: string): CarePlan => ({ id: `plan${rid()}`, person, title: '', doctor: '', start: Date.now(), days: 30, precautions: [], followUp: '', on: true })
export const newMed = (person: string): Med => ({ id: `m${rid()}`, person, name: '', dose: '', times: ['08:00'], on: true, wait: 30, since: Date.now() })

function fromOldWebContacts(): HouseContact[] {
  // Before households, the browser kept only the two night-guard contacts.
  try {
    const old = JSON.parse(window.localStorage.getItem('aura.contacts') ?? 'null') as Record<string, { name: string; number: string }> | null
    if (!old) return []
    const out: HouseContact[] = []
    if (old.neighbour?.number || old.neighbour?.name)
      out.push({ ...newContact(), ...old.neighbour, relation: 'Neighbour', call: true, text: false, guardian: false })
    if (old.family?.number || old.family?.name) out.push({ ...newContact(), ...old.family, relation: 'Family' })
    return out
  } catch {
    return []
  }
}

function normalise(h: Partial<Household> | null): Household {
  if (!h) return { ...EMPTY, contacts: fromOldWebContacts() }
  return {
    version: 1,
    country: h.country || 'IN',
    owner: { name: h.owner?.name ?? '', phone: h.owner?.phone ?? '' },
    people: Array.isArray(h.people) ? h.people.map((p) => ({ ...newPerson(false), ...p })) : [],
    contacts: Array.isArray(h.contacts) ? h.contacts.map((c) => ({ ...newContact(), ...c })) : [],
    meds: Array.isArray(h.meds) ? h.meds.map((m) => ({ ...newMed(''), ...m, times: Array.isArray(m.times) ? m.times : [] })) : [],
    plans: Array.isArray(h.plans) ? h.plans.map((p) => ({ ...newPlan(''), ...p, precautions: Array.isArray(p.precautions) ? p.precautions : [] })) : [],
    days: h.days && typeof h.days === 'object' ? h.days : {},
    noStatusBar: !!h.noStatusBar,
  }
}

export function loadHousehold(): Household {
  try {
    const raw = native()?.getHousehold?.() ?? window.localStorage.getItem(KEY)
    return normalise(raw ? (JSON.parse(raw) as Partial<Household>) : null)
  } catch {
    return normalise(null)
  }
}

const listeners = new Set<(h: Household) => void>()

/** Saves and tells every open screen. Returns false if Android refused it. */
export function saveHousehold(h: Household): boolean {
  const json = JSON.stringify(h)
  let ok = true
  try {
    if (native()?.saveHousehold) ok = native()!.saveHousehold!(json)
    else window.localStorage.setItem(KEY, json)
  } catch {
    ok = false
  }
  if (ok) listeners.forEach((fn) => fn(h))
  return ok
}

export function useHousehold(): [Household, (h: Household) => boolean] {
  const [h, setH] = useState<Household>(loadHousehold)
  useEffect(() => {
    listeners.add(setH)
    return () => {
      listeners.delete(setH)
    }
  }, [])
  return [h, saveHousehold]
}

export const mainPerson = (h: Household): Person | undefined => h.people.find((p) => p.main) ?? h.people[0]
export const personName = (h: Household, id: string) => h.people.find((p) => p.id === id)?.name ?? ''

/** The age choice used on the handoff card. */
export function ageChoice(age: string): string | null {
  const n = Number(age)
  if (!age.trim() || !Number.isFinite(n) || n < 0) return null
  if (n < 1) return 'under1'
  if (n <= 12) return '1to12'
  if (n <= 17) return '13to17'
  if (n <= 39) return '18to39'
  if (n <= 64) return '40to64'
  return '65plus'
}

export function loadDoses(): Dose[] {
  try {
    const raw = native()?.getDoseLog?.()
    return raw ? (JSON.parse(raw) as Dose[]) : []
  } catch {
    return []
  }
}

export interface TodayDose {
  key: string | null
  med: Med | null
  name: string
  dose: string
  person: string
  due: number
  status: Dose['status'] | 'upcoming' | 'not_recorded'
  takenAt?: number
  guardians?: number
  test?: boolean
}

/** Today's dose times for every reminder, with what happened to each (from Android's dose log). */
export function today(h: Household, doses: Dose[], now = Date.now()): TodayDose[] {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = start.getTime() + 24 * 3600 * 1000
  const out: TodayDose[] = []
  const used = new Set<string>()
  for (const m of h.meds) {
    if (!m.on || !m.name.trim()) continue
    if (m.weekday !== undefined && m.weekday !== new Date(start).getDay()) continue
    for (const t of m.times) {
      const [hh, mm] = t.split(':').map(Number)
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue
      const due = new Date(start).setHours(hh, mm, 0, 0)
      if (m.until && due > m.until) continue
      const d = doses.find((x) => x.med === m.id && x.due === due)
      if (d) used.add(d.key)
      out.push({
        key: d?.key ?? null,
        med: m,
        name: m.name,
        dose: m.dose,
        person: m.person,
        due,
        status: d ? d.status : due > now ? 'upcoming' : 'not_recorded',
        takenAt: d?.takenAt,
        guardians: d?.guardians,
      })
    }
  }
  for (const d of doses) {
    if (used.has(d.key) || d.due < start.getTime() || d.due >= end) continue
    out.push({ key: d.key, med: null, name: d.name, dose: d.dose, person: d.person, due: d.due, status: d.status, takenAt: d.takenAt, guardians: d.guardians, test: d.test })
  }
  return out.sort((a, b) => a.due - b.due)
}

export const clockOf = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
