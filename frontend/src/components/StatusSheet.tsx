import { useState } from 'react'
import { api } from '../api'
import { LANGUAGES } from '../i18n'
import type { Lang } from '../types'
import { isNativeApp, native } from '../native'
import { Sheet, useUi } from '../ui'
import { PhoneAiKey } from './PhoneAiKey'

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
  const online = !!health?.models.ai_online
  const text = online
    ? { dot: health?.models.text ? 'ok' : 'warn', text: health?.models.text ? t('status.aiReady') : t('status.aiNoKey') }
    : model(health?.models.text)
  const photo = health?.models.glimmer_reader
    ? { dot: 'ok', text: t('status.photoGlimmer') }
    : health?.models.ocr_reader
      ? { dot: 'ok', text: t('status.ready') }
      : { dot: '', text: t('status.ocrNo') }

  return (
    <Sheet title={t('status.title')} onClose={onClose}>
      <div className="status-list" data-testid="status-list">
        <Row label={t('status.server')} dot={serverDown ? 'down' : 'ok'} value={serverDown ? t('status.serverDown') : t('status.serverOk')} />
        <Row label={online ? t('status.ai') : t('status.textHelper')} dot={text.dot} value={text.text} />
        <Row label={t('status.photo')} dot={photo.dot} value={photo.text} />
        <Row label={t('status.online')} dot={health?.models.online_reader ? 'ok' : ''} value={health?.models.online_reader ? t('status.onlineYes') : t('status.onlineNo')} />
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
      <PhoneAiKey />
      <p className="small muted">{t('status.offlineNote')}</p>
      <p className="small">
        <b>{t('app.setup')}</b>
      </p>
      {isNativeApp() && <HubSettings />}
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

/** In the Android app: which laptop to use as the AI helper. Without it, the bundled copy works on its own. */
function HubSettings() {
  const { t } = useUi()
  const saved = (() => {
    try {
      return JSON.parse(native()?.getHub?.() ?? '{}') as { url?: string; code?: string }
    } catch {
      return {}
    }
  })()
  const [url, setUrl] = useState(saved.url || 'http://')
  const [code, setCode] = useState(saved.code || '')
  return (
    <section className="card flat" style={{ marginTop: 12 }} data-testid="hub-settings">
      <h3>{t('hub.title')}</h3>
      <p className="small muted">{t('hub.note')}</p>
      <label className="field" htmlFor="hub-url">
        {t('hub.address')}
      </label>
      <input id="hub-url" className="input" value={url} inputMode="url" autoComplete="off" placeholder="http://192.168.1.10:8000" onChange={(e) => setUrl(e.target.value.trim())} />
      <label className="field" htmlFor="hub-code">
        {t('hub.code')}
      </label>
      <input id="hub-code" className="input" value={code} autoComplete="off" onChange={(e) => setCode(e.target.value.trim())} />
      <button className="btn primary" style={{ marginTop: 12 }} onClick={() => native()?.setHub?.(url, code)}>
        {t('hub.connect')}
      </button>
    </section>
  )
}
