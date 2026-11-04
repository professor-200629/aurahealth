import { useState } from 'react'
import { mainPerson, useHousehold } from '../household'
import { EMERGENCY_NUMBER, TEL_URI } from '../i18n'
import { locate, shareText } from '../nearby'
import { speak } from '../speech'
import { Dual, Icon, Sheet, useUi } from '../ui'
import { healthSpeech } from './HealthCard'

/**
 * Opened by the SOS button. Calling needs this second tap, so a pocket or a child pressing SOS does nothing by itself;
 * the call button is a plain tel: link (the phone's dialer opens; nothing is called automatically).
 */
export function SosSheet({ onClose, onHelp }: { onClose: () => void; onHelp: () => void }) {
  const { t } = useUi()
  const [household] = useHousehold()
  const people = household.people.filter((p) => p.name.trim())
  const main = mainPerson(household)
  const [note, setNote] = useState('')

  const share = async () => {
    setNote(t('nearby.locating'))
    const r = await locate()
    if (!r.ok) return setNote(t(`nearby.err.${r.reason}`))
    setNote((await shareText(t('nearby.shareText', { link: r.spot.link, m: r.spot.accuracy }))) ? t('nearby.shared', { m: r.spot.accuracy }) : t('nearby.err.unknown'))
  }

  return (
    <Sheet title={t('sos.title')} onClose={onClose}>
      <section className="sos-card stack" data-testid="emergency-card" style={{ marginTop: 12 }}>
        <div className="row between">
          <h2 style={{ margin: 0 }}>{t('emergency.title')}</h2>
          <span className="sos-number" aria-hidden="true">
            {EMERGENCY_NUMBER}
          </span>
        </div>
        <Dual k="emergency.body" />
        <a className="btn sos block" href={TEL_URI} data-testid="sos-call">
          <Icon name="phone" size={24} />
          {t('emergency.button')}
        </a>
        <div className="note">
          <Icon name="info" />
          <Dual k="emergency.dialerNote" />
        </div>
      </section>
      <div className="stack" style={{ marginTop: 14 }}>
        <button className="btn secondary block" onClick={share} data-testid="sos-share">
          <Icon name="share" /> {t('nearby.share')}
        </button>
        {[...people]
          .sort((a, b) => Number(b.id === main?.id) - Number(a.id === main?.id))
          .slice(0, 3)
          .map((p) => (
            <button key={p.id} className="btn secondary block" onClick={() => speak(healthSpeech(p, t))} data-testid="sos-health">
              <Icon name="speaker" /> {t('chat.readHealth', { name: p.name })}
            </button>
          ))}
        <button
          className="btn secondary block"
          onClick={() => {
            onClose()
            onHelp()
          }}
        >
          <Icon name="aid" /> {t('home.help')}
        </button>
        {note && (
          <p className="small" role="status" style={{ margin: 0 }}>
            {note}
          </p>
        )}
        <p className="tiny muted" style={{ margin: 0 }}>
          {t('emergency.needsNetwork')}
        </p>
      </div>
    </Sheet>
  )
}
