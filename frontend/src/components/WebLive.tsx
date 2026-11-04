import { useState } from 'react'
import { useUi } from '../ui'
import { liveOffered, liveOn, tryCode, turnOffLive } from '../live'

/** On the web demo: judges enter the code from the submission form to turn on live AI. */
export function WebLive() {
  const { t } = useUi()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  if (!liveOffered()) return null
  if (liveOn()) {
    return (
      <button
        type="button"
        className="btn ghost"
        style={{ marginTop: 10 }}
        data-testid="live-off"
        onClick={() => {
          turnOffLive()
          window.location.reload()
        }}
      >
        {t('web.codeOff')}
      </button>
    )
  }
  const go = async () => {
    setBusy(true)
    setMessage('')
    const result = await tryCode(code)
    setBusy(false)
    if (result === 'ok') window.location.reload()
    else setMessage(t(result === 'bad' ? 'web.codeBad' : 'web.codeDown'))
  }
  return (
    <form
      style={{ marginTop: 10 }}
      onSubmit={(e) => {
        e.preventDefault()
        if (code.trim() && !busy) void go()
      }}
    >
      <label htmlFor="judge-code" style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>
        {t('web.codeLabel')}
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id="judge-code"
          className="input"
          style={{ flex: 1, minWidth: 0 }}
          value={code}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t('web.codePlaceholder')}
          onChange={(e) => setCode(e.target.value)}
          data-testid="live-code"
        />
        <button type="submit" className="btn primary" disabled={busy || !code.trim()} data-testid="live-go">
          {t('web.codeGo')}
        </button>
      </div>
      {message && (
        <p className="small" role="alert" style={{ margin: '8px 0 0' }} data-testid="live-message">
          {message}
        </p>
      )}
    </form>
  )
}
