import { useState } from 'react'
import { HealthCard } from '../components/HealthCard'
import { NearbyHelp } from '../components/NearbyHelp'
import { clockOf, loadDoses, personName, today, useHousehold } from '../household'
import { isNativeApp, native } from '../native'
import { Icon, useUi } from '../ui'
import { WEB_DEMO } from '../api'
import { phoneAiReady } from '../aura'
import { askOnOpen, listenOnOpen, photoOnOpen } from './Chat'
import { Moon } from './Guard'

interface Props {
  hasSession: boolean
  busy: boolean
  error: string
  notice: string
  guardOn: boolean
  inApp: boolean
  ownerName: string
  onStart: () => void
  onHelp: () => void
  onGuard: () => void
  onChat: () => void
  onMeds: () => void
  onFamily: () => void
  onResume: () => void
  onAbout: () => void
  onProfile: () => void
}

export function Home(props: Props) {
  const { hasSession, busy, error, notice, guardOn, inApp, ownerName, onStart, onHelp, onGuard, onChat, onMeds, onFamily, onResume, onAbout, onProfile } = props
  const { t } = useUi()
  const [h] = useHousehold()
  const next = today(h, loadDoses()).find((d) => d.status === 'upcoming' || d.status === 'due' || d.status === 'scheduled')
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'home.morning' : hour < 17 ? 'home.afternoon' : 'home.evening'
  const [question, setQuestion] = useState('')
  const canVoice = isNativeApp() && !!native()?.canListen?.()
  const ask = () => {
    if (!question.trim()) return
    askOnOpen(question.trim())
    onChat()
  }

  return (
    <div className="stack">
      {notice && (
        <div className="banner info" role="status">
          {notice}
        </div>
      )}
      <section className="hero stack">
        <div>
          <p className="greeting">{ownerName ? t(hello, { name: ownerName }) : t('home.welcome')}</p>
          <h1 style={{ margin: '2px 0 0' }}>{t('home.question')}</h1>
        </div>
        {error && (
          <div className="banner error" role="alert">
            {error}
          </div>
        )}
        <form
          className="ask-box"
          onSubmit={(e) => {
            e.preventDefault()
            ask()
          }}
        >
          <textarea
            className="input"
            value={question}
            maxLength={500}
            rows={question.length > 60 ? 3 : question.length > 25 ? 2 : 1}
            placeholder={t('home.askPlaceholder')}
            aria-label={t('home.question')}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                ask()
              }
            }}
            data-testid="home-ask"
          />
          {canVoice && !question.trim() ? (
            <button
              type="button"
              className="btn mic"
              aria-label={t('chat.speak')}
              onClick={() => {
                listenOnOpen()
                onChat()
              }}
              data-testid="home-mic"
            >
              <Icon name="mic" size={24} />
            </button>
          ) : (
            <button type="submit" className="btn primary" disabled={!question.trim()} aria-label={t('chat.send')} data-testid="home-send">
              <Icon name="send" size={22} />
            </button>
          )}
        </form>
        <div className="chat-examples" style={{ marginTop: 0 }}>
          {['home.ex1', 'home.ex2', 'home.ex3'].map((k) => (
            <button
              key={k}
              className="chip-btn"
              onClick={() => {
                askOnOpen(t(k))
                onChat()
              }}
              data-testid={`home-${k.slice(5)}`}
            >
              {t(k)}
            </button>
          ))}
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>
          {t(WEB_DEMO ? 'web.askNote' : 'home.askNote')}
        </p>
        {phoneAiReady() && (
          <label className="btn talk block" data-testid="home-photo">
            <Icon name="doc" size={22} /> {t('home.photo')}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                photoOnOpen(file)
                onChat()
              }}
            />
          </label>
        )}
        <button className="btn talk block" onClick={onHelp} data-testid="help-now">
          <HeartPulse /> {t('home.help')}
        </button>
      </section>

      {!ownerName && (
        <button className="setup-card" onClick={onProfile} data-testid="setup-profile">
          <span className="tile-icon">
            <Icon name="user" />
          </span>
          <span>
            <strong>{t('home.setupTitle')}</strong>
            <span className="small muted" style={{ display: 'block' }}>
              {t('home.setupNote')}
            </span>
          </span>
        </button>
      )}

      <div className="tiles">
        <button className="tile" onClick={onMeds} data-testid="tile-meds">
          <span className="tile-icon">
            <Icon name="pill" />
          </span>
          <span className="tile-title">{t('home.meds')}</span>
          <span className="tile-sub">
            {next ? t('home.nextDose', { time: clockOf(next.due), name: next.name, who: personName(h, next.person) || '' }).replace(' ()', '') : t('home.medsSub')}
          </span>
        </button>
        <button className={`tile tile-night ${guardOn ? 'on' : ''}`} onClick={onGuard} data-testid="tile-guard">
          <span className="tile-icon">
            <Moon />
          </span>
          <span className="tile-title">{t('home.guard')}</span>
          <span className="tile-sub">{!inApp ? t('home.guardWeb') : guardOn ? t('home.guardOn') : t('home.guardOff')}</span>
        </button>
        <button className="tile" onClick={onFamily} data-testid="tile-family">
          <span className="tile-icon">
            <Icon name="people" />
          </span>
          <span className="tile-title">{t('home.family')}</span>
          <span className="tile-sub">{t('home.familySub')}</span>
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

      {h.people.some((p) => p.name.trim()) && <HealthCard onEdit={onFamily} />}

      <NearbyHelp />

      <p className="footer-note">
        {t('app.prototype')} ·{' '}
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
