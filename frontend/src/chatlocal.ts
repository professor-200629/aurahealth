// The part of "Talk to Aura" that runs on the phone with no laptop and no internet: emergency words (the same list
// as backend/src/aurahealth/chat.py) and questions about the app or the household's own saved data. Fixed rules,
// no model. Anything else goes to the AI helper on the laptop when it is reachable.
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

export interface AuraAnswer {
  text: string
  guides: string[]
  action: ChatAction
  source: 'phone' | 'ai'
}

const GUIDE_ORDER = ['check', 'cpr', 'recovery', 'choking', 'bleeding', 'chest_pain', 'stroke', 'snakebite', 'seizure', 'low_sugar', 'breathing', 'allergy', 'poisoning', 'burns', 'head_injury', 'faint', 'fever']
const NEG = /\b(not|no|never|isn'?t|wasn'?t|doesn'?t|didn'?t)\s+(\w+\s+){0,2}$/i
const RED_FLAGS: [RegExp, string][] = [
  [/\b(not|isn'?t|stopped|no longer)\s+(breathing|breathe)|\bunconscious|\bnot (responding|answering|waking)|\bwon'?t wake|\bcollapsed?\b|\bfainted\b|\bpassed out\b|\bblacked out\b|\bunresponsive\b/gi, 'check'],
  [/\bchok(e|es|ed|ing)\b/gi, 'choking'],
  [/\bbleed(s|ing)?\b|\blots? of blood\b|\bblood (is )?(pouring|flowing|everywhere|won'?t stop)/gi, 'bleeding'],
  [/\bchest\b[^.?!]{0,30}\b(pain|pressure|tight|hurts?|heavy)|\bheart attack\b/gi, 'chest_pain'],
  [/\bstroke\b|\bface\b[^.?!]{0,20}\bdroop|\bslurr|\b(arm|leg|side)\b[^.?!]{0,20}\b(weak|numb|can'?t move)/gi, 'stroke'],
  [/\bsnake/gi, 'snakebite'],
  [/\bseizures?\b|\bfitting\b|\b(a|the) fit\b|\bfits\b|\bshaking all over\b|\bjerking\b|\bconvuls/gi, 'seizure'],
  [/\blow (blood )?sugar\b|\bsugar (is |has gone |went )?(very )?(low|down)\b|\bhypo(glyc\w*)?\b|\bdiabet\w*\b[^.?!]{0,60}\b(sweat\w*|shak\w*|confus\w*|drows\w*|dizzy|faint\w*|weak)\b|\b(sweat\w*|shak\w*|confus\w*|drows\w*)\b[^.?!]{0,60}\bdiabet\w*/gi, 'low_sugar'],
  [/\b(can'?t|cannot|trouble|struggling to|hard to)\s+breathe?\b|\bbreathless\b|\bshort(ness)? of breath\b|\basthma\b|\bwheez\w*/gi, 'breathing'],
  [/\banaphyla\w*|\ballergic reaction\b|\b(lips?|tongue|throat|face)\b[^.?!]{0,25}\b(swell\w*|swollen)\b|\b(swell\w*|swollen)\b[^.?!]{0,20}\b(lips?|tongue|throat|face)\b|\bhives\b/gi, 'allergy'],
  [/\bpoison\w*|\boverdose|\bswallowed\b[^.?!]{0,30}\b(pills|tablets|medicines?|chemical|bleach|acid|kerosene|pesticide|phenyl)|\btoo many\b[^.?!]{0,20}\b(pills|tablets|medicines?)|\bdrank\b[^.?!]{0,30}\b(kerosene|pesticide|bleach|acid|phenyl)/gi, 'poisoning'],
  [/\bburn(t|ed|s)?\b|\bscald\w*|\b(spilled|spilt|poured)\b[^.?!]{0,25}\b(hot|boiling)\b/gi, 'burns'],
  [/\b(hit|bang\w*|bump\w*|knock\w*|struck|hurt)\b[^.?!]{0,20}\bhead\b|\bhead (injury|wound)\b|\bfell\b[^.?!]{0,40}\bhead\b/gi, 'head_injury'],
  [/\b(feel(s|ing)?|felt|about to|going to) faint\b|\blight-?headed\b/gi, 'faint'],
]

// Words that point to a guide but are not an emergency by themselves: the AI answers (it can name warning signs),
// with the guide attached; if the AI cannot answer, the guide's own first steps are shown.
const HINTS: [RegExp, string][] = [
  [/\bfever\b|\bhigh temperature\b|\bbukhar\b/i, 'fever'],
  [/\bdizz(y|iness)\b/i, 'faint'],
]

export function guideHints(text: string): string[] {
  return HINTS.filter(([re]) => re.test(text)).map(([, g]) => g)
}

export function redFlags(text: string): { found: boolean; guides: string[] } {
  let found = false
  const guides: string[] = []
  for (const [pattern, guide] of RED_FLAGS) {
    for (const m of text.matchAll(pattern)) {
      if (NEG.test(text.slice(Math.max(0, (m.index ?? 0) - 25), m.index))) continue
      found = true
      if (!guides.includes(guide)) guides.push(guide)
      break
    }
  }
  // Someone fitting does not respond either: the seizure guide (which checks breathing at the end) comes first.
  const kept = guides.includes('seizure') ? guides.filter((g) => g !== 'check') : guides
  return { found, guides: kept.sort((a, b) => GUIDE_ORDER.indexOf(a) - GUIDE_ORDER.indexOf(b)).slice(0, 2) }
}

const has = (text: string, re: RegExp) => re.test(text)

/** Answers that need no model: the app's own features and this household's saved data. Null if it is not one. */
export function localAnswer(text: string, h: Household, doses: Dose[], t: T): AuraAnswer | null {
  const s = text.toLowerCase()
  const say = (key: string, action: ChatAction, vars?: Record<string, string | number>): AuraAnswer => ({ text: t(key, vars), guides: [], action, source: 'phone' })

  if (has(s, /\b(did|has|have|was|were|is)\b.*\b(take|taken|took)\b|\b(next|today'?s?)\s+(medicines?|doses?|tablets?|pills?)\b|\bmedicine (time|times|schedule|reminders?)\b|\breminders?\b/)) {
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
  if (has(s, /\bblood group\b|\ballerg/)) {
    const p = h.people.find((x) => x.name.trim() && s.includes(x.name.trim().toLowerCase())) ?? mainPerson(h)
    if (!p?.name.trim()) return say('chat.local.noPerson', 'open_family')
    if (has(s, /\bblood group\b/)) return say(p.blood ? 'chat.local.blood' : 'chat.local.bloodUnknown', 'open_family', { name: p.name, blood: p.blood })
    return say(p.allergies.trim() ? 'chat.local.allergies' : 'chat.local.allergiesUnknown', 'open_family', { name: p.name, text: p.allergies.trim() })
  }
  if (has(s, /\b(how|where|can i|want to|need to)\b.*\b(add|save)\b.*\b(mother|mom|mum|amma|father|dad|nanna|parents?|son|daughter|wife|husband|child|children|family|person|people|member|someone)\b/)) return say('chat.local.addPerson', 'open_family')
  if (has(s, /\b(night guard|knock|knocks)\b/)) return say('chat.local.guard', 'open_guard')
  if (has(s, /\b(handoff|operator card)\b/)) return say('chat.local.card', 'open_card')
  if (has(s, /\b(what can you do|what do you do|who are you|what are you|how (does|do) (this|the) app|how to use)\b/)) return say('chat.local.about', 'none')
  return null
}
