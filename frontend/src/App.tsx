import { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import { api } from './api'
import { StatusSheet } from './components/StatusSheet'
import { TopBar } from './components/TopBar'
import { makeT } from './i18n'
import { About } from './screens/About'
import { DocumentStep } from './screens/DocumentStep'
import { Home } from './screens/Home'
import { Review } from './screens/Review'
import { Age, Details, Onset, What, Who } from './screens/Steps'
import type { StepProps } from './screens/Steps'
import type { Health, Lang, Session } from './types'
import { UiContext } from './ui'

type Screen = 'home' | 'who' | 'age' | 'what' | 'onset' | 'details' | 'doc' | 'review' | 'about'
const FLOW: Screen[] = ['who', 'age', 'what', 'onset', 'details', 'doc', 'review']
const STEPS: Partial<Record<Screen, (p: StepProps) => JSX.Element>> = {
  who: Who,
  age: Age,
  what: What,
  onset: Onset,
  details: Details,
  doc: DocumentStep,
}
const SCREENS: Screen[] = ['home', ...FLOW, 'about']
// The screen lives in the URL hash, so a phone reload or the back button keeps the user's place.
const fromHash = (): Screen => {
  const h = window.location.hash.slice(1) as Screen
  return SCREENS.includes(h) ? h : 'home'
}
const hashFor = (s: Screen) => (s === 'home' ? window.location.pathname : `#${s}`)

export default function App() {
  const [lang, setLang] = useState<Lang>('en')
  const [health, setHealth] = useState<Health | null>(null)
  const [serverDown, setServerDown] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [screen, setScreen] = useState<Screen>(fromHash)
  const [statusOpen, setStatusOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const t = useMemo(() => makeT(lang), [lang])
  const ui = useMemo(() => ({ lang, t, health, serverDown }), [lang, t, health, serverDown])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    let alive = true
    const poll = () =>
      api.health().then(
        (h) => alive && (setHealth(h), setServerDown(false)),
        () => alive && setServerDown(true),
      )
    poll()
    const id = window.setInterval(poll, 10000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    api.getSession().then(
      (r) => {
        if (r.session) {
          setSession(r.session)
          setLang(r.session.language)
        }
      },
      () => setServerDown(true),
    )
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  useEffect(() => {
    const onPop = () => setScreen(fromHash())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = (s: Screen) => {
    setNotice('')
    setError('')
    if (s !== screen) window.history.pushState(null, '', hashFor(s))
    setScreen(s)
  }

  const changeLang = async (l: Lang) => {
    setLang(l)
    if (session) api.patchSession({ language: l }).then((r) => setSession(r.session), () => undefined)
  }

  const start = async () => {
    if (session && !window.confirm(t('home.replaceConfirm'))) return
    setBusy(true)
    setError('')
    try {
      setSession((await api.newSession('IN', lang)).session)
      go('who')
    } catch {
      setError(t('server.down'))
    } finally {
      setBusy(false)
    }
  }

  const deleted = () => {
    setSession(null)
    window.history.replaceState(null, '', hashFor('home'))
    setScreen('home')
    setNotice(t('privacy.deleted'))
  }

  const Step = STEPS[screen]
  const flowIndex = FLOW.indexOf(screen)
  const needsSession = flowIndex >= 0 && !session
  const wide = screen === 'doc' && !!session?.document

  return (
    <UiContext.Provider value={ui}>
      <TopBar onHome={() => go('home')} onStatus={() => setStatusOpen(true)} />
      <main className={wide ? 'wide' : ''}>
        {serverDown && (
          <div className="banner error" role="alert" style={{ marginBottom: 16 }} data-testid="server-down">
            {t('server.down')}
          </div>
        )}
        {(screen === 'home' || needsSession) && (
          <Home
            hasSession={!!session}
            busy={busy}
            error={error}
            notice={notice}
            onStart={start}
            onResume={() => go('who')}
            onAbout={() => go('about')}
            onLang={changeLang}
          />
        )}
        {Step && session && (
          <Step key={screen} session={session} onSaved={setSession} onNext={() => go(FLOW[flowIndex + 1])} onBack={() => go(flowIndex <= 0 ? 'home' : FLOW[flowIndex - 1])} />
        )}
        {screen === 'review' && session && <Review session={session} onEdit={() => go('who')} onDeleted={deleted} />}
        {screen === 'about' && <About hasSession={!!session} onBack={() => go('home')} onDeleted={deleted} />}
      </main>
      {statusOpen && (
        <StatusSheet
          onClose={() => setStatusOpen(false)}
          onLang={changeLang}
          onAbout={() => {
            setStatusOpen(false)
            go('about')
          }}
        />
      )}
    </UiContext.Provider>
  )
}
