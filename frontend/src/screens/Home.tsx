import { EmergencyCard } from '../components/EmergencyCard'
import { LanguageToggle } from '../components/StatusSheet'
import type { Lang } from '../types'
import { Dual, Icon, useUi } from '../ui'
import { Moon } from './Guard'

interface Props {
  hasSession: boolean
  busy: boolean
  error: string
  notice: string
  guardOn: boolean
  inApp: boolean
  onStart: () => void
  onHelp: () => void
  onGuard: () => void
  onResume: () => void
  onAbout: () => void
  onLang: (l: Lang) => void
}

export function Home(props: Props) {
  const { hasSession, busy, error, notice, guardOn, inApp, onStart, onHelp, onGuard, onResume, onAbout, onLang } = props
  const { t } = useUi()
  return (
    <div className="stack">
      {notice && (
        <div className="banner info" role="status">
          {notice}
        </div>
      )}
      <section className="hero stack">
        <div className="row between">
          <span className="prototype-badge">{t('app.prototype')}</span>
          <LanguageToggle onChange={onLang} />
        </div>
        <div>
          <h1>{t('app.tagline')}</h1>
          <p className="hero-intro">{t('home.intro')}</p>
        </div>
        {error && (
          <div className="banner error" role="alert">
            {error}
          </div>
        )}
        <button className="btn help block" onClick={onHelp} data-testid="help-now">
          <HeartPulse /> {t('home.help')}
        </button>
        <p className="small muted" style={{ margin: '-6px 0 0' }}>
          {t('home.helpNote')}
        </p>
      </section>

      <div className="tiles">
        <button className={`tile tile-night ${guardOn ? 'on' : ''}`} onClick={onGuard} data-testid="tile-guard">
          <span className="tile-icon">
            <Moon />
          </span>
          <span className="tile-title">{t('home.guard')}</span>
          <span className="tile-sub">{!inApp ? t('home.guardWeb') : guardOn ? t('home.guardOn') : t('home.guardOff')}</span>
        </button>
        <button className="tile" onClick={hasSession ? onResume : onStart} disabled={busy} data-testid={hasSession ? 'tile-resume' : 'start'}>
          <span className="tile-icon">
            <Icon name="doc" />
          </span>
          <span className="tile-title">{t('home.card')}</span>
          <span className="tile-sub">{busy ? t('common.loading') : hasSession ? t('home.resume') : t('home.cardNote')}</span>
        </button>
      </div>
      {hasSession && (
        <button className="btn ghost" onClick={onStart} disabled={busy} data-testid="start-new">
          {t('home.start')}
        </button>
      )}

      <EmergencyCard />

      <section className="card flat">
        <h2>{t('home.howTitle')}</h2>
        <ol style={{ paddingLeft: 22, margin: 0 }}>
          <li>{t('home.how1')}</li>
          <li>{t('home.how2')}</li>
          <li>{t('home.how3')}</li>
        </ol>
      </section>

      <Dual k="app.prototype" className="footer-note" />
      <p className="footer-note">
        {t('app.setup')} ·{' '}
        <button className="btn ghost" onClick={onAbout}>
          {t('about.title')}
        </button>
      </p>
    </div>
  )
}

function HeartPulse() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.1 5.3 3 1.7-1.9 3.2-3 5.3-3 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M5 12h3.5l1.5-3 2.5 6 1.5-3H19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
