import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import IN from '../../../packs/regions/IN.json'
import { askFromPhone, crisisText, phoneAiReady } from '../aura'
import { guideHints, isGeneralQuestion, localAnswer, redFlags } from '../chatlocal'
import { hasMoreThanReading, readingAnswer } from '../readings'
import type { AuraAnswer, ChatAction } from '../chatlocal'
import { PhoneAiKey } from '../components/PhoneAiKey'
import { healthSpeech } from '../components/HealthCard'
import { fill, GUIDES } from '../guides'
import { publicSource, quickFacts, retrieve } from '../knowledge'
import type { Evidence } from '../knowledge'
import { loadDoses, mainPerson, useHousehold } from '../household'
import { TEL_URI } from '../i18n'
import { isNativeApp, native, onNativeEvent } from '../native'
import { locate, openNearby, shareText } from '../nearby'
import { speak, stopSpeaking } from '../speech'
import { Icon, useUi } from '../ui'

interface Msg {
  id: number
  role: 'user' | 'aura'
  text: string
  answer?: AuraAnswer
  phoneOnly?: boolean // saved details and crisis words: never sent to the AI service with a later question
}

// Kept while the app is open, so going to a guide and back keeps the conversation, and an answer that arrives
// after the person left this screen is still there when they come back. Never saved.
let history: Msg[] = []
let waiting = 0 // questions still waiting for the AI; a new question is never blocked by them
let round = 0 // goes up when the conversation is cleared, so that late answers to cleared questions are dropped
let nextId = 1
const listeners = new Set<() => void>()
const publish = () => listeners.forEach((fn) => fn())

// Home's ask box hands its question (or a request to start listening) to this screen.
let pending: { text?: string; voice?: boolean } = {}
export const askOnOpen = (text: string) => {
  pending = { text }
}
export const listenOnOpen = () => {
  pending = { voice: true }
}

export type ChatTarget = 'help' | 'meds' | 'guard' | 'family' | 'card'

export function Chat({ onGuide, onOpen }: { onGuide: (id: string) => void; onOpen: (s: ChatTarget) => void }) {
  const { t, health, serverDown } = useUi()
  const [household] = useHousehold()
  const [msgs, setMsgs] = useState<Msg[]>(history)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(waiting > 0)
  const [voice, setVoice] = useState<'' | 'listening' | 'processing'>('')
  const [voiceNote, setVoiceNote] = useState('')
  const [readAloud, setReadAloud] = useState(false)
  const [shareNote, setShareNote] = useState('')
  const [thinking, setThinking] = useState('chat.thinking')
  const [waitingOnPerson, setWaitingOnPerson] = useState(false)
  const latest = useRef({ readAloud })
  latest.current = { readAloud }
  // While the first status check is still loading, try the laptop anyway: a failed try falls back like any other.
  const laptopAi = (health ? health.models.text : true) && !serverDown
  const [phoneAi, setPhoneAi] = useState(phoneAiReady)
  const aiReady = phoneAi || laptopAi
  const canVoice = isNativeApp() && !!native()?.canListen?.()

  useEffect(() => {
    const update = () => {
      setMsgs(history)
      setBusy(waiting > 0)
    }
    listeners.add(update)
    return () => {
      listeners.delete(update)
    }
  }, [])
  useEffect(() => {
    // Show the newest bubble whole, above the typing box. If it is too tall for that, show it from its first line.
    const frame = requestAnimationFrame(() => {
      const last = document.querySelector('[data-testid="chat-log"]')?.lastElementChild
      const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0
      const typing = document.querySelector('.chat-input')?.getBoundingClientRect().height ?? 0
      const nav = document.querySelector('.bottom-nav')?.getBoundingClientRect().height ?? 0
      const box = last?.getBoundingClientRect()
      if (box && box.height > window.innerHeight - top - typing - nav - 16) window.scrollBy(0, box.top - top - 8)
      else window.scrollTo(0, document.documentElement.scrollHeight)
    })
    return () => cancelAnimationFrame(frame)
  }, [msgs, busy])
  useEffect(() => () => stopSpeaking(), [])
  useEffect(() => {
    const again = () => setPhoneAi(phoneAiReady())
    window.addEventListener('aura-ai-key', again)
    return () => window.removeEventListener('aura-ai-key', again)
  }, [])

  const ask = async (question: string, spoken: boolean) => {
    const q = question.trim().split(/\s+/).join(' ')
    if (!q) return
    const thisRound = round
    const say = (answer: AuraAnswer, phoneOnly = false) => {
      history = [...history, { id: nextId++, role: 'aura', text: answer.text, answer, phoneOnly }]
      // A late answer stays silent if the person has moved on, for example to a first-aid guide being read aloud.
      if ((spoken || latest.current.readAloud) && listeners.size > 0) {
        const urgent = answer.urgentIf?.length ? `${t('chat.urgentIf')} ${answer.urgentIf.join(', ')}.` : ''
        speak([answer.text, answer.nextStep, urgent, answer.followUp].filter(Boolean).join(' '))
      }
    }
    const asked: Msg = { id: nextId++, role: 'user', text: q }
    history = [...history, asked]
    setText('')
    const instant = onPhone(q)
    if (instant) {
      // Saved details and crisis words stay on the phone, also when the next question goes to the AI.
      const stay = instant.crisis || instant.kind === 'app'
      if (stay) asked.phoneOnly = true
      say(instant, !!stay)
      publish()
      if (instant.kind !== 'reading' || instant.action === 'call_emergency' || !hasMoreThanReading(q)) return
    }
    const convo = history
    // Everyday symptoms ("fever", "dizzy"): the guide's first steps at once; the AI adds to them when it can.
    const hints = guideHints(q)
    if (hints.length) say({ text: emergencyText(hints, t), guides: hints, action: 'none', source: 'phone' })
    const people = convo.filter((m) => m.role === 'user' && !m.phoneOnly).map((m) => m.text)
    const direct = retrieve(q)
    const evidence = direct.length ? direct : people.length > 1 ? retrieve(people.slice(-2).join(' ')) : []
    // MedlinePlus's own words, from the phone: while the AI is slow for a general question, and if the AI cannot answer.
    // Someone describing what is happening to a person gets them only with a way to call, never a topic's cheerful opening.
    const general = isGeneralQuestion(q)
    let factsShown = false
    const showFacts = () => {
      if (factsShown || hints.length || instant || !direct.length || thisRound !== round) return
      const facts = factsAnswer(direct[0], q, general)
      if (!facts) return
      factsShown = true
      say(facts)
      publish()
    }
    waiting++
    setThinking('chat.thinking')
    setWaitingOnPerson(!general)
    publish()
    const slow = window.setTimeout(() => setThinking('chat.slow'), 12000)
    const early = general ? window.setTimeout(showFacts, 6000) : 0
    const answer = await fromAi(convo, evidence)
    window.clearTimeout(slow)
    window.clearTimeout(early)
    if (thisRound !== round) return // the conversation was cleared while this was waiting
    waiting = Math.max(0, waiting - 1)
    if (answer.source === 'ai' || answer.crisis) say({ ...answer, guides: answer.guides.filter((g) => !hints.includes(g)) })
    else {
      showFacts()
      // The word rules miss many emergencies, so someone describing a person always gets a way to call when the AI fails.
      if (!hints.length && !instant) say(factsShown ? { ...answer, action: 'none' } : { ...answer, softCall: !general })
    }
    publish()
  }

  const factsAnswer = (e: Evidence, q: string, general: boolean): AuraAnswer | null => {
    const text = quickFacts(e, q, general)
    return text ? { text, guides: [], action: 'none', source: 'phone', facts: true, softCall: !general, sources: [publicSource(e)] } : null
  }

  /** What the phone can answer by itself, with no waiting. */
  const onPhone = (q: string): AuraAnswer | null => {
    const crisis = crisisText(q)
    if (crisis) return { text: crisis, guides: [], action: 'call_emergency', source: 'phone', kind: 'urgent', crisis: true }
    // Emergency words get the phone's own answer at once (call button + guide): waiting ~10 s for the AI costs time.
    const flags = redFlags(q)
    if (flags.found) return { text: emergencyText(flags.guides, t), guides: flags.guides, action: 'call_emergency', source: 'phone' }
    const reading = readingAnswer(q)
    if (reading) return reading
    const local = localAnswer(q, household, loadDoses(), t)
    return local && { ...local, kind: 'app' }
  }

  const fromAi = async (convo: Msg[], evidence: Evidence[]): Promise<AuraAnswer> => {
    const turns = convo.filter((m) => !m.phoneOnly).slice(-10).map((m) => ({ role: m.role, text: m.text }))
    let phoneError = ''
    if (phoneAi) {
      // The phone calls Muse Glimmer itself with its own internet: no laptop needed.
      const r = await askFromPhone(turns, evidence, () => setThinking('chat.retrying'))
      if ('answer' in r) return r.answer
      phoneError = r.error
    }
    if (laptopAi) {
      try {
        const r = await api.chat(turns)
        if (r.status === 'ok')
          return {
            text: r.reply,
            guides: r.guides.filter((g) => GUIDES[g]),
            action: r.action as ChatAction,
            source: r.model ? 'ai' : 'phone',
            kind: r.type,
            nextStep: r.next_step,
            why: r.why,
            urgentIf: r.urgent_if,
            followUp: r.follow_up,
            sources: r.sources,
            limits: r.limits,
            crisis: !!r.crisis || r.reply.includes(IN.crisis_line.number),
          }
      } catch {
        /* fall through to the phone's own answer */
      }
    }
    const why =
      phoneError === 'key_rejected' ? 'chat.keyRejected'
      : phoneError === 'rate_limited' ? 'chat.rateLimited'
      : phoneError === 'timeout' ? 'chat.aiSlow'
      : phoneError ? 'chat.noInternet'
      : aiReady ? 'chat.aiFailed'
      : 'chat.offline'
    return { text: t(why), guides: [], action: 'open_help', source: 'phone' }
  }

  const askRef = useRef(ask)
  askRef.current = ask
  useEffect(() => {
    const open = pending
    pending = {}
    if (open.text) void askRef.current(open.text, false)
    else if (open.voice && native()?.startVoice) native()!.startVoice!()
  }, [])
  useEffect(
    () =>
      onNativeEvent((e) => {
        if (e.type !== 'voice') return
        if (e.stage === 'listening') {
          setVoice('listening')
          setVoiceNote('')
        } else if (e.stage === 'processing') setVoice('processing')
        else if (e.stage === 'partial') setText(e.text)
        else if (e.stage === 'final') {
          setVoice('')
          if (e.text.trim()) {
            setReadAloud(true)
            void askRef.current(e.text, true)
          }
        } else if (e.stage === 'error') {
          setVoice('')
          setVoiceNote(t(`chat.voiceErr.${e.error ?? 'other'}`))
        }
      }),
    [t],
  )

  const mic = () => {
    if (voice) native()?.stopVoice?.()
    else {
      stopSpeaking()
      setVoiceNote('')
      native()?.startVoice?.()
    }
  }

  const act = async (a: ChatAction) => {
    if (a === 'nearby_hospital') openNearby('hospital')
    else if (a === 'nearby_pharmacy') openNearby('pharmacy')
    else if (a === 'share_location') {
      setShareNote(t('nearby.locating'))
      const r = await locate()
      if (!r.ok) setShareNote(t(`nearby.err.${r.reason}`))
      else setShareNote((await shareText(t('nearby.shareText', { link: r.spot.link, m: r.spot.accuracy }))) ? t('nearby.shared', { m: r.spot.accuracy }) : t('nearby.err.unknown'))
    } else if (a === 'open_help') onOpen('help')
    else if (a === 'open_medicines') onOpen('meds')
    else if (a === 'open_guard') onOpen('guard')
    else if (a === 'open_family') onOpen('family')
    else if (a === 'open_card') onOpen('card')
  }

  return (
    <div className="stack chat-screen">
      <div>
        <h1>{t('chat.title')}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {t('chat.lead')}
        </p>
      </div>
      <label className="row small" style={{ gap: 8 }}>
        <input type="checkbox" checked={readAloud} onChange={(e) => setReadAloud(e.target.checked)} />
        <span>{t('chat.readAloud')}</span>
      </label>
      <p className="tiny muted" style={{ margin: 0 }}>
        {phoneAi ? t('chat.notePhone') : laptopAi ? t('chat.noteOnline') : t('chat.noteOffline')}
      </p>
      <PhoneAiKey />
      {msgs.length > 0 && (
        <button
          className="btn ghost"
          onClick={() => {
            stopSpeaking()
            round++
            waiting = 0
            history = []
            publish()
          }}
        >
          {t('chat.clear')}
        </button>
      )}
      <div className="chat-log" aria-live="polite" data-testid="chat-log">
        {msgs.length === 0 && (
          <div className="bubble aura">
            <p>{t('chat.hello')}</p>
            <div className="chat-examples">
              {['chat.ex1', 'chat.ex2', 'chat.ex3'].map((k) => (
                <button key={k} className="chip-btn" onClick={() => void ask(t(k), false)}>
                  {t(k)}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`} data-testid={`bubble-${m.role}`}>
            {m.answer?.action === 'call_emergency' && (
              <a className="btn sos block answer-call" href={TEL_URI} data-testid="chat-call">
                <Icon name="phone" /> {t('emergency.short')}
              </a>
            )}
            {m.answer ? <AnswerBody answer={m.answer} /> : <p>{m.text}</p>}
            {m.answer && <AnswerActions answer={m.answer} onGuide={onGuide} onAct={act} />}
            {m.answer && <AnswerMore answer={m.answer} />}
            {m.answer && <span className="bubble-source">{m.answer.facts ? t('chat.sourceFacts') : m.answer.source === 'ai' ? t('chat.sourceAi') : t('chat.sourcePhone')}</span>}
          </div>
        ))}
        {busy && (
          <div className="bubble aura" data-testid="chat-busy">
            <p className="muted">{t(thinking)}</p>
            {waitingOnPerson && (
              <a className="btn secondary block" href={TEL_URI} style={{ marginTop: 8 }} data-testid="chat-wait-call">
                <Icon name="phone" /> {t('chat.dontWait')}
              </a>
            )}
          </div>
        )}
      </div>
      {shareNote && (
        <p className="small" role="status" style={{ margin: 0 }}>
          {shareNote}
        </p>
      )}
      {voice && <p className="small" style={{ margin: 0 }}>{voice === 'listening' ? t('chat.listening') : t('chat.processing')}</p>}
      {voiceNote && (
        <p className="small" role="status" style={{ margin: 0 }}>
          {voiceNote}
        </p>
      )}
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault()
          void ask(text, false)
        }}
      >
        <textarea
          className="input"
          value={text}
          maxLength={500}
          rows={text.length > 70 ? 3 : text.length > 30 ? 2 : 1}
          placeholder={voice === 'listening' ? t('chat.listening') : t('chat.placeholder')}
          aria-label={t('chat.placeholder')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void ask(text, false)
            }
          }}
          data-testid="chat-text"
        />
        {canVoice && (
          <button type="button" className={`btn mic ${voice ? 'on' : ''}`} onClick={mic} aria-pressed={!!voice} aria-label={voice ? t('chat.stopVoice') : t('chat.speak')} data-testid="chat-mic">
            <Icon name="mic" size={24} />
          </button>
        )}
        <button type="submit" className="btn primary" disabled={!text.trim()} aria-label={t('chat.send')} data-testid="chat-send">
          <Icon name="send" size={22} />
        </button>
      </form>
    </div>
  )
}

/** What to do first, from the guides' own "chat_now" lines; the call line is said once. */
function emergencyText(guides: string[], t: (k: string) => string): string {
  const lines = guides.map((g) => GUIDES[g]?.chat_now).filter((x): x is string => !!x).map(fill)
  if (!lines.length) return t('chat.emergencyCall')
  return lines.map((l, i) => (i ? l.replace(/^Call \d+ now[.:]\s*/, '') : l)).join(' ')
}

const ACTION_KEYS: Partial<Record<ChatAction, string>> = {
  open_help: 'chat.act.help',
  nearby_hospital: 'nearby.hospital',
  nearby_pharmacy: 'nearby.pharmacy',
  share_location: 'nearby.share',
  open_medicines: 'chat.act.meds',
  open_guard: 'chat.act.guard',
  open_family: 'chat.act.family',
  open_card: 'chat.act.card',
}

/** The answer as a short read: what it means, what to do next, and when it becomes urgent. */
function AnswerBody({ answer }: { answer: AuraAnswer }) {
  const { t } = useUi()
  return (
    <div className="answer">
      <p className="answer-lead">{answer.text}</p>
      {answer.nextStep && (
        <p className="answer-next">
          <strong>{t('chat.nextStep')}</strong> {answer.nextStep}
        </p>
      )}
      {!!answer.urgentIf?.length && (
        <p className="answer-urgent">
          <strong>{t('chat.urgentIf')}</strong> {answer.urgentIf.join(', ')}.
        </p>
      )}
      {answer.followUp && <p className="answer-follow">{answer.followUp}</p>}
      {answer.softCall && <p className="answer-urgent">{t('chat.factsNote')}</p>}
    </div>
  )
}

/** Reasons and sources stay one tap away. Links come from the evidence pack, never from the model's own text. */
function AnswerMore({ answer }: { answer: AuraAnswer }) {
  const { t } = useUi()
  const sources = answer.sources ?? []
  const noSource = answer.limits?.includes('no_source')
  if (!answer.why && !sources.length && !noSource) return null
  return (
    <details className="answer-more" data-testid="answer-more">
      <summary>{!sources.length ? t('chat.why') : answer.why ? t('chat.whySources', { n: sources.length }) : t('chat.sources', { n: sources.length })}</summary>
      {answer.why && <p>{answer.why}</p>}
      {noSource && <p className="small muted">{t('chat.noSource')}</p>}
      {!!sources.length && (
        <ul className="answer-sources" data-testid="answer-sources">
          {sources.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
              <span className="tiny muted">{s.publisher}</span>
            </li>
          ))}
        </ul>
      )}
      {!!sources.length && <p className="tiny muted">{t('chat.sourceNote')}</p>}
    </details>
  )
}

function AnswerActions({ answer, onGuide, onAct }: { answer: AuraAnswer; onGuide: (id: string) => void; onAct: (a: ChatAction) => void }) {
  const { t } = useUi()
  const [household] = useHousehold()
  const key = ACTION_KEYS[answer.action]
  // During the call the operator asks about the person: any saved person's health card can be read aloud.
  const main = mainPerson(household)
  const cards = answer.action === 'call_emergency'
    ? household.people.filter((p) => p.name.trim()).sort((a, b) => Number(b.id === main?.id) - Number(a.id === main?.id)).slice(0, 3)
    : []
  if (!answer.crisis && !answer.softCall && !cards.length && !answer.guides.length && !key) return null
  return (
    <div className="bubble-actions">
      {answer.softCall && (
        <a className="btn secondary" href={TEL_URI} data-testid="chat-soft-call">
          <Icon name="phone" /> {t('emergency.short')}
        </a>
      )}
      {answer.crisis && (
        <a className="btn secondary" href={IN.crisis_line.tel_uri} data-testid="chat-crisis">
          <Icon name="phone" /> {t('chat.callCrisis', { name: IN.crisis_line.name, phone: IN.crisis_line.number })}
        </a>
      )}
      {answer.guides.map((g) => (
        <button key={g} className="guide-pick suggested" onClick={() => onGuide(g)} data-testid={`chat-guide-${g}`}>
          <span className="title">{GUIDES[g]?.title}</span>
          <span className="when">{t('chat.openGuide')}</span>
        </button>
      ))}
      {key && (
        <button className="btn secondary" onClick={() => onAct(answer.action)} data-testid={`chat-act-${answer.action}`}>
          {t(key)}
        </button>
      )}
      {cards.map((card) => (
        <button key={card.id} className="btn secondary" onClick={() => speak(healthSpeech(card, t))} data-testid="chat-health">
          <Icon name="speaker" /> {t('chat.readHealth', { name: card.name })}
        </button>
      ))}
    </div>
  )
}
