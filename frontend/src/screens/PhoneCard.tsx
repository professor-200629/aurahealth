import { useEffect, useState } from 'react'
import { healthSpeech } from '../components/HealthCard'
import { clearPending, pendingEvents, subscribe } from '../eventlog'
import type { PendingEvent } from '../eventlog'
import { GUIDES } from '../guides'
import { mainPerson, useHousehold } from '../household'
import { shareText } from '../nearby'
import { speak } from '../speech'
import { Icon, useUi } from '../ui'

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** What was done and when, built on this phone from its own time log and health card, to read or send to whoever takes over. */
export function PhoneCard({ onHelp }: { onHelp: () => void }) {
  const { t } = useUi()
  const [household] = useHousehold()
  const [, redraw] = useState(0)
  useEffect(() => subscribe(() => redraw((n) => n + 1)), [])

  const line = (e: PendingEvent): string => {
    const guide = e.guide ? GUIDES[e.guide] : undefined
    const step = guide?.steps.find((s) => s.id === e.step)
    if (e.kind === 'guide_open') return t('pcard.opened', { guide: guide?.title ?? '' })
    if (e.kind === 'done') return step?.log || step?.text || guide?.title || ''
    if (e.kind === 'choice') return `${step?.log || step?.text || ''} ${step?.choices?.find((c) => c.id === e.choice)?.label ?? ''}`.trim()
    return t(`pcard.${e.kind}`, { role: e.role ?? '' })
  }

  const events = [...pendingEvents()].sort((a, b) => a.at.localeCompare(b.at))
  const person = mainPerson(household)
  const health = person?.name.trim() ? healthSpeech(person, t) : ''
  const rows = events.map((e) => `${clock(e.at)} ${line(e)}`)
  const text = [t('pcard.title'), health, ...rows, t('pcard.not')].filter(Boolean).join('\n')

  return (
    <div className="stack" data-testid="phone-card">
      <div>
        <h1 style={{ margin: 0 }}>{t('pcard.title')}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {t('pcard.lead')}
        </p>
      </div>
      {health && (
        <section className="card flat">
          <h2>{person?.name}</h2>
          <p className="small" style={{ margin: 0 }}>
            {health}
          </p>
        </section>
      )}
      <section className="card flat">
        <h2>{t('pcard.timeline')}</h2>
        {rows.length ? (
          <ol className="pcard-times" data-testid="phone-card-times">
            {events.map((e) => (
              <li key={e.id}>
                <b>{clock(e.at)}</b> {line(e)}
              </li>
            ))}
          </ol>
        ) : (
          <>
            <p className="small">{t('pcard.empty')}</p>
            <button className="btn secondary block" onClick={onHelp}>
              <Icon name="aid" /> {t('nav.firstAid')}
            </button>
          </>
        )}
      </section>
      <p className="tiny muted" style={{ margin: 0 }}>
        {t('pcard.not')}
      </p>
      {(rows.length > 0 || health) && (
        <>
          <button className="btn secondary block" onClick={() => speak(text)} data-testid="phone-card-read">
            <Icon name="speaker" /> {t('pcard.read')}
          </button>
          <button className="btn secondary block" onClick={() => void shareText(text)} data-testid="phone-card-share">
            <Icon name="share" /> {t('pcard.share')}
          </button>
        </>
      )}
      {rows.length > 0 && (
        <button
          className="btn ghost"
          onClick={() => {
            if (window.confirm(t('pcard.clearConfirm'))) clearPending()
          }}
        >
          {t('pcard.clear')}
        </button>
      )}
    </div>
  )
}
