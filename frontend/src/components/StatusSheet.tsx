import { useState } from 'react'
import { api } from '../api'
import { LANGUAGES } from '../i18n'
import type { Lang } from '../types'
import { Sheet, useUi } from '../ui'

export function LanguageToggle({ onChange }: { onChange: (l: Lang) => void }) {
  const { lang, t } = useUi()
  return (
    <div className="lang-toggle" role="group" aria-label={t('lang.label')}>
      {LANGUAGES.map((l) => (
        <button key={l.code} aria-pressed={lang === l.code} onClick={() => onChange(l.code)} lang={l.code}>
          {l.native}
        </button>
      ))}
    </div>
  )
}

export function StatusSheet({ onClose, onLang, onAbout }: { onClose: () => void; onLang: (l: Lang) => void; onAbout: () => void }) {
  const { t, health, serverDown } = useUi()
  const [internet, setInternet] = useState<'unchecked' | 'checking' | 'yes' | 'no'>('unchecked')

  const check = async () => {
    setInternet('checking')
    try {
      setInternet((await api.internetCheck()).reachable ? 'yes' : 'no')
    } catch {
      setInternet('no')
    }
  }

  const model = (ready: boolean | undefined) => {
    if (serverDown || !health) return { dot: 'down', text: t('status.serverDown') }
    if (!health.models.runtime) return { dot: 'down', text: t('status.down') }
    return ready ? { dot: 'ok', text: t('status.ready') } : { dot: 'warn', text: t('status.missing') }
  }
  const text = model(health?.models.text)
  const reader = model(health?.models.vision)

  return (
    <Sheet title={t('status.title')} onClose={onClose}>
      <div className="status-list" data-testid="status-list">
        <Row label={t('status.server')} dot={serverDown ? 'down' : 'ok'} value={serverDown ? t('status.serverDown') : t('status.serverOk')} />
        <Row label={t('status.textHelper')} dot={text.dot} value={text.text} />
        <Row label={t('status.reader')} dot={reader.dot} value={reader.text} />
        <Row label={t('status.mode')} dot="" value={health?.lan ? t('status.lanOn') : t('status.lanOff')} />
        <div className="status-item">
          <span className="k">
            <span className={`dot ${internet === 'yes' ? 'ok' : internet === 'no' ? 'warn' : ''}`} />
            {t('status.internet')}
          </span>
          <span className="row">
            <span className="muted small">
              {internet === 'yes' ? t('status.internetYes') : internet === 'no' ? t('status.internetNo') : t('status.internetUnchecked')}
            </span>
            <button className="btn ghost" onClick={check} disabled={internet === 'checking'}>
              {internet === 'checking' ? t('common.loading') : t('status.internetCheck')}
            </button>
          </span>
        </div>
      </div>
      <p className="small muted">{t('status.offlineNote')}</p>
      <p className="small">
        <b>{t('app.setup')}</b>
      </p>
      <div className="row between" style={{ marginTop: 12 }}>
        <span className="small">{t('lang.label')}</span>
        <LanguageToggle onChange={onLang} />
      </div>
      <button className="btn ghost" style={{ marginTop: 12 }} onClick={onAbout}>
        {t('about.title')} · {t('privacy.title')}
      </button>
    </Sheet>
  )
}

function Row({ label, dot, value }: { label: string; dot: string; value: string }) {
  return (
    <div className="status-item">
      <span className="k">
        <span className={`dot ${dot}`} />
        {label}
      </span>
      <span className="muted small" style={{ textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}
