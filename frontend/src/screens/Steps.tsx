import { useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError } from '../api'
import type { Point, Session } from '../types'
import { Icon, rid, useUi } from '../ui'

export const TOTAL_STEPS = 6

export interface StepProps {
  session: Session
  onSaved: (s: Session) => void
  onNext: () => void
  onBack: () => void
}

export function useSave(onSaved: (s: Session) => void) {
  const { t } = useUi()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async (patch: Record<string, unknown>) => {
    setBusy(true)
    setError('')
    try {
      onSaved((await api.patchSession(patch)).session)
      return true
    } catch (err) {
      setError(err instanceof ApiError && err.status !== 0 ? err.message : t('server.down'))
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, save }
}

export function StepFrame(props: {
  n: number
  title: string
  hint?: string
  children: ReactNode
  busy?: boolean
  error?: string
  onBack: () => void
  onNext: () => void
  nextLabel?: string
}) {
  const { t } = useUi()
  const { n, title, hint, children, busy, error, onBack, onNext, nextLabel } = props
  return (
    <section className="stack" aria-labelledby="step-title">
      <div className="progress">
        <span>{t('step.progress', { n, total: TOTAL_STEPS })}</span>
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${(n / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>
      <div>
        <h1 id="step-title">{title}</h1>
        {hint && <p className="muted">{hint}</p>}
      </div>
      {children}
      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}
      <div className="nav-row">
        <button className="btn secondary" onClick={onBack} disabled={busy}>
          {t('common.back')}
        </button>
        <button className="btn primary" onClick={onNext} disabled={busy} data-testid="next">
          {busy ? t('common.loading') : (nextLabel ?? t('common.next'))}
        </button>
      </div>
    </section>
  )
}

export function Choices({
  options,
  value,
  onChange,
  unknown = true,
  two = false,
  label,
}: {
  options: { key: string; label: string }[]
  value: string | null
  onChange: (k: string) => void
  unknown?: boolean
  two?: boolean
  label: string
}) {
  const { t } = useUi()
  return (
    <div className={`choices ${two ? 'two' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" role="radio" aria-checked={value === o.key} className="choice" onClick={() => onChange(o.key)}>
          <span className="radio" />
          {o.label}
        </button>
      ))}
      {unknown && (
        <button type="button" role="radio" aria-checked={value === 'unknown'} className="choice unknown" onClick={() => onChange('unknown')}>
          <span className="radio" />
          {t('common.unknown')}
        </button>
      )}
    </div>
  )
}

// ---------- 1. who ----------

export function Who({ session, onSaved, onNext, onBack }: StepProps) {
  const { t } = useUi()
  const [choice, setChoice] = useState<string | null>(session.who.choice)
  const [label, setLabel] = useState(session.who.label)
  const { busy, error, save } = useSave(onSaved)
  // The label describes someone else ("my father"); for "Me" it was misread as "what's wrong" in phone testing.
  const next = async () => (await save({ who: { choice, label: choice === 'someone' ? label : '' } })) && onNext()
  return (
    <StepFrame n={1} title={t('who.title')} busy={busy} error={error} onBack={onBack} onNext={next}>
      <Choices
        label={t('who.title')}
        unknown={false}
        two
        value={choice}
        onChange={setChoice}
        options={[
          { key: 'me', label: t('who.me') },
          { key: 'someone', label: t('who.someone') },
        ]}
      />
      {choice === 'someone' && (
        <div>
          <label className="field" htmlFor="who-label">
            {t('who.labelPlaceholder')}
          </label>
          <input id="who-label" className="input" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} autoComplete="off" />
          <p className="small muted">{t('who.labelHint')}</p>
        </div>
      )}
    </StepFrame>
  )
}

// ---------- 2. age ----------

const AGES = ['under1', '1to12', '13to17', '18to39', '40to64', '65plus']

export function Age({ session, onSaved, onNext, onBack }: StepProps) {
  const { t } = useUi()
  const [age, setAge] = useState<string | null>(session.age)
  const { busy, error, save } = useSave(onSaved)
  const next = async () => (await save(age ? { age } : { clear_age: true })) && onNext()
  return (
    <StepFrame n={2} title={t('age.title')} busy={busy} error={error} onBack={onBack} onNext={next}>
      <Choices label={t('age.title')} two value={age} onChange={setAge} options={AGES.map((k) => ({ key: k, label: t(`age.${k}`) }))} />
    </StepFrame>
  )
}

// ---------- 3. what ----------

export function What({ session, onSaved, onNext, onBack }: StepProps) {
  const { t, health } = useUi()
  const d = session.description
  const [text, setText] = useState(d.text)
  const [points, setPoints] = useState<Point[]>(d.points)
  const [assist, setAssist] = useState(d.assist)
  const [splitting, setSplitting] = useState(false)
  const [message, setMessage] = useState('')
  const [newPoint, setNewPoint] = useState('')
  const { busy, error, save } = useSave(onSaved)

  const onText = (v: string) => {
    setText(v)
    if (points.some((p) => p.source === 'user_split')) {
      setPoints((ps) => ps.filter((p) => p.source !== 'user_split'))
      setAssist(null)
      setMessage(t('what.edited'))
    }
  }

  const split = async () => {
    setSplitting(true)
    setMessage('')
    try {
      const r = await api.structure(text)
      setAssist({ status: r.status, model: r.model, dropped: r.dropped })
      if (r.status === 'ok') {
        // Words the helper left out are kept as the user's own words, in their place in the text.
        const leftover = r.uncovered ?? []
        const fresh: Point[] = [
          ...r.points.map((p) => ({ id: rid(), text: p.text, source: 'user_split' as const, kept: true, flag_instruction: p.flag_instruction })),
          ...leftover.map((text, i) => ({ id: rid(), text, source: 'user' as const, kept: true, flag_instruction: !!r.uncovered_flags?.[i] })),
        ]
        const at = (p: Point) => text.toLowerCase().indexOf(p.text.toLowerCase())
        fresh.sort((a, b) => at(a) - at(b))
        setPoints([...fresh, ...points.filter((p) => p.source === 'user' && !text.includes(p.text))])
        const notes = [r.dropped > 0 ? t('what.dropped', { count: r.dropped }) : '', leftover.length ? t('what.uncovered', { count: leftover.length }) : '']
        setMessage(notes.filter(Boolean).join(' '))
      } else if (r.status === 'unsupported_language') setMessage(t('what.assistLanguage'))
      else if (r.status === 'no_valid_points') setMessage(t('what.noPoints'))
      else if (r.status !== 'empty') setMessage(t('what.assistUnavailable'))
    } catch {
      setMessage(t('what.assistUnavailable'))
    } finally {
      setSplitting(false)
    }
  }

  const addPoint = () => {
    const v = newPoint.trim()
    if (!v) return
    setPoints((ps) => [...ps, { id: rid(), text: v, source: 'user', kept: true }])
    setNewPoint('')
  }
  const toggle = (id: string) => setPoints((ps) => ps.map((p) => (p.id === id ? { ...p, kept: !p.kept } : p)))
  const next = async () => (await save({ description: { text, points, assist } })) && onNext()

  return (
    <StepFrame n={3} title={t('what.title')} hint={t('what.hint')} busy={busy || splitting} error={error} onBack={onBack} onNext={next}>
      <div>
        <label className="sr-only" htmlFor="what-text">
          {t('what.title')}
        </label>
        <textarea id="what-text" className="input" value={text} maxLength={2000} placeholder={t('what.placeholder')} onChange={(e) => onText(e.target.value)} />
      </div>
      {text.trim() && (
        <div className="card flat stack">
          <button className="btn secondary block" onClick={split} disabled={splitting} data-testid="split">
            {splitting ? t('common.loading') : t('what.assist')}
          </button>
          <p className="small muted" style={{ margin: 0 }}>
            {health?.models.ai_online ? t('what.assistNoteOnline') : t('what.assistNote')}
          </p>
        </div>
      )}
      {message && (
        <div className="banner info" role="status">
          <Icon name="info" />
          <span>{message}</span>
        </div>
      )}
      {points.length > 0 && (
        <section className="card flat" data-testid="points">
          <h2>{t('what.pointsTitle')}</h2>
          <p className="small muted">{t('what.pointsHint')}</p>
          <div className="points">
            {points.map((p) => (
              <div key={p.id} className={`point ${p.kept ? '' : 'removed'}`}>
                <div style={{ flex: 1 }}>
                  <q>{p.text}</q>
                  <div className="row" style={{ marginTop: 6 }}>
                    <span className="chip user">{p.source === 'user_split' ? t('prov.userSplit') : t('prov.user')}</span>
                  </div>
                  {p.flag_instruction && (
                    <div className="banner warn small" style={{ marginTop: 8 }}>
                      <Icon name="alert" />
                      <span>{t('what.flag')}</span>
                    </div>
                  )}
                </div>
                <button className="btn ghost" onClick={() => toggle(p.id)}>
                  {p.kept ? t('common.remove') : t('common.undo')}
                </button>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12, flexWrap: 'nowrap' }}>
            <input
              className="input"
              value={newPoint}
              placeholder={t('what.addPoint')}
              aria-label={t('what.addPoint')}
              onChange={(e) => setNewPoint(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPoint()}
            />
            <button className="btn secondary" onClick={addPoint} aria-label={t('common.add')}>
              <Icon name="plus" />
            </button>
          </div>
          <button
            className="btn ghost"
            style={{ marginTop: 8 }}
            onClick={() => {
              setPoints([])
              setAssist(null)
              setMessage('')
            }}
          >
            {t('what.keepWhole')}
          </button>
        </section>
      )}
    </StepFrame>
  )
}

// ---------- 4. onset ----------

const ONSETS = ['lt15', '15to60', '1to6h', 'gt6h', 'other']

export function Onset({ session, onSaved, onNext, onBack }: StepProps) {
  const { t } = useUi()
  const [choice, setChoice] = useState<string | null>(session.onset.choice)
  const [other, setOther] = useState(session.onset.other_text)
  const { busy, error, save } = useSave(onSaved)
  const next = async () => (await save({ onset: { choice, other_text: choice === 'other' ? other : '' } })) && onNext()
  return (
    <StepFrame n={4} title={t('onset.title')} busy={busy} error={error} onBack={onBack} onNext={next}>
      <Choices label={t('onset.title')} value={choice} onChange={setChoice} options={ONSETS.map((k) => ({ key: k, label: t(`onset.${k}`) }))} />
      {choice === 'other' && (
        <div>
          <label className="field" htmlFor="onset-other">
            {t('onset.other')}
          </label>
          <input id="onset-other" className="input" value={other} maxLength={200} onChange={(e) => setOther(e.target.value)} />
        </div>
      )}
    </StepFrame>
  )
}

// ---------- 5. details ----------

const DETAILS = ['allergies', 'medicines', 'conditions', 'other'] as const

export function Details({ session, onSaved, onNext, onBack }: StepProps) {
  const { t } = useUi()
  const [values, setValues] = useState(session.details)
  const { busy, error, save } = useSave(onSaved)
  const next = async () => (await save({ details: values })) && onNext()
  return (
    <StepFrame n={5} title={t('details.title')} hint={t('details.hint')} busy={busy} error={error} onBack={onBack} onNext={next}>
      <div>
        {DETAILS.map((k) => (
          <div key={k}>
            <label className="field" htmlFor={`d-${k}`}>
              {t(`details.${k}`)}
            </label>
            {k === 'other' ? (
              <textarea id={`d-${k}`} className="input" style={{ minHeight: 90 }} maxLength={500} value={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
            ) : (
              <input id={`d-${k}`} className="input" maxLength={500} value={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} autoComplete="off" />
            )}
          </div>
        ))}
      </div>
    </StepFrame>
  )
}
