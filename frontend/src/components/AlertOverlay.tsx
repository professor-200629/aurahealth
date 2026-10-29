import { useEffect, useState } from 'react'
import { TEL_URI } from '../i18n'
import { loadContacts, native, onNativeEvent } from '../native'
import { Icon, useUi } from '../ui'

interface AlertState {
  stage: 'countdown' | 'calling' | 'done' | 'cancelled'
  seconds: number
  test: boolean
}

/** The "Are you OK?" screen. The Android night-guard service runs the countdown and makes the call; this only
 * shows it and sends "I'm OK" back. If this page is not open, Android shows its own alarm and notification. */
export function AlertOverlay({ onHelp }: { onHelp: () => void }) {
  const { t } = useUi()
  const [alert, setAlert] = useState<AlertState | null>(null)

  useEffect(
    () =>
      onNativeEvent((e) => {
        if (e.type !== 'alert') return
        if (e.stage === 'cancelled') setAlert(null)
        else setAlert({ stage: e.stage, seconds: e.seconds ?? 0, test: !!e.test })
      }),
    [],
  )

  if (!alert) return null
  const c = loadContacts()
  const neighbour = c.neighbour.name || t('alert.someone')
  const family = c.family.name || t('alert.yourFamily')

  return (
    <div className="alert-overlay" role="alertdialog" aria-modal="true" aria-labelledby="alert-title" data-testid="alert-overlay">
      <div className="alert-inner">
        {alert.stage === 'countdown' ? (
          <>
            <h1 id="alert-title">{t('alert.title')}</h1>
            <div className="alert-count" aria-live="assertive">
              {alert.seconds}
            </div>
            <p>{t('alert.body', { neighbour, family, seconds: alert.seconds })}</p>
            {alert.test && <p className="alert-test">{t('alert.test')}</p>}
            <button className="btn alert-ok block" onClick={() => native()?.cancelAlert?.()} data-testid="alert-ok">
              {t('alert.ok')}
            </button>
          </>
        ) : (
          <>
            <h1 id="alert-title">{t('alert.calling', { neighbour, family })}</h1>
            {alert.test && <p className="alert-test">{t('alert.test')}</p>}
            <button
              className="btn alert-ok block"
              onClick={() => {
                setAlert(null)
                onHelp()
              }}
              data-testid="alert-help"
            >
              {t('alert.help')}
            </button>
            <button className="btn ghost alert-close" onClick={() => setAlert(null)}>
              {t('alert.close')}
            </button>
          </>
        )}
        <a className="btn sos block" href={TEL_URI} style={{ marginTop: 12 }}>
          <Icon name="phone" size={24} /> {t('emergency.button')}
        </a>
      </div>
    </div>
  )
}
