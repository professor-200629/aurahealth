import { useState } from 'react'
import { phoneAiReady } from '../aura'
import { isNativeApp, native } from '../native'
import { useUi } from '../ui'

/** Save the NVIDIA key in the Android app, so Talk to Aura works from the phone without the laptop. */
export function PhoneAiKey() {
  const { t } = useUi()
  const [ready, setReady] = useState(phoneAiReady)
  const [key, setKey] = useState('')
  const [message, setMessage] = useState('')
  if (!isNativeApp() || !native()?.setAiKey) return null

  const changed = () => {
    setReady(phoneAiReady())
    window.dispatchEvent(new Event('aura-ai-key'))
  }
  const save = () => {
    const ok = native()!.setAiKey!(key)
    setKey('')
    setMessage(ok ? t('aikey.saved') : t('aikey.invalid'))
    changed()
  }
  const remove = () => {
    if (!window.confirm(t('aikey.removeConfirm'))) return
    native()?.clearAiKey?.()
    setMessage(t('aikey.removed'))
    changed()
  }

  return (
    <details className="card flat small" open={!ready} data-testid="phone-ai-key">
      <summary style={{ fontWeight: 700, cursor: 'pointer' }}>{ready ? t('aikey.titleReady') : t('aikey.title')}</summary>
      <p style={{ margin: '8px 0' }}>{ready ? t('aikey.readyNote') : t('aikey.note')}</p>
      {!ready && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <input
            className="input"
            type="password"
            value={key}
            autoComplete="off"
            spellCheck={false}
            placeholder={t('aikey.placeholder')}
            aria-label={t('aikey.placeholder')}
            onChange={(e) => setKey(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button className="btn primary" type="submit" disabled={!key.trim()}>
            {t('common.save')}
          </button>
        </form>
      )}
      {ready && (
        <button className="btn ghost" onClick={remove}>
          {t('aikey.remove')}
        </button>
      )}
      {message && (
        <p role="status" style={{ margin: '8px 0 0' }}>
          {message}
        </p>
      )}
    </details>
  )
}
