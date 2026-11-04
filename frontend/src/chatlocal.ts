// The part of "Talk to Aura" that runs on the phone with no laptop and no internet: emergency words (the same list
// as backend/src/aurahealth/chat.py) and questions about the app or the household's own saved data. Fixed rules,
// no model. Anything else goes to the AI helper on the laptop when it is reachable.
import rules from '../../packs/ai/emergency_rules.json'
import type { SourceRef } from './knowledge'
import { clockOf, mainPerson, personName, today } from './household'
import type { Dose, Household } from './household'
import type { T } from './i18n'

export type ChatAction =
  | 'none'
  | 'call_emergency'
  | 'open_help'
  | 'nearby_hospital'
  | 'nearby_pharmacy'
  | 'share_location'
  | 'open_medicines'
  | 'open_guard'
  | 'open_family'
  | 'open_card'

export type AnswerKind = 'education' | 'reading' | 'symptom' | 'medicine' | 'urgent' | 'app' | 'support'

/** What Talk to Aura shows for one answer. `text` is always the direct answer; the rest is optional detail. */
export interface AuraAnswer {
  text: string
  guides: string[]
  action: ChatAction
  source: 'phone' | 'ai'
  kind?: AnswerKind
  nextStep?: string
  why?: string
  urgentIf?: string[]
  followUp?: string
  sources?: SourceRef[]
  limits?: string[] // no_source: no approved source supports this answer
  facts?: boolean // words copied from the evidence pack, not written by AI
  softCall?: boolean // facts shown to someone describing a person: a plain way to call goes with them
  crisis?: boolean
}

const GUIDE_ORDER = ['check', 'cpr', 'recovery', 'choking', 'bleeding', 'chest_pain', 'stroke', 'snakebite', 'seizure', 'low_sugar', 'breathing', 'allergy', 'poisoning', 'burns', 'head_injury', 'faint', 'fever']
// Emergency words, shared with the laptop (backend/src/aurahealth/chat.py) in packs/ai/emergency_rules.json.
const TYPOS = rules.typos.map(([p, r]) => [new RegExp(p, 'gi'), r] as const)
const NEG = new RegExp(rules.negation, 'i')
const GENERAL = new RegExp(rules.general_question, 'i')
const PERSONAL = new RegExp(rules.personal, 'i')
const RESOLVED = new RegExp(rules.resolved, 'i')
const PAST = new RegExp(rules.past, 'i')
const STILL = new RegExp(rules.still_now, 'i')
const SEVERE = new RegExp(rules.severe, 'i')
const NOT_BREATHING = /\b(not|stopped|stop|no longer)\s+breath|\bbreathing\s+(has\s+)?stopped/i
const RED_FLAGS = rules.rules.map((r) => ({ pattern: new RegExp(r.pattern, 'gi'), guide: r.guide, minor: r.minor ? new RegExp(r.minor, 'i') : null }))

/** Tidy spacing and known voice-typing errors and Hindi or Telugu words before the rules read the text. */
export function normalize(text: string): string {
  let out = text.toLowerCase().replace(/\u2019/g, "'").trim().split(/\s+/).join(' ')
  for (const [pattern, replacement] of TYPOS) out = out.replace(pattern, replacement)
  return out
}

/** "What are the signs of a stroke?" is a question to answer, not an emergency happening now. */
export function isGeneralQuestion(text: string): boolean {
  const t = normalize(text)
  return GENERAL.test(t) && !PERSONAL.test(t)
}

// Words that point to a guide but are not an emergency by themselves: the AI answers (it can name warning signs),
// with the guide attached; if the AI cannot answer, the guide's own first steps are shown.
const HINTS: [RegExp, string][] = [
  [/\bfever\b|\bhigh temperature\b|\bbukhar\b/i, 'fever'],
  [/\bdizz(y|iness)\b|\blight-?headed\b/i, 'faint'],
]

export function guideHints(text: string): string[] {
  return HINTS.filter(([re]) => {
    const m = re.exec(text)
    return m && !NEG.test(text.slice(Math.max(0, m.index - 30), m.index))
  }).map(([, g]) => g)
}

export function redFlags(text: string): { found: boolean; guides: string[] } {
  const t = normalize(text)
  if (isGeneralQuestion(t) || RESOLVED.test(t) || (PAST.test(t) && !STILL.test(t))) return { found: false, guides: [] }
  let found = false
  const guides: string[] = []
  for (const { pattern, guide, minor } of RED_FLAGS) {
    if (minor && minor.test(t) && !SEVERE.test(t)) continue // bleeding gums, a small nosebleed: the AI answers
    for (const m of t.matchAll(pattern)) {
      if (NEG.test(t.slice(Math.max(0, (m.index ?? 0) - 30), m.index))) continue
      found = true
      if (guide && !guides.includes(guide)) guides.push(guide)
      break
    }
  }
  // Someone fitting does not respond either: the seizure guide (which checks breathing at the end) comes first.
  const kept = guides.includes('seizure') && guides.includes('check') && !NOT_BREATHING.test(t) ? guides.filter((g) => g !== 'check') : guides
  return { found, guides: kept.sort((a, b) => GUIDE_ORDER.indexOf(a) - GUIDE_ORDER.indexOf(b)).slice(0, 2) }
}

const has = (text: string, re: RegExp) => re.test(text)

/** Answers that need no model: the app's own features and this household's saved data. Null if it is not one. */
export function localAnswer(text: string, h: Household, doses: Dose[], t: T): AuraAnswer | null {
  const s = text.toLowerCase()
  const say = (key: string, action: ChatAction, vars?: Record<string, string | number>): AuraAnswer => ({ text: t(key, vars), guides: [], action, source: 'phone' })

  const medsStatus = has(s, /\b(today'?s?|this morning|tonight)\b.*\b(medicines?|doses?|tablets?|pills?)\b|\b(medicines?|doses?|tablets?|pills?)\b.*\b(today|this morning|tonight)\b|\b(did|has|have)\s+(\w+\s+){0,3}(take|taken|took)\s+(\w+\s+){0,2}(medicines?|doses?|tablets?|pills?)\b|\bnext\s+(medicines?|doses?|tablets?|pills?)\b|\bmedicine (time|times|schedule)\b|\breminders?\b/)
  if (medsStatus && !has(s, /\b(all|too (much|many)|double|by mistake|extra|\d+|safe|should|hospital)\b/)) {
    const list = today(h, doses)
    if (!list.length) return say('chat.local.medsNone', 'open_medicines')
    const parts = list.map((d) => {
      const who = personName(h, d.person)
      const status = t(`meds.status.${d.status}`, { time: d.takenAt ? clockOf(d.takenAt) : '' })
      return `${clockOf(d.due)} ${d.name}${who ? ` (${who})` : ''}: ${status}`
    })
    return { text: t('chat.local.medsToday', { list: parts.join('; ') }), guides: [], action: 'open_medicines', source: 'phone' }
  }
  if (has(s, /\b(ambulance|call 112|emergency number)\b/)) return say('chat.local.call', 'call_emergency')
  if (has(s, /\b(medical (store|shop)|pharmacy|chemist|medicine shop)\b/)) return say('chat.local.pharmacy', 'nearby_pharmacy')
  if (has(s, /\b(hospitals?|clinic)\b/) && has(s, /\b(near|nearest|closest|where|find|which)\b/)) return say('chat.local.hospital', 'nearby_hospital')
  if (has(s, /\b(share|send)\b.*\blocation\b|\bwhere am i\b|\bmy location\b/)) return say('chat.local.location', 'share_location')
  const named = h.people.some((x) => x.name.trim() && s.includes(x.name.trim().toLowerCase()))
  const lookup = has(s, /\b(blood group)\b/) || (has(s, /\b(what|which|any|does|do|is|are)\b.*\ballerg\w*/) && (named || has(s, /\b(my|his|her|our|amma|nanna|father|mother)\b/)) && !has(s, /\b(good|safe|cause|treat|medicine|tablet|take)\b/))
  if (lookup) {
    const p = h.people.find((x) => x.name.trim() && s.includes(x.name.trim().toLowerCase())) ?? mainPerson(h)
    if (!p?.name.trim()) return say('chat.local.noPerson', 'open_family')
    if (has(s, /\bblood group\b/)) return say(p.blood ? 'chat.local.blood' : 'chat.local.bloodUnknown', 'open_family', { name: p.name, blood: p.blood })
    return say(p.allergies.trim() ? 'chat.local.allergies' : 'chat.local.allergiesUnknown', 'open_family', { name: p.name, text: p.allergies.trim() })
  }
  if (has(s, /\b(how|where|can i|want to|need to)\b.*\b(add|save)\b.*\b(mother|mom|mum|amma|father|dad|nanna|parents?|son|daughter|wife|husband|child|children|family|person|people|member|someone)\b/)) return say('chat.local.addPerson', 'open_family')
  if (has(s, /\b(night guard|knock|knocks)\b/)) return say('chat.local.guard', 'open_guard')
  if (has(s, /\b(handoff|operator card)\b/)) return say('chat.local.card', 'open_card')
  if (has(s, /^(what can you do|what do you do|who are you|what are you)\??$|\bhow (does|do) (this|the) app\b|\bhow to use (this|the) app\b/)) return say('chat.local.about', 'none')
  return null
}
