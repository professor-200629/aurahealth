// Answers written in advance by Meta Muse Glimmer (scripts/build_prepared.py), one or two for each MedlinePlus topic in the app, and
// passed through the same checks as a live answer. They open at once and work offline, because the free AI service can take over a
// minute. They are not personal to anyone, and the screen says so. No clinician has reviewed them.
import pack from '../../packs/knowledge/prepared_en.json'
import { notHappeningNow } from './chatlocal'
import type { AnswerKind, AuraAnswer, ChatAction } from './chatlocal'
import { publicSource, words } from './knowledge'
import type { Evidence } from './knowledge'

interface Stored {
  reply: string
  type: string
  next_step: string
  why: string
  urgent_if: string[]
  guides: string[]
  action: string
}

const ANSWERS = (pack as unknown as { answers: Record<string, Partial<Record<'about' | 'care', Stored>>> }).answers
const STRONG = 8 // a topic named in the question, or an everyday word for it
const SOME = 4.5
const SPECIFIC = /\d|\b(baby|infant|newborn|child|kid|son|daughter|pregnan\w*|old|years?|months?|weeks?|medicines?|tablets?|pills?|should i|can i|can he|can she|how much|how many|is it safe|with my|after|before|but)\b/i

function build(e: Evidence, stored: Stored): AuraAnswer {
  return {
    text: stored.reply,
    guides: stored.guides,
    action: stored.action as ChatAction,
    source: 'phone',
    prepared: true,
    kind: stored.type as AnswerKind,
    nextStep: stored.next_step,
    why: stored.why,
    urgentIf: stored.urgent_if,
    sources: [publicSource(e)],
  }
}

/** What to do for a person. A topic's "call now" answer is only for something happening now, so anything else gets the general answer. */
function forPerson(id: string, question: string): Stored | undefined {
  const both = ANSWERS[id]
  if (both?.care?.action === 'call_emergency' && notHappeningNow(question)) return both.about ?? both.care
  return both?.care ?? both?.about
}

/** The prepared answer for a question that clearly names a topic: what it is for a general question, what to do for a person. */
export function preparedFor(evidence: Evidence[], general: boolean, question: string): AuraAnswer | null {
  const e = evidence[0]
  if (!e || e.score < STRONG) return null
  const both = ANSWERS[e.id]
  const stored = general ? (both?.about ?? both?.care) : forPerson(e.id, question)
  return stored ? build(e, stored) : null
}

/** A short question with no personal details: the prepared answer is enough, and a live answer is one tap away. */
export function isSimple(question: string): boolean {
  return words(question).length <= 6 && question.trim().split(/\s+/).length <= 8 && !SPECIFIC.test(question)
}

/** Most of what the person asked about appears in the answer. "Difference between systolic and diastolic" needs more than the topic's overview. */
export function answersEnough(question: string, answer: AuraAnswer): boolean {
  const asked = words(question)
  if (!asked.length) return true
  const shown = new Set(words([answer.text, answer.nextStep, answer.why, answer.urgentIf?.join(' '), answer.sources?.[0]?.title].filter(Boolean).join(' ')))
  return asked.filter((w) => shown.has(w)).length / asked.length >= 0.6
}

/**
 * The AI could not answer someone describing a person. Offer what the app has written for the closest topics, an urgent one first,
 * because the word rules miss many emergencies.
 */
export function bestWhenAiFails(evidence: Evidence[], question: string): AuraAnswer | null {
  const usable = evidence.filter((e) => e.score >= SOME && ANSWERS[e.id]?.care)
  const urgent = usable.find((e) => forPerson(e.id, question)?.action === 'call_emergency')
  const e = urgent ?? usable[0]
  return e ? build(e, forPerson(e.id, question) as Stored) : null
}
