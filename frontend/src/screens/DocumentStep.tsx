import { useEffect, useRef, useState } from 'react'
import { api, ApiError, imageUrl, sampleUrl } from '../api'
import type { DocField, Session } from '../types'
import { Icon, rid, useUi } from '../ui'
import { StepFrame } from './Steps'
import type { StepProps } from './Steps'

const SAMPLE_LABELS: Record<string, string> = {
  clear_report: 'Clear',
  blurry_report: 'Blurry',
  missing_date_report: 'Missing date',
  instruction_report: 'Hidden instruction',
  phone_photo_report: 'Phone photo',
  medicine_strip: 'Medicine strip',
}

export function DocumentStep({ session, onSaved, onNext, onBack }: StepProps) {
  const { t, health } = useUi()
  const doc = session.document
  const status = doc?.extraction.status ?? 'not_started'
  const [samples, setSamples] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<DocField[]>(doc?.fields ?? [])
  const [current, setCurrent] = useState<'yes' | 'no' | null>(doc?.current ?? null)
  const [manual, setManual] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newValue, setNewValue] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  // Take the server's fields whenever a different document arrives or a reading finishes.
  useEffect(() => {
    setFields(doc?.fields ?? [])
    setCurrent(doc?.current ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, status])

  useEffect(() => {
    api.samples().then((r) => setSamples(r.samples), () => setSamples([]))
  }, [])

  // While the laptop reads the report, poll the job and show real elapsed time.
  useEffect(() => {
    const job = doc?.extraction.job
    if (status !== 'running' || !job) return
    const started = Date.now()
    setElapsed(0)
    const tick = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000)
    const poll = window.setInterval(async () => {
      try {
        const r = await api.extractStatus(job)
        if (r.status !== 'running') onSaved(r.session)
      } catch {
        /* keep polling; the server may be busy with the model */
      }
    }, 2500)
    return () => {
      window.clearInterval(tick)
      window.clearInterval(poll)
    }
  }, [status, doc?.extraction.job, onSaved])

  const run = async (fn: () => Promise<{ session?: Session }>, failKey = 'server.down') => {
    setBusy(true)
    setError('')
    try {
      const r = await fn()
      if (r.session) onSaved(r.session)
      return true
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? t('doc.uploadFailed') : t(failKey))
      return false
    } finally {
      setBusy(false)
    }
  }

  const onFile = (f: File | undefined) => f && run(() => api.upload(f))
  const pickSample = (name: string) => run(() => api.useSample(name))
  const removeDoc = () => {
    setManual(false)
    run(() => api.removeDocument())
  }
  const online = !!health?.models.online_reader
  const local = !!health?.models.vision_runnable
  const read = (engine: 'local' | 'online') =>
    run(async () => {
      const r = await api.extract(engine)
      if (r.session) return r
      return api.getSession().then((s) => ({ session: s.session ?? undefined }))
    })

  const persist = (next: DocField[], nextCurrent = current) => {
    setFields(next)
    return run(() => api.saveFields(next.map(({ id, label, value, status }) => ({ id, label, value, status })), nextCurrent))
  }
  const setValue = (id: string, value: string) => setFields((fs) => fs.map((f) => (f.id === id ? { ...f, value } : f)))
  const setStatus = (id: string, s: DocField['status']) => persist(fields.map((f) => (f.id === id ? { ...f, status: s } : f)))
  const addField = () => {
    if (!newLabel.trim() || !newValue.trim()) return
    const f: DocField = { id: rid(), label: newLabel.trim(), value: newValue.trim(), model_value: null, status: 'confirmed', origin: 'user', flag_instruction: false }
    setNewLabel('')
    setNewValue('')
    persist([...fields, f])
  }
  const answerCurrent = (c: 'yes' | 'no') => {
    setCurrent(c)
    persist(fields, c)
  }
  const next = async () => {
    if (doc && !(await persist(fields))) return
    onNext()
  }

  const confirmedCount = fields.filter((f) => f.status === 'confirmed').length
  const showFields = doc && (status === 'done' || status === 'no_fields' || status === 'failed' || status === 'reader_missing' || manual || fields.length > 0)
  const timing = doc?.extraction.timing

  return (
    <StepFrame n={6} title={t('doc.title')} hint={doc ? undefined : t('doc.hint')} busy={busy} error={error} onBack={onBack} onNext={next} nextLabel={doc ? undefined : t('doc.skip')}>
      {!doc && (
        <div className="stack">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} data-testid="file-input" />
          <button className="btn secondary block" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Icon name="doc" /> {t('doc.choose')}
          </button>
          {samples.length > 0 && (
            <section>
              <h2>{t('doc.sample')}</h2>
              <div className="samples">
                {samples.map((s) => (
                  <button key={s} className="sample" onClick={() => pickSample(s)} disabled={busy} data-testid={`sample-${s}`}>
                    <img src={sampleUrl(s)} alt="" loading="lazy" />
                    <span>{SAMPLE_LABELS[s] ?? s}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {doc && (
        <div className="studio">
          <figure className="doc-view" style={{ margin: 0 }}>
            <a href={imageUrl(doc.id)} target="_blank" rel="noreferrer">
              <img src={imageUrl(doc.id)} alt={t('doc.original')} />
            </a>
            <figcaption className="caption">
              <span>{doc.is_sample ? t('doc.sampleBadge') : t('doc.original')}</span>
              <span>
                {doc.width}×{doc.height}
              </span>
            </figcaption>
          </figure>

          <div className="stack">
            {status === 'not_started' && !manual && fields.length === 0 && (
              <div className="stack">
                {online && (
                  <>
                    <button className="btn primary block" onClick={() => read('online')} disabled={busy} data-testid="read-online">
                      {t('doc.readOnline')}
                    </button>
                    <p className="small muted" style={{ margin: 0 }}>
                      {t('doc.onlineNote')}
                    </p>
                  </>
                )}
                {local && (
                  <button className={`btn ${online ? 'secondary' : 'primary'} block`} onClick={() => read('local')} disabled={busy} data-testid="read">
                    {t('doc.readLocal')}
                  </button>
                )}
                {!online && !local && <Banner kind="info" text={t('doc.noReader')} />}
                <button className="btn secondary block" onClick={() => setManual(true)} disabled={busy}>
                  {t('doc.manual')}
                </button>
              </div>
            )}

            {status === 'running' && (
              <div className="card flat reading" role="status" data-testid="reading">
                <span className="spinner" />
                <div>
                  <div>{t('doc.reading')}</div>
                  <div className="small muted">{t('doc.elapsed', { seconds: elapsed })}</div>
                </div>
              </div>
            )}

            {status === 'reader_missing' && <Banner kind="warn" text={t('doc.readerMissing')} />}
            {(status === 'failed' || status === 'no_fields') && <Banner kind="warn" text={t('doc.readFailed')} />}
            {status === 'done' && timing && (
              <p className="small muted">
                {t('doc.timing', { seconds: timing.wall_s, model: doc.extraction.model ?? '' })}
                {timing.cost_usd != null && ` ${t('doc.cost', { cost: timing.cost_usd.toFixed(4) })}`}
              </p>
            )}

            {showFields && (
              <section className="stack" data-testid="fields">
                <div>
                  <h2>{t('doc.fieldsTitle')}</h2>
                  {fields.some((f) => f.origin === 'model') && <Banner kind="warn" text={t('doc.warning')} />}
                </div>
                {fields.length === 0 && <p className="muted">{t('doc.noFieldsYet')}</p>}
                <div className="fields">
                  {fields.map((f) => (
                    <FieldRow key={f.id} f={f} onValue={(v) => setValue(f.id, v)} onStatus={(s) => setStatus(f.id, s)} disabled={busy} />
                  ))}
                </div>
                <div className="card flat">
                  <h3>{t('doc.addField')}</h3>
                  <label className="field" htmlFor="nf-label">
                    {t('doc.fieldLabel')}
                  </label>
                  <input id="nf-label" className="input" value={newLabel} maxLength={80} onChange={(e) => setNewLabel(e.target.value)} autoComplete="off" />
                  <label className="field" htmlFor="nf-value">
                    {t('doc.fieldValue')}
                  </label>
                  <input id="nf-value" className="input" value={newValue} maxLength={300} onChange={(e) => setNewValue(e.target.value)} autoComplete="off" />
                  <button className="btn secondary" style={{ marginTop: 12 }} onClick={addField} disabled={busy || !newLabel.trim() || !newValue.trim()}>
                    <Icon name="plus" /> {t('common.add')}
                  </button>
                </div>
                {confirmedCount > 0 && (
                  <div className="card flat">
                    <h3>{t('doc.reportDateQuestion')}</h3>
                    <div className="choices two" role="radiogroup" aria-label={t('doc.reportDateQuestion')}>
                      <button type="button" role="radio" aria-checked={current === 'yes'} className="choice" onClick={() => answerCurrent('yes')}>
                        <span className="radio" />
                        {t('doc.reportDateYes')}
                      </button>
                      <button type="button" role="radio" aria-checked={current === 'no'} className="choice" onClick={() => answerCurrent('no')}>
                        <span className="radio" />
                        {t('doc.reportDateNo')}
                      </button>
                    </div>
                  </div>
                )}
                <p className="small muted">{t('doc.unconfirmedNote')}</p>
              </section>
            )}

            <button className="btn ghost" onClick={removeDoc} disabled={busy}>
              {t('doc.removeDoc')}
            </button>
          </div>
        </div>
      )}
    </StepFrame>
  )
}

function Banner({ kind, text }: { kind: 'warn' | 'info' | 'error'; text: string }) {
  return (
    <div className={`banner ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon name={kind === 'info' ? 'info' : 'alert'} />
      <span>{text}</span>
    </div>
  )
}

function FieldRow({ f, onValue, onStatus, disabled }: { f: DocField; onValue: (v: string) => void; onStatus: (s: DocField['status']) => void; disabled: boolean }) {
  const { t } = useUi()
  const corrected = f.origin === 'model' && f.value !== f.model_value
  return (
    <div className={`fieldrow ${f.status}`} data-testid="field-row">
      <div className="row between">
        <span className="label">{f.label}</span>
        {f.status === 'confirmed' && (
          <span className={`chip ${corrected ? 'corrected' : 'ok'}`}>
            <Icon name="check" size={14} />
            {corrected ? t('doc.corrected') : f.origin === 'user' ? t('prov.user') : t('doc.confirmed')}
          </span>
        )}
      </div>
      {f.origin === 'model' && (
        <div className="modelread">
          {t('doc.modelRead')}: <b>{f.model_value || '—'}</b>
        </div>
      )}
      {f.flag_instruction && (
        <div className="banner warn small" style={{ marginBottom: 8 }}>
          <Icon name="alert" />
          <span>{t('doc.flag')}</span>
        </div>
      )}
      <label className="sr-only" htmlFor={`fv-${f.id}`}>
        {t('doc.yourValue')}: {f.label}
      </label>
      <input
        id={`fv-${f.id}`}
        className="input"
        value={f.value}
        readOnly={f.status !== 'proposed'}
        maxLength={300}
        onChange={(e) => onValue(e.target.value)}
      />
      <div className="actions">
        {f.status === 'proposed' && (
          <button className="btn primary" onClick={() => onStatus('confirmed')} disabled={disabled || !f.value.trim()} data-testid="confirm-field">
            <Icon name="check" /> {t('doc.confirm')}
          </button>
        )}
        {f.status === 'confirmed' && (
          <button className="btn secondary" onClick={() => onStatus('proposed')} disabled={disabled}>
            {t('common.edit')}
          </button>
        )}
        {f.status !== 'removed' ? (
          <button className="btn secondary" onClick={() => onStatus('removed')} disabled={disabled}>
            {t('common.remove')}
          </button>
        ) : (
          <button className="btn secondary" onClick={() => onStatus('proposed')} disabled={disabled}>
            {t('common.undo')}
          </button>
        )}
      </div>
    </div>
  )
}
