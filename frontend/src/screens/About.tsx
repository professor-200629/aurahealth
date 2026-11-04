import { api } from '../api'
import { LANGUAGES, REGION } from '../i18n'
import { Dual, useUi } from '../ui'

export function About({ hasSession, onBack, onDeleted }: { hasSession: boolean; onBack: () => void; onDeleted: () => void }) {
  const { t, health } = useUi()
  const src = REGION.emergency.source

  const remove = async () => {
    if (!window.confirm(t('privacy.deleteConfirm'))) return
    await api.deleteSession().then(onDeleted, () => undefined)
  }

  return (
    <div className="stack">
      <button className="btn ghost" onClick={onBack} style={{ alignSelf: 'flex-start' }}>
        ← {t('common.back')}
      </button>
      <section className="card">
        <h1>{t('about.title')}</h1>
        <Dual k="about.body" />
        <p>
          <b>{t('app.setup')}</b>
        </p>
      </section>

      <section className="card flat">
        <h2>{t('about.models')}</h2>
        <p className="small" style={{ margin: 0 }}>
          {t('about.aiModel')}
        </p>
        <p className="small muted" style={{ marginTop: 10 }}>
          {t('status.offlineNote')}
        </p>
        <p className="small muted">{t('about.voice')}</p>
      </section>

      <section className="card flat">
        <h2>{t('about.languages')}</h2>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              {l.native}: {l.review === 'baseline' ? 'English baseline (not clinically reviewed)' : `${t('lang.unreviewed')} (unreviewed)`}
            </li>
          ))}
        </ul>
      </section>

      <section className="card flat">
        <h2>{t('about.source')}</h2>
        <p className="small">
          {src.title}. {src.fact_used} Checked {src.checked}.
        </p>
        <p className="small muted">{src.reuse_note}</p>
        <p className="small muted">{REGION.guidance_note}</p>
      </section>

      <section className="card flat">
        <h2>{t('privacy.title')}</h2>
        <p className="small">{t('privacy.body')}</p>
        {health?.lan && <div className="banner warn small">{t('privacy.lan')}</div>}
        {hasSession && (
          <button className="btn secondary" style={{ marginTop: 12 }} onClick={remove}>
            {t('privacy.delete')}
          </button>
        )}
      </section>
    </div>
  )
}
