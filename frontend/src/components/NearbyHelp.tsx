import { useState } from 'react'
import { locate, openNearby, shareText } from '../nearby'
import { Icon, useUi } from '../ui'

/** Nearest hospital, nearest medical store, and "share my location". */
export function NearbyHelp({ compact = false }: { compact?: boolean }) {
  const { t } = useUi()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const share = async () => {
    setBusy(true)
    setMessage(t('nearby.locating'))
    const r = await locate()
    setBusy(false)
    if (!r.ok) {
      setMessage(t(`nearby.err.${r.reason}`))
      return
    }
    const ok = await shareText(t('nearby.shareText', { link: r.spot.link, m: r.spot.accuracy }))
    setMessage(ok ? t('nearby.shared', { m: r.spot.accuracy }) : t('nearby.err.unknown'))
  }

  return (
    <section className={compact ? 'stack' : 'card stack'} aria-labelledby={compact ? undefined : 'nearby-title'} data-testid="nearby">
      {!compact && (
        <div>
          <h2 id="nearby-title">{t('nearby.title')}</h2>
          <p className="small muted" style={{ margin: 0 }}>
            {t('nearby.note')}
          </p>
        </div>
      )}
      <div className="nearby-row">
        <button className="btn secondary" onClick={() => openNearby('hospital')} data-testid="nearby-hospital">
          <PinIcon /> {t('nearby.hospital')}
        </button>
        <button className="btn secondary" onClick={() => openNearby('pharmacy')} data-testid="nearby-pharmacy">
          <PinIcon /> {t('nearby.pharmacy')}
        </button>
        <button className="btn secondary" onClick={share} disabled={busy} data-testid="nearby-share">
          <Icon name="share" /> {t('nearby.share')}
        </button>
      </div>
      {message && (
        <p className="small" role="status" style={{ margin: 0 }} data-testid="nearby-message">
          {message}
        </p>
      )}
    </section>
  )
}

export function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.6" fill="currentColor" />
    </svg>
  )
}
