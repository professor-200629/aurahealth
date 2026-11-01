import { useEffect, useState } from 'react'
import { logEvent, pendingEvents, subscribe } from '../eventlog'
import { useHousehold } from '../household'
import { guardStatus, isNativeApp, loadMorning, native, onNativeEvent, saveMorning } from '../native'
import type { GuardStatus, MorningCheck } from '../native'
import { Dual, Icon, useUi } from '../ui'

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const PERMS: { key: string; label: string }[] = [
  { key: 'mic', label: 'guard.perm.mic' },
  { key: 'call', label: 'guard.perm.call' },
  { key: 'sms', label: 'guard.perm.sms' },
  { key: 'notify', label: 'guard.perm.notify' },
  { key: 'fullscreen', label: 'guard.perm.fullscreen' },
]

export function Guard({ lastCheckin, onFamily }: { lastCheckin: string | null; onFamily: () => void }) {
  const { t } = useUi()
  const inApp = isNativeApp()
  const [status, setStatus] = useState<GuardStatus | null>(guardStatus)
  const [household] = useHousehold()
  const callFirst = household.contacts.find((c) => c.call && c.number.trim())
  const texted = household.contacts.filter((c) => c.text && c.number.trim())
  const [level, setLevel] = useState(0)
  const [knocks, setKnocks] = useState(0)
  const [checkin, setCheckin] = useState<string | null>(lastCheckin ?? latestLocalCheckin())
  const [morning, setMorning] = useState<MorningCheck | null>(loadMorning)

  useEffect(
    () =>
      onNativeEvent((e) => {
        if (e.type === 'guard' || e.type === 'permissions') setStatus(guardStatus())
        if (e.type === 'level') setLevel(e.value)
        if (e.type === 'knock') setKnocks(e.count)
      }),
    [],
  )
  useEffect(() => subscribe(() => setCheckin((c) => latestLocalCheckin() ?? c)), [])
  useEffect(() => {
    if (!inApp) return
    const id = window.setInterval(() => setStatus(guardStatus()), 3000)
    return () => window.clearInterval(id)
  }, [inApp])

  const on = !!status?.on
  const missing = PERMS.filter((p) => status && !status.permissions[p.key])
  const toggle = () => {
    if (on) native()?.stopGuard?.()
    else native()?.startGuard?.()
    window.setTimeout(() => setStatus(guardStatus()), 400)
  }
  const check = (kind: 'checkin_night' | 'checkin_morning') => {
    native()?.checkIn?.(kind)
    setCheckin(logEvent({ kind }).at)
  }
  const changeMorning = (m: MorningCheck) => {
    setMorning(m)
    saveMorning(m)
  }
  const [morningTry, setMorningTry] = useState(false)
  const tryMorning = () => {
    try {
      const r = JSON.parse(native()?.testMorning?.() ?? '{}') as { ok?: boolean }
      setMorningTry(!!r.ok)
      if (r.ok) window.setTimeout(() => setMorningTry(false), 120000)
    } catch {
      setMorningTry(false)
    }
  }

  return (
    <div className="stack">
      <section className={`night ${on ? 'on' : ''}`} aria-labelledby="guard-title">
        <div className="row between">
          <span className="night-icon" aria-hidden="true">
            <Moon />
          </span>
          <span className={`pill ${on ? 'pill-on' : ''}`} data-testid="guard-state">
            {on ? t('guard.on') : t('guard.off')}
          </span>
        </div>
        <h1 id="guard-title">{t('guard.title')}</h1>
        <p className="night-lead">{t('guard.lead')}</p>
        <ol className="night-steps">
          <li>{t('guard.how1')}</li>
          <li>{t('guard.how2')}</li>
          <li>{t('guard.how3')}</li>
        </ol>
        {inApp ? (
          <>
            <button className={`btn block ${on ? 'night-off' : 'night-on'}`} onClick={toggle} data-testid="guard-toggle">
              {on ? t('guard.turnOff') : t('guard.turnOn')}
            </button>
            {on && (
              <div className="meter-wrap">
                <p className="small" style={{ margin: 0 }}>
                  {t('guard.listening')}
                </p>
                <div className="meter" aria-hidden="true">
                  <div className="meter-fill" style={{ width: `${Math.min(100, Math.round(level * 100))}%` }} />
                </div>
                <p className="small" style={{ margin: 0 }}>
                  {t('guard.knocks', { count: knocks })}
                </p>
              </div>
            )}
            {morning && (
              <div className="morning-check" data-testid="morning-check">
                <label className="row" style={{ gap: 10 }}>
                  <input type="checkbox" checked={morning.on} onChange={(e) => changeMorning({ ...morning, on: e.target.checked })} />
                  <span>{t('guard.morning')}</span>
                  <input
                    type="time"
                    className="input time-input"
                    value={morning.time}
                    disabled={!morning.on}
                    aria-label={t('guard.morningTime')}
                    onChange={(e) => e.target.value && changeMorning({ ...morning, time: e.target.value })}
                  />
                </label>
                <p className="small" style={{ margin: '6px 0 0' }}>
                  {t('guard.morningNote')}
                </p>
                {on && morning.on && (
                  <button className="btn ghost night-ghost" onClick={tryMorning} data-testid="morning-try">
                    {morningTry ? t('guard.morningTryStarted') : t('guard.morningTry')}
                  </button>
                )}
              </div>
            )}
            <button className="btn ghost night-ghost" onClick={() => native()?.testAlert?.()} data-testid="guard-test">
              {t('guard.test')}
            </button>
          </>
        ) : (
          <p className="night-note" data-testid="guard-web-only">
            {t('guard.webOnly')}
          </p>
        )}
        <Dual k="guard.no112" className="tiny night-fine" />
      </section>

      {inApp && missing.length + (status?.batteryOptimised ? 1 : 0) > 0 && (
        <section className="card flat">
          <h2>{t('guard.setup')}</h2>
          <ul className="perm-list">
            {missing.map((p) => (
              <li key={p.key}>
                <Icon name="alert" /> {t(p.label)}
              </li>
            ))}
            {status?.batteryOptimised && (
              <li>
                <Icon name="alert" /> {t('guard.perm.battery')}
              </li>
            )}
          </ul>
          <div className="row">
            {missing.length > 0 && (
              <button className="btn primary" onClick={() => native()?.requestPermissions?.()}>
                {t('guard.allow')}
              </button>
            )}
            {status?.batteryOptimised && (
              <button className="btn secondary" onClick={() => native()?.openBatterySettings?.()}>
                {t('guard.perm.batteryFix')}
              </button>
            )}
          </div>
        </section>
      )}

      <section className="card">
        <h2>{t('guard.checkins')}</h2>
        <p className="small muted">{t('guard.checkinsNote')}</p>
        <div className="checkins">
          <button className="checkin night-btn" onClick={() => check('checkin_night')} data-testid="checkin-night">
            <Moon /> {t('guard.goodNight')}
          </button>
          <button className="checkin day-btn" onClick={() => check('checkin_morning')} data-testid="checkin-morning">
            <Sun /> {t('guard.goodMorning')}
          </button>
        </div>
        {checkin && (
          <p className="small" style={{ marginTop: 10 }} data-testid="last-checkin">
            {t('guard.lastCheckin', { time: clock(checkin) })}
          </p>
        )}
      </section>

      <section className="card stack" data-testid="guard-contacts">
        <h2 style={{ margin: 0 }}>{t('guard.contacts')}</h2>
        <p style={{ margin: 0 }}>
          <strong>{t('guard.callsFirst')}</strong> {callFirst ? callFirst.name || callFirst.number : t('guard.nobodySet')}
        </p>
        <p style={{ margin: 0 }}>
          <strong>{t('guard.texts')}</strong> {texted.length ? texted.map((c) => c.name || c.number).join(', ') : t('guard.nobodySet')}
        </p>
        <p className="small muted" style={{ margin: 0 }}>
          {t('guard.contactsWhere')}
        </p>
        <button className="btn secondary" onClick={onFamily} data-testid="edit-contacts">
          {t('guard.editContacts')}
        </button>
      </section>
    </div>
  )
}

function latestLocalCheckin(): string | null {
  const c = pendingEvents().filter((e) => e.kind === 'checkin_night' || e.kind === 'checkin_morning')
  return c.length ? c[c.length - 1].at : null
}

export function Moon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" />
    </svg>
  )
}

export function Sun() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
