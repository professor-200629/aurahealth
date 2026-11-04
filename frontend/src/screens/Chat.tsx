import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { askFromPhone, phoneAiReady } from '../aura'
import { guideHints, localAnswer, redFlags } from '../chatlocal'
import { readingAnswer } from '../readings'
import type { AuraAnswer, ChatAction } from '../chatlocal'
import { PhoneAiKey } from '../components/PhoneAiKey'
import { healthSpeech } from '../components/HealthCard'
import { fill, GUIDES } from '../guides'
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
}

// Kept while the app is open, so going to a guide and back keeps the conversation, and an answer that arrives
// after the person left this screen is still there when they come back. Never saved.
let history: Msg[] = []
let waiting = 0 // questions still waiting for the AI; a new question is never blocked by them
let nextId = 1
const listeners = new Set<() => void>()
const publish = () => listeners.forEach((fn) => fn())

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
  const latest = useRef({ readAloud })
  latest.current = { readAloud }
  const laptopAi = !!health?.models.text && !serverDown
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
    // The very end of the page: the newest answer and its Call button then sit fully above the typing box.
    const frame = requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight))
    return () => cancelAnimationFrame(frame)
  }, [msgs, busy])
  useEffect(() => () => stopSpeaking(), [])
  useEffect(() => {
    const again = () => setPhoneAi(phoneAiReady())
    window.addEventListener('aura-ai-key', again)
    return () => window.removeEventListener('aura-ai-key', again)
  }, [])

  const ask = async (question: string, spoken: boolean) => {
    const q = question.trim()
    if (!q) return
    const say = (answer: AuraAnswer) => {
      history = [...history, { id: nextId++, role: 'aura', text: answer.text, answer }]
      if (spoken || latest.current.readAloud) speak(answer.text)
    }
    history = [...history, { id: nextId++, role: 'user', text: q }]
    const convo = history
    setText('')
    const instant = onPhone(q)
    if (instant) {
      say(instant)
      publish()
      return
    }
    // Everyday symptoms ("fever", "dizzy"): the guide's first steps at once; the AI adds to them when it can.
    const hints = guideHints(q)
    if (hints.length) say({ text: emergencyText(hints, t), guides: hints, action: 'none', source: 'phone' })
    waiting++
    setThinking('chat.thinking')
    publish()
    const slow = window.setTimeout(() => setThinking('chat.slow'), 12000)
    const answer = await fromAi(convo)
    window.clearTimeout(slow)
    waiting = Math.max(0, waiting - 1)
    if (answer.source === 'ai') say({ ...answer, guides: answer.guides.filter((g) => !hints.includes(g)) })
    else if (!hints.length) say(answer) // "the AI could not answer" is not worth saying when the guide is already there
    publish()
  }

  /** What the phone can answer by itself, with no waiting. */
  const onPhone = (q: string): AuraAnswer | null => {
    // Emergency words get the phone's own answer at once (call button + guide): waiting ~10 s for the AI costs time.
    const flags = redFlags(q)
    if (flags.found) return { text: emergencyText(flags.guides, t), guides: flags.guides, action: 'call_emergency', source: 'phone' }
    return readingAnswer(q) ?? localAnswer(q, household, loadDoses(), t)
  }

  const fromAi = async (convo: Msg[]): Promise<AuraAnswer> => {
    const turns = convo.slice(-10).map((m) => ({ role: m.role, text: m.text }))
    let phoneError = ''
    if (phoneAi) {
      // The phone calls Muse Glimmer itself with its own internet: no laptop needed.
      const r = await askFromPhone(turns, () => setThinking('chat.retrying'))
      if ('answer' in r) return r.answer
      phoneError = r.error
    }
    if (laptopAi) {
      try {
        const r = await api.chat(turns)
        if (r.status === 'ok') return { text: r.reply, guides: r.guides.filter((g) => GUIDES[g]), action: r.action as ChatAction, source: 'ai' }
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
            <p>{m.text}</p>
            {m.answer && <AnswerActions answer={m.answer} onGuide={onGuide} onAct={act} />}
            {m.answer && <span className="bubble-source">{m.answer.source === 'ai' ? t('chat.sourceAi') : t('chat.sourcePhone')}</span>}
          </div>
        ))}
        {busy && (
          <div className="bubble aura" data-testid="chat-busy">
            <p className="muted">{t(thinking)}</p>
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

function AnswerActions({ answer, onGuide, onAct }: { answer: AuraAnswer; onGuide: (id: string) => void; onAct: (a: ChatAction) => void }) {
  const { t } = useUi()
  const [household] = useHousehold()
  const key = ACTION_KEYS[answer.action]
  // During the call the operator asks about the person: any saved person's health card can be read aloud.
  const main = mainPerson(household)
  const cards = answer.action === 'call_emergency'
    ? household.people.filter((p) => p.name.trim()).sort((a, b) => Number(b.id === main?.id) - Number(a.id === main?.id)).slice(0, 3)
    : []
  if (answer.action !== 'call_emergency' && !answer.guides.length && !key) return null
  return (
    <div className="bubble-actions">
      {answer.action === 'call_emergency' && (
        <a className="btn sos" href={TEL_URI} data-testid="chat-call">
          <Icon name="phone" /> {t('emergency.short')}
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
