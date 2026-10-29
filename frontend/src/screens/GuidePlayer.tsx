import { useEffect, useRef, useState } from 'react'
import { logEvent, pendingCount, subscribe } from '../eventlog'
import type { PendingEvent } from '../eventlog'
import { fill, GUIDES } from '../guides'
import type { GuideChoice } from '../guides'
import { TEL_URI } from '../i18n'
import { canSpeak, speak, stopSpeaking } from '../speech'
import { Icon, useUi } from '../ui'

interface Props {
  guideId: string
  onGuide: (id: string) => void
  onList: () => void
  onCard: () => void
}

const VOICE_KEY = 'aura.voice'
const readVoice = () => {
  try {
    return window.localStorage.getItem(VOICE_KEY) !== 'off'
  } catch {
    return true
  }
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

// React StrictMode mounts twice in development; this keeps one "opened the guide" entry per real opening.
let lastOpened = { guide: '', at: 0 }

export function GuidePlayer({ guideId, onGuide, onList, onCard }: Props) {
  const { t } = useUi()
  const guide = GUIDES[guideId]
  const [idx, setIdx] = useState(0)
  const [finished, setFinished] = useState(false)
  const [voice, setVoice] = useState(readVoice)
  const [savedAt, setSavedAt] = useState('')
  const [stepLogged, setStepLogged] = useState(false)
  const [pending, setPending] = useState(pendingCount())
  const step = guide?.steps[idx]

  useEffect(() => subscribe(setPending), [])

  useEffect(() => {
    if (!guide) return
    if (lastOpened.guide !== guide.id || Date.now() - lastOpened.at > 1500) {
      logEvent({ kind: 'guide_open', guide: guide.id })
      lastOpened = { guide: guide.id, at: Date.now() }
    }
  }, [guide])

  useEffect(() => {
    if (voice && step && !finished) speak(fill(step.text))
  }, [guideId, idx, voice, finished, step])

  useEffect(() => {
    setStepLogged(false)
  }, [idx])

  // Keep the screen on while someone is following steps (works where the browser allows a wake lock).
  useEffect(() => {
    let lock: { release?: () => void } | undefined
    const nav = navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release?: () => void }> } }
    nav.wakeLock?.request('screen').then((l) => (lock = l), () => undefined)
    return () => {
      lock?.release?.()
      stopSpeaking()
    }
  }, [])

  if (!guide || !step) {
    return (
      <div className="stack">
        <p>Unknown guide.</p>
        <button className="btn secondary" onClick={onList}>
          {t('guide.allGuides')}
        </button>
      </div>
    )
  }

  const stamp = (ev: Omit<PendingEvent, 'id' | 'at'>) => setSavedAt(clock(logEvent(ev).at))
  const goNext = () => (idx + 1 < guide.steps.length ? setIdx(idx + 1) : setFinished(true))
  const go = (target: string) => {
    if (target === 'next') return goNext()
    if (target === 'list') return onList()
    if (target.startsWith('guide:')) return onGuide(target.slice(6))
    const i = guide.steps.findIndex((s) => s.id === target)
    if (i >= 0) setIdx(i)
  }
  const done = () => {
    if (step.kind !== 'cpr' && !stepLogged) stamp({ kind: 'done', guide: guide.id, step: step.id })
    if (step.end) setFinished(true)
    else goNext()
  }
  const choose = (c: GuideChoice) => {
    stamp({ kind: 'choice', guide: guide.id, step: step.id, choice: c.id })
    go(c.goto)
  }
  const back = () => {
    if (finished) setFinished(false)
    else if (idx > 0) setIdx(idx - 1)
    else onList()
  }
  const toggleVoice = () => {
    const next = !voice
    setVoice(next)
    if (!next) stopSpeaking()
    try {
      window.localStorage.setItem(VOICE_KEY, next ? 'on' : 'off')
    } catch {
      /* preference is only kept for this visit */
    }
  }

  return (
    <section className="stack guide" aria-labelledby="guide-title">
      <div className="row between">
        <button className="btn ghost" onClick={onList}>
          ← {t('guide.allGuides')}
        </button>
        {canSpeak() && (
          <button className="voice-toggle" aria-pressed={voice} onClick={toggleVoice} data-testid="voice-toggle">
            {t('guide.voice')}: {voice ? 'on' : 'off'}
          </button>
        )}
      </div>
      <div>
        {!finished && (
          <div className="progress">
            <span>{t('guide.step', { n: idx + 1, total: guide.steps.length })}</span>
            <div className="progress-track" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${((idx + 1) / guide.steps.length) * 100}%` }} />
            </div>
          </div>
        )}
        <h1 id="guide-title" className="guide-title">
          {guide.title}
        </h1>
      </div>

      {!finished ? (
        <div className="card step-card" data-testid="guide-step" data-step={step.id}>
          <p className="step-text" aria-live="polite">
            {fill(step.text)}
          </p>
          {step.kind === 'call' && (
            <a
              className="btn sos block"
              href={TEL_URI}
              onClick={() => {
                stamp({ kind: 'done', guide: guide.id, step: step.id })
                setStepLogged(true)
              }}
            >
              <Icon name="phone" size={24} /> {t('emergency.button')}
            </a>
          )}
          {step.kind === 'cpr' && (
            <CprBeat
              onStart={() => stamp({ kind: 'cpr_start', guide: guide.id, step: step.id })}
              onStop={() => stamp({ kind: 'cpr_stop', guide: guide.id, step: step.id })}
            />
          )}
          {step.kind === 'question' ? (
            <>
              <div className="choices">
                {step.choices?.map((c) => (
                  <button key={c.id} className="choice" onClick={() => choose(c)} data-testid={`choice-${c.id}`}>
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="nav-row">
                <button className="btn secondary" onClick={back}>
                  {t('common.back')}
                </button>
              </div>
            </>
          ) : (
            <div className="nav-row">
              <button className="btn secondary" onClick={back}>
                {t('common.back')}
              </button>
              {step.optional && (
                <button className="btn secondary" onClick={goNext}>
                  {t('guide.notNeeded')}
                </button>
              )}
              <button className="btn primary" onClick={done} data-testid="step-done">
                {step.kind === 'cpr' || (step.kind === 'call' && stepLogged) ? t('guide.next') : t('guide.done')}
              </button>
            </div>
          )}
          <div className="row between" style={{ marginTop: 10 }}>
            {canSpeak() ? (
              <button className="btn ghost" onClick={() => speak(fill(step.text))}>
                {t('guide.readAgain')}
              </button>
            ) : (
              <span />
            )}
            {savedAt && <span className="small muted">{t('guide.saved', { time: savedAt })}</span>}
          </div>
        </div>
      ) : (
        <div className="card step-card" data-testid="guide-finished">
          <p className="step-text">{t('guide.finished')}</p>
          <div className="stack">
            <button className="btn primary block" onClick={onCard} data-testid="open-card">
              {t('guide.openCard')}
            </button>
            <button className="btn secondary block" onClick={back}>
              {t('common.back')}
            </button>
          </div>
        </div>
      )}

      {guide.links?.map((link) => (
        <button key={link.goto} className="btn secondary block link-btn" onClick={() => go(link.goto)}>
          {link.label} →
        </button>
      ))}

      {guide.do_not.length > 0 && (
        <section className="donot" aria-label={t('guide.doNot')}>
          <h3>{t('guide.doNot')}</h3>
          <ul>
            {guide.do_not.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
      )}
      {guide.notes.length > 0 && (
        <details className="notes">
          <summary>{t('guide.goodToKnow')}</summary>
          <ul>
            {guide.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      )}
      {pending > 0 && (
        <div className="banner info small" role="status" data-testid="pending">
          {t('guide.pending', { count: pending })}
        </div>
      )}
      <p className="tiny muted">
        Adapted from the IFRC 2020 first aid guidelines, pages {guide.source_pages}. Not yet reviewed by a clinician. AuraHealth does
        not diagnose.
      </p>
    </section>
  )
}

/** A steady beat to push on: 110 per minute, inside the 100–120 the IFRC guidelines give. */
function CprBeat({ onStart, onStop }: { onStart: () => void; onStop: () => void }) {
  const { t } = useUi()
  const [running, setRunning] = useState(false)
  const [beats, setBeats] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const audio = useRef<AudioContext | null>(null)
  const runningRef = useRef(false)
  const stopRef = useRef(onStop)
  stopRef.current = onStop

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setBeats((b) => b + 1)
      setElapsed((e) => e + 60000 / 110)
      click(audio.current)
    }, 60000 / 110)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(
    () => () => {
      if (runningRef.current) stopRef.current()
    },
    [],
  )

  const start = () => {
    try {
      audio.current = audio.current ?? new AudioContext()
      void audio.current.resume()
    } catch {
      audio.current = null
    }
    stopSpeaking()
    runningRef.current = true
    setRunning(true)
    onStart()
  }
  const pause = () => {
    runningRef.current = false
    setRunning(false)
    onStop()
  }
  const minutes = `${Math.floor(elapsed / 60000)}:${String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0')}`

  return (
    <div className="cpr" data-testid="cpr-beat">
      <div className="cpr-dot-wrap" aria-hidden="true">
        <div key={beats} className={`cpr-dot ${running ? 'on' : ''}`} />
      </div>
      <div className="cpr-info">
        <div className="small muted">{t('cpr.count', { count: beats, minutes })}</div>
        {running ? (
          <button className="btn secondary" onClick={pause} data-testid="cpr-pause">
            {t('cpr.pause')}
          </button>
        ) : (
          <button className="btn primary" onClick={start} data-testid="cpr-start">
            {t('cpr.start')}
          </button>
        )}
      </div>
    </div>
  )
}

function click(ctx: AudioContext | null) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = 880
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.09)
}
