import { useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import { api } from './api'
import { clearPending, flush, pendingCount, setSessionListener } from './eventlog'
import { GUIDES } from './guides'
import { StatusSheet } from './components/StatusSheet'
import { TopBar } from './components/TopBar'
import { makeT } from './i18n'
import { About } from './screens/About'
import { DocumentStep } from './screens/DocumentStep'
import { GuidePlayer } from './screens/GuidePlayer'
import { Help } from './screens/Help'
import { Home } from './screens/Home'
import { Review } from './screens/Review'
import { Age, Details, Onset, What, Who } from './screens/Steps'
import type { StepProps } from './screens/Steps'
import type { Health, Lang, Session } from './types'
import { UiContext } from './ui'

type Screen = 'home' | 'who' | 'age' | 'what' | 'onset' | 'details' | 'doc' | 'review' | 'about' | 'help' | 'guide'
const FLOW: Screen[] = ['who', 'age', 'what', 'onset', 'details', 'doc', 'review']
const STEPS: Partial<Record<Screen, (p: StepProps) => JSX.Element>> = {
  who: Who,
  age: Age,
  what: What,
  onset: Onset,
  details: Details,
  doc: DocumentStep,
}
const SCREENS: Screen[] = ['home', ...FLOW, 'about', 'help']
interface Route {
  screen: Screen
  guide: string
}
// The screen lives in the URL hash, so a phone reload or the back button keeps the user's place.
const fromHash = (): Route => {
  const h = window.location.hash.slice(1)
  if (h.startsWith('guide=') && GUIDES[h.slice(6)]) return { screen: 'guide', guide: h.slice(6) }
  return { screen: SCREENS.includes(h as Screen) ? (h as Screen) : 'home', guide: '' }
}
const hashFor = (r: Route) =>
  r.screen === 'home' ? window.location.pathname : r.screen === 'guide' ? `#guide=${r.guide}` : `#${r.screen}`

export default function App() {
  const [lang, setLang] = useState<Lang>('en')
  const [health, setHealth] = useState<Health | null>(null)
  const [serverDown, setServerDown] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [route, setRoute] = useState<Route>(fromHash)
  const screen = route.screen
  const [statusOpen, setStatusOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const t = useMemo(() => makeT(lang), [lang])
  const ui = useMemo(() => ({ lang, t, health, serverDown }), [lang, t, health, serverDown])
  const latest = useRef({ session, lang })
  latest.current = { session, lang }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    let alive = true
    const poll = () =>
      api.health().then(
        (h) => {
          if (!alive) return
          setHealth(h)
          setServerDown(false)
          // First-aid steps logged while the laptop was out of reach are sent as soon as it answers again.
          if (pendingCount() > 0) {
            if (latest.current.session) void flush()
            else
              api.newSession('IN', latest.current.lang).then(
                (r) => {
                  setSession(r.session)
                  void flush()
                },
                () => undefined,
              )
          }
        },
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
  }, [screen, route.guide])

  useEffect(() => {
    const onPop = () => setRoute(fromHash())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => setSessionListener(setSession), [])

  const go = (s: Screen, guide = '') => {
    setNotice('')
    setError('')
    const next = { screen: s, guide }
    if (s !== screen || guide !== route.guide) window.history.pushState(null, '', hashFor(next))
    setRoute(next)
  }

  // First aid must start instantly and work without the laptop: the guides are bundled, and the session
  // that receives the time log is created quietly in the background when the laptop is reachable.
  const openHelp = () => {
    go('help')
    if (!session)
      api.newSession('IN', lang).then(
        (r) => {
          setSession(r.session)
          void flush()
        },
        () => undefined,
      )
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
    clearPending()
    window.history.replaceState(null, '', hashFor({ screen: 'home', guide: '' }))
    setRoute({ screen: 'home', guide: '' })
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
            onHelp={openHelp}
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
        {screen === 'help' && <Help onPick={(id) => go('guide', id)} />}
        {screen === 'guide' && (
          <GuidePlayer
            key={route.guide}
            guideId={route.guide}
            onGuide={(id) => go('guide', id)}
            onList={() => go('help')}
            onCard={() => go('review')}
          />
        )}
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
