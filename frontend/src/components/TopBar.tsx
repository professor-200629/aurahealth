import { TEL_URI, tEn } from '../i18n'
import { Icon, Logo, useUi } from '../ui'

/** Sticky on every screen. The emergency control is a plain tel: link, so it works without the server or any model. */
export function TopBar({ onHome, onStatus }: { onHome: () => void; onStatus: () => void }) {
  const { t, lang, health, serverDown } = useUi()
  const state = serverDown ? 'down' : !health ? '' : health.models.text && health.models.vision ? 'ok' : 'warn'
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" onClick={onHome} aria-label="AuraHealth">
          <Logo />
          <span className="brand-name">AuraHealth</span>
        </button>
        <span className="topbar-spacer" />
        <button className="icon-btn" onClick={onStatus} aria-label={t('status.title')} data-testid="status-button">
          <span className={`dot ${state}`} />
        </button>
        <a className="sos-pill" href={TEL_URI} data-testid="sos" aria-label={t('emergency.button')}>
          <Icon name="phone" />
          <span className="wide-only">{t('emergency.button')}</span>
          <span className="narrow-only">{t('emergency.short')}</span>
        </a>
      </div>
      {lang !== 'en' && (
        <div className="lang-strip" role="note">
          {t('lang.unreviewed')} · <span lang="en">{tEn('lang.unreviewed')}</span>
        </div>
      )}
    </header>
  )
}
