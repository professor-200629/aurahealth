import { EmergencyCard } from '../components/EmergencyCard'
import { LanguageToggle } from '../components/StatusSheet'
import type { Lang } from '../types'
import { Dual, useUi } from '../ui'

interface Props {
  hasSession: boolean
  busy: boolean
  error: string
  notice: string
  onStart: () => void
  onResume: () => void
  onAbout: () => void
  onLang: (l: Lang) => void
}

export function Home({ hasSession, busy, error, notice, onStart, onResume, onAbout, onLang }: Props) {
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
          <p>{t('home.intro')}</p>
        </div>
        {error && (
          <div className="banner error" role="alert">
            {error}
          </div>
        )}
        <div className="stack">
          {hasSession && (
            <button className="btn primary block" onClick={onResume} disabled={busy}>
              {t('home.resume')}
            </button>
          )}
          <button className={`btn ${hasSession ? 'secondary' : 'primary'} block`} onClick={onStart} disabled={busy} data-testid="start">
            {busy ? t('common.loading') : t('home.start')}
          </button>
        </div>
      </section>

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
