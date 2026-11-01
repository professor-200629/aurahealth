import { createContext, useContext, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { makeT, tEn } from './i18n'
import type { T } from './i18n'
import type { Health, Lang } from './types'

export interface Ui {
  lang: Lang
  t: T
  health: Health | null
  serverDown: boolean
}

export const UiContext = createContext<Ui>({ lang: 'en', t: makeT('en'), health: null, serverDown: false })
export const useUi = () => useContext(UiContext)

/** Random id that also works on plain http over Wi-Fi, where crypto.randomUUID is unavailable. */
export function rid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** A safety-critical line: shown in the chosen language, with the English baseline under any unreviewed translation. */
export function Dual({ k, vars, className }: { k: string; vars?: Record<string, string | number>; className?: string }) {
  const { lang, t } = useUi()
  return (
    <p className={className}>
      <span>{t(k, vars)}</span>
      {lang !== 'en' && (
        <span className="baseline" lang="en">
          {tEn(k, vars)}
        </span>
      )}
    </p>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useUi()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.done')}>
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const PATHS: Record<string, ReactNode> = {
  phone: (
    <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" fill="currentColor" />
  ),
  x: <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 11v6M12 7.5v.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l10 18H2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v5M12 18v.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  plus: <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
  doc: (
    <>
      <path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 3v5h5M10 13h6M10 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  share: (
    <>
      <circle cx="18" cy="5.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="6" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="18.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  chat: (
    <path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  ),
  pill: (
    <>
      <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M9.6 8.6l4.8 6.8" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 20c.5-3.6 3-5.6 6-5.6s5.5 2 6 5.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16.5 14.3c2.4.2 4 1.9 4.5 4.7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  speaker: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
}

export function Icon({ name, size = 20 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  )
}

export function Logo() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#e3f0ee" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="#1f6f68" strokeWidth="5" />
      <circle cx="32" cy="32" r="7" fill="#1f6f68" />
    </svg>
  )
}
