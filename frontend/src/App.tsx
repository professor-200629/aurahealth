import { useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import { api } from './api'
import { clearPending, flush, pendingCount, setSessionListener } from './eventlog'
import { GUIDES } from './guides'
import { AlertOverlay } from './components/AlertOverlay'
import { BottomNav } from './components/BottomNav'
import type { Tab } from './components/BottomNav'
import { Drawer } from './components/Drawer'
import type { DrawerTarget } from './components/Drawer'
import { SosSheet } from './components/SosSheet'
import { StatusSheet } from './components/StatusSheet'
import { TopBar } from './components/TopBar'
import { useHousehold } from './household'
import { makeT } from './i18n'
import { guardStatus, isNativeApp, native, onNativeEvent } from './native'
import { About } from './screens/About'
import { Chat } from './screens/Chat'
import type { ChatTarget } from './screens/Chat'
import { Family } from './screens/Family'
import { Meds } from './screens/Meds'
import { Profile } from './screens/Profile'
import { DocumentStep } from './screens/DocumentStep'
import { Guard } from './screens/Guard'
import { GuidePlayer } from './screens/GuidePlayer'
import { Help } from './screens/Help'
import { Home } from './screens/Home'
import { Review } from './screens/Review'
import { Age, Details, Onset, What, Who } from './screens/Steps'
import type { StepProps } from './screens/Steps'
import type { Health, Lang, Session } from './types'
import { UiContext } from './ui'

type Screen = 'home' | 'who' | 'age' | 'what' | 'onset' | 'details' | 'doc' | 'review' | 'about' | 'help' | 'guide' | 'guard' | 'family' | 'meds' | 'chat' | 'profile'
const FLOW: Screen[] = ['who', 'age', 'what', 'onset', 'details', 'doc', 'review']
const STEPS: Partial<Record<Screen, (p: StepProps) => JSX.Element>> = {
  who: Who,
  age: Age,
  what: What,
  onset: Onset,
  details: Details,
  doc: DocumentStep,
}
const SCREENS: Screen[] = ['home', ...FLOW, 'about', 'help', 'guard', 'family', 'meds', 'chat', 'profile']
// Screens a notification may open (for example a medicine reminder opens "meds").
const OPENABLE: Screen[] = ['meds', 'guard', 'family', 'chat', 'help']
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

const lastCheckin = (s: Session | null) => {
  const c = (s?.events ?? []).filter((e) => e.kind === 'checkin_night' || e.kind === 'checkin_morning')
  return c.length ? c.map((e) => e.at).sort()[c.length - 1] : null
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return localStorage.getItem('aura-lang') === 'te' ? 'te' : 'en'
    } catch {
      return 'en'
    }
  })
  const [health, setHealth] = useState<Health | null>(null)
  const [serverDown, setServerDown] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [route, setRoute] = useState<Route>(fromHash)
  const screen = route.screen
  const [statusOpen, setStatusOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sosOpen, setSosOpen] = useState(false)
  const [household] = useHousehold()
  const ownerName = household.owner.name.trim()
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [guardOn, setGuardOn] = useState(() => !!guardStatus()?.on)
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

  // The phone's Back key asks here first: an open menu or sheet closes, and the screen stays where it is.
  useEffect(() => {
    ;(window as unknown as { auraBack: () => boolean }).auraBack = () => {
      if (!document.querySelector('.sheet, .drawer')) return false
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      return true
    }
  }, [])

  useEffect(
    () =>
      onNativeEvent((e) => {
        if (e.type === 'guard') setGuardOn(e.on)
        if (e.type === 'open' && OPENABLE.includes(e.screen as Screen)) {
          native()?.takeOpen?.()
          goRef.current(e.screen as Screen)
        }
        if (e.type === 'toast') setNotice(latestT.current(e.key))
      }),
    [],
  )
  useEffect(() => {
    const open = native()?.takeOpen?.()
    if (open && OPENABLE.includes(open as Screen)) goRef.current(open as Screen)
  }, [])

  const go = (s: Screen, guide = '') => {
    setNotice('')
    setError('')
    const next = { screen: s, guide }
    if (s !== screen || guide !== route.guide) window.history.pushState(null, '', hashFor(next))
    setRoute(next)
  }
  const goRef = useRef(go)
  goRef.current = go
  const latestT = useRef(t)
  latestT.current = t

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
    try {
      localStorage.setItem('aura-lang', l)
    } catch {
      /* the language still applies until the app closes */
    }
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

  // The menu, the profile and the bottom bar all lead to the same screens.
  const goTo = (target: DrawerTarget | Tab) => {
    setMenuOpen(false)
    if (target === 'status') return setStatusOpen(true)
    if (target === 'help') return openHelp()
    if (target === 'card') return session ? go('review') : void start()
    go(target)
  }
  const tab: Tab | null = (['home', 'chat', 'meds', 'family'] as Tab[]).includes(screen as Tab) ? (screen as Tab) : null

  const Step = STEPS[screen]
  const flowIndex = FLOW.indexOf(screen)
  const needsSession = flowIndex >= 0 && !session
  const wide = screen === 'doc' && !!session?.document

  return (
    <UiContext.Provider value={ui}>
      <TopBar onMenu={() => setMenuOpen(true)} onHome={() => go('home')} onProfile={() => go('profile')} initial={ownerName ? ownerName[0].toUpperCase() : ''} />
      <main className={wide ? 'wide' : ''}>
        {/* In the Android app everything that matters works without the laptop, so its absence is shown only in Settings. */}
        {serverDown && !isNativeApp() && (
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
            onGuard={() => go('guard')}
            onChat={() => go('chat')}
            onMeds={() => go('meds')}
            onFamily={() => go('family')}
            guardOn={guardOn}
            inApp={isNativeApp()}
            onResume={() => go('who')}
            onAbout={() => go('about')}
            onProfile={() => go('profile')}
            ownerName={ownerName}
          />
        )}
        {Step && session && (
          <Step key={screen} session={session} onSaved={setSession} onNext={() => go(FLOW[flowIndex + 1])} onBack={() => go(flowIndex <= 0 ? 'home' : FLOW[flowIndex - 1])} />
        )}
        {screen === 'profile' && <Profile onGo={goTo} onLang={changeLang} />}
        {screen === 'review' && session && <Review session={session} onEdit={() => go('who')} onDeleted={deleted} />}
        {screen === 'about' && <About hasSession={!!session} onBack={() => go('home')} onDeleted={deleted} />}
        {screen === 'help' && <Help onPick={(id) => go('guide', id)} />}
        {screen === 'guard' && <Guard lastCheckin={lastCheckin(session)} onFamily={() => go('family')} />}
        {screen === 'family' && <Family />}
        {screen === 'meds' && <Meds onFamily={() => go('family')} />}
        {screen === 'chat' && (
          <Chat
            onGuide={(id) => go('guide', id)}
            onOpen={(target: ChatTarget) => {
              if (target === 'help') openHelp()
              else if (target === 'card') {
                if (session) go('review')
                else void start()
              } else go(target)
            }}
          />
        )}
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
      <BottomNav
        active={tab}
        onTab={(next) => {
          setSosOpen(false)
          goTo(next)
        }}
        onSos={() => setSosOpen(true)}
      />
      {menuOpen && <Drawer name={ownerName} onGo={goTo} onClose={() => setMenuOpen(false)} onLang={changeLang} />}
      {sosOpen && <SosSheet onClose={() => setSosOpen(false)} onHelp={openHelp} />}
      <AlertOverlay onHelp={openHelp} />
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
