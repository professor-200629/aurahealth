import { tEn } from '../i18n'
import { Icon, Logo, useUi } from '../ui'

/** Menu on the left, the app name, and the profile on the right. The emergency call lives in the bottom bar (SOS). */
export function TopBar({ onMenu, onHome, onProfile, initial }: { onMenu: () => void; onHome: () => void; onProfile: () => void; initial: string }) {
  const { t, lang } = useUi()
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="icon-btn plain" onClick={onMenu} aria-label={t('nav.menu')} data-testid="menu-button">
          <Icon name="menu" size={24} />
        </button>
        <button className="brand" onClick={onHome} aria-label="AuraHealth">
          <Logo />
          <span className="brand-name">AuraHealth</span>
        </button>
        <span className="topbar-spacer" />
        <button className="avatar" onClick={onProfile} aria-label={t('nav.profile')} data-testid="profile-button">
          {initial ? <span aria-hidden="true">{initial}</span> : <Icon name="user" size={22} />}
        </button>
      </div>
      {lang !== 'en' && (
        <div className="lang-strip" role="note">
          {t('lang.unreviewed')} · <span lang="en">{tEn('lang.unreviewed')}</span>
        </div>
      )}
    </header>
  )
}
