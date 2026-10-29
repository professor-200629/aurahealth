import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, imageUrl } from '../api'
import { EmergencyCard } from '../components/EmergencyCard'
import { EMERGENCY_NUMBER } from '../i18n'
import { itemText, provClass, provLabel, regionName, SECTIONS, sectionOf, sectionTitle, toPlainText, unknownLabel } from '../handoffText'
import type { Handoff, HandoffItem, Session } from '../types'
import { Dual, Icon, Sheet, useUi } from '../ui'

interface Props {
  session: Session
  onEdit: () => void
  onDeleted: () => void
}

export function Review({ session, onEdit, onDeleted }: Props) {
  const { t, lang } = useUi()
  const [handoff, setHandoff] = useState<Handoff | null>(null)
  const [error, setError] = useState('')
  const [preparedAt, setPreparedAt] = useState(() => new Date())
  const [evidence, setEvidence] = useState<HandoffItem | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.handoff().then(
      (h) => {
        setHandoff(h)
        setPreparedAt(new Date())
      },
      () => setError(t('server.down')),
    )
  }, [session, t])

  const text = handoff ? toPlainText(t, lang, handoff, preparedAt) : ''

  const copy = async () => {
    try {
      if (window.isSecureContext && navigator.clipboard) await navigator.clipboard.writeText(text)
      else copyFallback(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      copyFallback(text)
    }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `aurahealth-handoff-${preparedAt.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const remove = async () => {
    if (!window.confirm(t('privacy.deleteConfirm'))) return
    try {
      await api.deleteSession()
      onDeleted()
    } catch {
      setError(t('server.down'))
    }
  }

  return (
    <div className="stack">
      <div className="row between no-print">
        <h1 style={{ margin: 0 }}>{t('review.title')}</h1>
        <button className="btn ghost" onClick={onEdit}>
          {t('review.edit')}
        </button>
      </div>
      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}

      {handoff && (
        <article className="handoff" aria-label={t('review.title')} data-testid="handoff">
          <div className="sim">{t('card.simulation')}</div>
          <h2>AuraHealth</h2>
          <div className="meta">
            {t('card.prepared', { time: preparedAt.toLocaleString() })}
            <br />
            {t('card.region')}: {regionName(lang)} · {t('card.number')}: {EMERGENCY_NUMBER}
          </div>
          <p className="small muted no-print" style={{ marginTop: 8 }}>
            {t('review.evidenceHint')}
          </p>
          {handoff.items.length === 0 && <p className="muted">{t('card.empty')}</p>}
          {SECTIONS.map((s) => {
            const items = handoff.items.filter((i) => sectionOf(i) === s)
            if (!items.length) return null
            return (
              <div className="hsec" key={s}>
                <h3>{sectionTitle(t, s)}</h3>
                {items.map((item, idx) => (
                  <button key={idx} className="hitem" onClick={() => setEvidence(item)} data-testid={`item-${item.section}`}>
                    <span className="val">{itemText(t, item)}</span>
                    <span className={`chip ${provClass(item.provenance)}`}>{provLabel(t, item.provenance)}</span>
                  </button>
                ))}
              </div>
            )
          })}
          {handoff.unknown.length > 0 && (
            <div className="hsec" data-testid="unknowns">
              <h3>{t('card.unknown')}</h3>
              <div className="unknowns">
                {handoff.unknown.map((k) => (
                  <span key={k} className="chip unknown">
                    {unknownLabel(t, k)}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="not-assessed">
            <Dual k="card.notAssessed" />
          </div>
        </article>
      )}

      {handoff && (
        <section className="card flat no-print">
          <div className="row">
            <button className="btn secondary" onClick={copy}>
              {copied ? t('share.copied') : t('share.copy')}
            </button>
            <button className="btn secondary" onClick={download}>
              {t('share.download')}
            </button>
            <button className="btn secondary" onClick={() => window.print()}>
              {t('share.print')}
            </button>
          </div>
          <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
            {t('share.note')}
          </p>
        </section>
      )}

      <div className="no-print">
        <EmergencyCard titleKey="cannot.title" bodyKey="cannot.body" extraKey="emergency.showCard" />
      </div>

      <section className="card flat no-print">
        <h2>{t('privacy.title')}</h2>
        <p className="small">{t('privacy.body')}</p>
        <button className="btn secondary" onClick={remove} data-testid="delete-session">
          {t('privacy.delete')}
        </button>
      </section>

      {evidence && <EvidenceSheet item={evidence} onClose={() => setEvidence(null)} />}
    </div>
  )
}

function copyFallback(text: string) {
  // Plain http over Wi-Fi is not a secure context, so the async clipboard API is unavailable there.
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}

function highlight(full: string, part: string): ReactNode {
  const i = full.indexOf(part)
  const j = i >= 0 ? i : full.toLowerCase().indexOf(part.toLowerCase())
  if (j < 0 || !part) return full
  return (
    <>
      {full.slice(0, j)}
      <mark>{full.slice(j, j + part.length)}</mark>
      {full.slice(j + part.length)}
    </>
  )
}

function EvidenceSheet({ item, onClose }: { item: HandoffItem; onClose: () => void }) {
  const { t } = useUi()
  const ev = item.evidence
  const final = itemText(t, item)
  return (
    <Sheet title={t('evidence.title')} onClose={onClose}>
      <div className="stack" data-testid="evidence">
        <div className="row" style={{ marginTop: 8 }}>
          <span className={`chip ${provClass(item.provenance)}`}>{provLabel(t, item.provenance)}</span>
        </div>

        {item.provenance === 'user_split' && (
          <>
            <div className="flow" style={{ gridTemplateColumns: '1fr' }}>
              <div className="box">
                <div className="k">{t('evidence.yourWords')}</div>
                <div className="v" style={{ fontWeight: 500, fontSize: 17 }}>
                  {highlight(ev.full_text ?? '', String(item.value.text ?? ''))}
                </div>
              </div>
            </div>
            {ev.model && <p className="small muted">{t('evidence.helperModel', { model: ev.model })}</p>}
          </>
        )}

        {ev.from_document && ev.document_id && (
          <>
            <div className="flow">
              <div className="box">
                <div className="k">{t('doc.original')}</div>
                <img src={imageUrl(ev.document_id)} alt={t('doc.original')} />
              </div>
              <div className="arrow" aria-hidden="true">
                →
              </div>
              <div className={`box ${item.provenance === 'doc_corrected' ? 'wrong' : ''}`}>
                <div className="k">{t('evidence.modelValue')}</div>
                <div className="v">{ev.model_value ?? '—'}</div>
                {item.provenance === 'user' && <div className="small muted">{t('evidence.youTyped')}</div>}
              </div>
              <div className="arrow" aria-hidden="true">
                →
              </div>
              <div className="box">
                <div className="k">{t('evidence.finalValue')}</div>
                <div className="v">{final}</div>
              </div>
            </div>
            {ev.flag_instruction && (
              <div className="banner warn small">
                <Icon name="alert" />
                <span>{t('doc.flag')}</span>
              </div>
            )}
            <p className="small muted">{t('evidence.noBoxes')}</p>
          </>
        )}

        {item.provenance === 'user' && !ev.from_document && (
          <div className="flow" style={{ gridTemplateColumns: '1fr' }}>
            <div className="box">
              <div className="k">{t('prov.user')}</div>
              <div className="v">{final}</div>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
