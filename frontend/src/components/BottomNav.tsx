import { Icon, useUi } from '../ui'

export type Tab = 'home' | 'chat' | 'care' | 'family'

/** The app's main places, always at the bottom. SOS in the middle opens the emergency sheet (it never calls by itself). */
export function BottomNav({ active, onTab, onSos }: { active: Tab | null; onTab: (t: Tab) => void; onSos: () => void }) {
  const { t } = useUi()
  const item = (tab: Tab, icon: Parameters<typeof Icon>[0]['name'], label: string) => (
    <button className={`nav-item ${active === tab ? 'on' : ''}`} onClick={() => onTab(tab)} aria-current={active === tab ? 'page' : undefined} data-testid={`nav-${tab}`}>
      <Icon name={icon} size={24} />
      <span>{label}</span>
    </button>
  )
  return (
    <nav className="bottom-nav" aria-label={t('nav.main')}>
      {item('home', 'home', t('nav.home'))}
      {item('chat', 'chat', t('nav.aura'))}
      <button className="nav-sos" onClick={onSos} aria-label={t('sos.open')} data-testid="sos">
        <span className="nav-sos-ring">SOS</span>
      </button>
      {item('care', 'pill', t('nav.today'))}
      {item('family', 'people', t('nav.family'))}
    </nav>
  )
}
