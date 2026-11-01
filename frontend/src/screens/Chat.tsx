import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { localAnswer, redFlags } from '../chatlocal'
import type { AuraAnswer, ChatAction } from '../chatlocal'
import { GUIDES } from '../guides'
import { loadDoses, useHousehold } from '../household'
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

// Kept while the app is open, so going to a guide and back keeps the conversation. Never saved.
let history: Msg[] = []
let nextId = 1

export type ChatTarget = 'help' | 'meds' | 'guard' | 'family' | 'card'

export function Chat({ onGuide, onOpen }: { onGuide: (id: string) => void; onOpen: (s: ChatTarget) => void }) {
  const { t, health, serverDown } = useUi()
  const [household] = useHousehold()
  const [msgs, setMsgs] = useState<Msg[]>(history)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [voice, setVoice] = useState<'' | 'listening' | 'processing'>('')
  const [voiceNote, setVoiceNote] = useState('')
  const [readAloud, setReadAloud] = useState(false)
  const [shareNote, setShareNote] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const latest = useRef({ msgs, readAloud })
  latest.current = { msgs, readAloud }
  const aiReady = !!health?.models.text && !serverDown
  const canVoice = isNativeApp() && !!native()?.canListen?.()

  useEffect(() => {
    history = msgs
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs])
  useEffect(() => () => stopSpeaking(), [])

  const ask = async (question: string, spoken: boolean) => {
    const q = question.trim()
    if (!q || busy) return
    const user: Msg = { id: nextId++, role: 'user', text: q }
    const convo = [...latest.current.msgs, user]
    setMsgs(convo)
    setText('')
    setBusy(true)
    const answer = await respond(convo, q)
    setBusy(false)
    setMsgs((m) => [...m, { id: nextId++, role: 'aura', text: answer.text, answer }])
    if (spoken || latest.current.readAloud) speak(answer.text)
  }

  const respond = async (convo: Msg[], q: string): Promise<AuraAnswer> => {
    // Emergency words get the phone's own answer at once (call button + guide): waiting ~10 s for the AI costs time.
    const flags = redFlags(q)
    if (flags.found) return { text: t('chat.emergency'), guides: flags.guides, action: 'call_emergency', source: 'phone' }
    const local = localAnswer(q, household, loadDoses(), t)
    if (local) return local
    if (aiReady) {
      try {
        const r = await api.chat(convo.slice(-10).map((m) => ({ role: m.role, text: m.text })))
        if (r.status === 'ok') return { text: r.reply, guides: r.guides.filter((g) => GUIDES[g]), action: r.action as ChatAction, source: 'ai' }
      } catch {
        /* fall through to the phone's own answer */
      }
    }
    return { text: aiReady ? t('chat.aiFailed') : t('chat.offline'), guides: [], action: 'open_help', source: 'phone' }
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
            <p className="muted">{t('chat.thinking')}</p>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {shareNote && (
        <p className="small" role="status" style={{ margin: 0 }}>
          {shareNote}
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
          rows={2}
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
        <div className="chat-buttons">
          {canVoice && (
            <button type="button" className={`btn mic ${voice ? 'on' : ''}`} onClick={mic} aria-pressed={!!voice} aria-label={voice ? t('chat.stopVoice') : t('chat.speak')} data-testid="chat-mic">
              <Icon name="mic" size={24} />
            </button>
          )}
          <button type="submit" className="btn primary" disabled={busy || !text.trim()} data-testid="chat-send">
            {t('chat.send')}
          </button>
        </div>
      </form>
      {voice && <p className="small" style={{ margin: 0 }}>{voice === 'listening' ? t('chat.listening') : t('chat.processing')}</p>}
      {voiceNote && (
        <p className="small" role="status" style={{ margin: 0 }}>
          {voiceNote}
        </p>
      )}
      <label className="row small" style={{ gap: 8 }}>
        <input type="checkbox" checked={readAloud} onChange={(e) => setReadAloud(e.target.checked)} />
        <span>{t('chat.readAloud')}</span>
      </label>
      <p className="tiny muted" style={{ margin: 0 }}>
        {aiReady ? t('chat.noteOnline') : t('chat.noteOffline')}
      </p>
      {msgs.length > 0 && (
        <button
          className="btn ghost"
          onClick={() => {
            stopSpeaking()
            setMsgs([])
          }}
        >
          {t('chat.clear')}
        </button>
      )}
    </div>
  )
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
  const key = ACTION_KEYS[answer.action]
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
    </div>
  )
}
