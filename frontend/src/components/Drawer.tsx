import { useEffect, useRef } from 'react'
import type { Lang } from '../types'
import { Icon, useUi } from '../ui'
import { LanguageToggle } from './StatusSheet'

export type DrawerTarget = 'home' | 'chat' | 'help' | 'meds' | 'family' | 'guard' | 'card' | 'profile' | 'status' | 'about'

const ITEMS: { id: DrawerTarget; icon: string; key: string }[] = [
  { id: 'home', icon: 'home', key: 'nav.home' },
  { id: 'chat', icon: 'chat', key: 'home.talk' },
  { id: 'help', icon: 'aid', key: 'nav.firstAid' },
  { id: 'meds', icon: 'pill', key: 'home.meds' },
  { id: 'family', icon: 'people', key: 'home.family' },
  { id: 'guard', icon: 'moon', key: 'home.guard' },
  { id: 'card', icon: 'doc', key: 'home.card' },
  { id: 'profile', icon: 'user', key: 'nav.profile' },
  { id: 'status', icon: 'gear', key: 'nav.settings' },
  { id: 'about', icon: 'info', key: 'about.title' },
]

/** The side menu: every part of the app, the language, and settings. */
export function Drawer({ name, onGo, onClose, onLang }: { name: string; onGo: (t: DrawerTarget) => void; onClose: () => void; onLang: (l: Lang) => void }) {
  const { t } = useUi()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={t('nav.menu')} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()} data-testid="drawer">
        <button className="drawer-profile" onClick={() => onGo('profile')}>
          <span className="avatar big" aria-hidden="true">
            {name ? name.trim()[0].toUpperCase() : <Icon name="user" size={26} />}
          </span>
          <span>
            <strong>{name || t('profile.setUp')}</strong>
            <span className="small muted" style={{ display: 'block' }}>
              {t('nav.profile')}
            </span>
          </span>
        </button>
        <nav className="drawer-list">
          {ITEMS.map((it) => (
            <button key={it.id} className="drawer-item" onClick={() => onGo(it.id)} data-testid={`drawer-${it.id}`}>
              <Icon name={it.icon as never} size={22} />
              <span>{t(it.key)}</span>
            </button>
          ))}
        </nav>
        <div className="drawer-foot">
          <LanguageToggle onChange={onLang} />
          <p className="tiny muted" style={{ margin: '10px 0 0' }}>
            {t('app.prototype')}
          </p>
        </div>
      </aside>
    </div>
  )
}
