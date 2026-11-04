// The daily care record: what is due today from a doctor's plan and medicine reminders, what was done, and how each day went.
// All of it stays on the phone. AuraHealth never suggests what to take or do: every item is what the family or the doctor's paper says.
import { dayKey, loadDoses, startOfDay } from './household'
import type { CarePlan, DayLog, Dose, Household, Med, TaskKind } from './household'
import { native } from './native'

const DAY = 24 * 3600 * 1000

export const kindOf = (m: Med): TaskKind => m.kind ?? 'medicine'

export interface DayItem {
  id: string
  med: Med
  kind: TaskKind
  time: string | null
  due: number | null
  key: string | null
  done: boolean
  byReminder: boolean // marked through the reminder, so it stays in Android's log
  status: 'done' | 'missed' | 'due' | 'upcoming' | 'open'
  guardians?: number
}

function activeOn(m: Med, dayStart: number): boolean {
  if (!m.on || !m.name.trim()) return false
  if (m.until && m.until < dayStart) return false
  if (m.weekday !== undefined && m.weekday !== new Date(dayStart).getDay()) return false
  return !(m.since && m.since >= dayStart + DAY)
}

/** Everything expected on one day, in time order. Items with no time ("no salt") come last. */
export function dayItems(h: Household, doses: Dose[] = loadDoses(), day = Date.now(), now = Date.now()): DayItem[] {
  const start = startOfDay(day)
  const ticked = new Set(h.days[dayKey(start)]?.done ?? [])
  const over = start + DAY <= now
  const out: DayItem[] = []
  for (const m of h.meds) {
    if (!activeOn(m, start)) continue
    if (!m.times.length) {
      const done = ticked.has(m.id)
      out.push({ id: m.id, med: m, kind: kindOf(m), time: null, due: null, key: null, done, byReminder: false, status: done ? 'done' : over ? 'missed' : 'open' })
      continue
    }
    for (const time of m.times) {
      const [hh, mm] = time.split(':').map(Number)
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue
      const due = new Date(start).setHours(hh, mm, 0, 0)
      if (due < m.since || (m.until && due > m.until)) continue
      const id = `${m.id}@${time}`
      const log = doses.find((d) => d.med === m.id && d.due === due)
      const byReminder = log?.status === 'taken'
      const done = byReminder || ticked.has(id)
      const status = done ? 'done' : log?.status === 'missed' || over ? 'missed' : due <= now ? 'due' : 'upcoming'
      out.push({ id, med: m, kind: kindOf(m), time, due, key: log?.key ?? null, done, byReminder, status, guardians: log?.guardians })
    }
  }
  return out.sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity))
}

export const score = (items: DayItem[]) => {
  const done = items.filter((i) => i.done).length
  return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 }
}

function withDay(h: Household, key: string, change: (d: DayLog) => DayLog): Household {
  const days = { ...h.days, [key]: change(h.days[key] ?? { done: [] }) }
  const keys = Object.keys(days).sort()
  for (const old of keys.slice(0, Math.max(0, keys.length - 400))) delete days[old]
  return { ...h, days }
}

/** Tick or untick an item. A reminder already showing goes through Android, which also updates a guardian who was told. */
export function setDone(h: Household, save: (h: Household) => boolean, item: DayItem, done: boolean): void {
  if (done && item.key && native()?.markTaken?.(item.key)) return
  save(withDay(h, dayKey(), (d) => ({ ...d, done: done ? [...new Set([...d.done, item.id])] : d.done.filter((x) => x !== item.id) })))
}

export function saveCheckIn(h: Household, save: (h: Household) => boolean, entry: Partial<DayLog>): void {
  save(withDay(h, dayKey(), (d) => ({ ...d, ...entry })))
}

export interface HistoryDay {
  key: string
  date: number
  done: number
  total: number
  pct: number
  log?: DayLog
}

export function history(h: Household, doses: Dose[] = loadDoses(), n = 14, now = Date.now()): HistoryDay[] {
  const out: HistoryDay[] = []
  for (let i = n - 1; i >= 0; i--) {
    const date = startOfDay(now) - i * DAY
    // A day that changes the clocks is rare and only shifts one bar, so plain arithmetic is good enough here.
    const key = dayKey(date)
    out.push({ key, date, ...score(dayItems(h, doses, date, now)), log: h.days[key] })
  }
  return out
}

/** Days in a row with everything done, counting today only once it is complete. */
export function streak(days: HistoryDay[]): number {
  let run = 0
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i]
    const today = i === days.length - 1
    if (d.total === 0 || d.done < d.total) {
      if (today) continue
      break
    }
    run++
  }
  return run
}

export function planProgress(plan: CarePlan, now = Date.now()) {
  const day = Math.floor((startOfDay(now) - startOfDay(plan.start)) / DAY) + 1
  const shown = Math.max(1, Math.min(day, plan.days))
  return { day: shown, days: plan.days, finished: day > plan.days, left: Math.max(0, plan.days - day), pct: Math.min(100, Math.round((shown / plan.days) * 100)) }
}

export const planEnd = (plan: Pick<CarePlan, 'start' | 'days'>, taskDays = 0) => startOfDay(plan.start) + (taskDays > 0 ? taskDays : plan.days) * DAY - 1

/** Save a plan and its daily items. Items reuse the reminder system, so they ring and stop by themselves at the end date. */
export function savePlan(h: Household, save: (h: Household) => boolean, plan: CarePlan, tasks: Med[]): boolean {
  const others = h.meds.filter((m) => m.plan !== plan.id)
  const since = Date.now()
  const before = h.plans.find((p) => p.id === plan.id)
  // An item keeps its own shorter course. Anything that ran to the plan's end follows a change in the plan's length.
  const end = (m: Med) => (!m.until || (before && m.until === planEnd(before)) ? planEnd(plan) : m.until)
  const clean = tasks
    .filter((m) => m.name.trim())
    .map((m) => ({ ...m, name: m.name.trim(), dose: m.dose.trim(), person: plan.person, plan: plan.id, on: plan.on, since: h.meds.some((x) => x.id === m.id) ? m.since : since, until: end(m), times: [...new Set(m.times.filter(Boolean))].sort() }))
  const plans = h.plans.some((p) => p.id === plan.id) ? h.plans.map((p) => (p.id === plan.id ? plan : p)) : [...h.plans, plan]
  return save({ ...h, plans, meds: [...others, ...clean] })
}

export function removePlan(h: Household, save: (h: Household) => boolean, plan: CarePlan): void {
  save({ ...h, plans: h.plans.filter((p) => p.id !== plan.id), meds: h.meds.filter((m) => m.plan !== plan.id) })
}

export const FEELINGS = ['care.feel1', 'care.feel2', 'care.feel3', 'care.feel4', 'care.feel5']

/** "Feeling better" needs enough days to mean anything: the last 3 check-ins against the 3 before them. */
export function feelingTrend(days: HistoryDay[]): 'better' | 'worse' | 'same' | null {
  const values = days.map((d) => d.log?.feel).filter((v): v is number => typeof v === 'number')
  if (values.length < 4) return null
  const recent = values.slice(-3)
  const before = values.slice(-6, -3)
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const diff = avg(recent) - avg(before)
  return diff >= 0.5 ? 'better' : diff <= -0.5 ? 'worse' : 'same'
}

export const SAMPLE_PLAN = 'plan-sample'

/**
 * Made-up days, so a demo can show what the record looks like after 11 days. The screen says they are made up, and the
 * items never ring or text anyone. Removing them leaves everything else as it was.
 */
export function addSampleDays(h: Household, save: (h: Household) => boolean, person: string, now = Date.now()): void {
  const start = startOfDay(now) - 11 * DAY
  const plan: CarePlan = { id: SAMPLE_PLAN, person, title: 'Sample: after a hospital stay', doctor: 'Sample clinic', start, days: 30, precautions: ['Avoid smoking', 'Report swelling in the legs'], followUp: 'After 1 month, with reports', on: true, sample: true }
  const until = planEnd(plan)
  const item = (id: string, name: string, dose: string, times: string[], kind: TaskKind): Med => ({ id, person, name, dose, times, kind, on: true, wait: 30, since: start, until, plan: SAMPLE_PLAN, demo: true })
  const meds = [item('s-med', 'Sample medicine', 'as prescribed', ['08:00', '20:00'], 'medicine'), item('s-walk', 'Walk 30 minutes', '', ['07:00'], 'exercise'), item('s-check', 'Check BP and sugar', '', ['08:30'], 'care'), item('s-salt', 'No added salt', '', [], 'food')]
  const all = ['s-med@08:00', 's-med@20:00', 's-walk@07:00', 's-check@08:30', 's-salt']
  const feel = [2, 2, 3, 2, 3, 3, 4, 3, 4, 4, 4]
  const bp = ['152/96', '150/94', '148/92', '146/92', '144/90', '142/90', '140/88', '138/88', '136/86', '134/86', '132/84']
  const sugar = ['172', '168', '160', '164', '150', '148', '140', '138', '130', '124', '118']
  const days: Record<string, DayLog> = { ...h.days }
  feel.forEach((f, i) => {
    const skipped = i === 2 ? ['s-med@20:00'] : i === 5 ? ['s-walk@07:00', 's-salt'] : i === 8 ? ['s-walk@07:00'] : []
    days[dayKey(start + i * DAY + 12 * 3600 * 1000)] = { done: all.filter((x) => !skipped.includes(x)), feel: f, bp: bp[i], sugar: sugar[i], sample: true }
  })
  save({ ...h, plans: [...h.plans.filter((p) => p.id !== SAMPLE_PLAN), plan], meds: [...h.meds.filter((m) => m.plan !== SAMPLE_PLAN), ...meds], days })
}

export function removeSampleDays(h: Household, save: (h: Household) => boolean): void {
  const days = Object.fromEntries(Object.entries(h.days).filter(([, d]) => !d.sample))
  save({ ...h, plans: h.plans.filter((p) => p.id !== SAMPLE_PLAN), meds: h.meds.filter((m) => m.plan !== SAMPLE_PLAN), days })
}
