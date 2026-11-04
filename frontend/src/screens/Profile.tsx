import { useState } from 'react'
import { phoneAiReady } from '../aura'
import { useHousehold } from '../household'
import { guardStatus, isNativeApp } from '../native'
import type { Lang } from '../types'
import { LanguageToggle } from '../components/StatusSheet'
import { Icon, useUi } from '../ui'

export type ProfileTarget = 'family' | 'meds' | 'guard' | 'chat' | 'status' | 'about'

/** The person using this phone: name and number, and a way into everything that is set up. Kept on this phone. */
export function Profile({ onGo, onLang }: { onGo: (t: ProfileTarget) => void; onLang: (l: Lang) => void }) {
  const { t } = useUi()
  const [h, save] = useHousehold()
  const [editing, setEditing] = useState(!h.owner.name)
  const [name, setName] = useState(h.owner.name)
  const [phone, setPhone] = useState(h.owner.phone)
  const named = h.people.filter((p) => p.name.trim()).length
  const guardians = h.contacts.filter((c) => c.guardian && c.number.trim()).length
  const reminders = h.meds.filter((m) => m.on && m.name.trim()).length
  const guardOn = !!guardStatus()?.on

  const submit = () => {
    if (save({ ...h, owner: { name: name.trim(), phone: phone.trim() } })) setEditing(false)
  }

  const row = (target: ProfileTarget, icon: string, title: string, sub: string) => (
    <button className="profile-row" onClick={() => onGo(target)} data-testid={`profile-${target}`}>
      <span className="tile-icon">
        <Icon name={icon as never} />
      </span>
      <span>
        <strong>{title}</strong>
        <span className="small muted" style={{ display: 'block' }}>
          {sub}
        </span>
      </span>
    </button>
  )

  return (
    <div className="stack">
      <section className="profile-head">
        <span className="avatar huge" aria-hidden="true">
          {h.owner.name ? h.owner.name.trim()[0].toUpperCase() : <Icon name="user" size={34} />}
        </span>
        {editing ? (
          <form
            className="stack"
            style={{ width: '100%' }}
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <div>
              <label className="field" htmlFor="owner-name">
                {t('profile.name')}
              </label>
              <input id="owner-name" className="input" value={name} maxLength={40} required autoComplete="name" onChange={(e) => setName(e.target.value)} data-testid="owner-name" />
            </div>
            <div>
              <label className="field" htmlFor="owner-phone">
                {t('profile.phone')}
              </label>
              <input
                id="owner-phone"
                className="input"
                type="tel"
                inputMode="tel"
                value={phone}
                maxLength={20}
                autoComplete="tel"
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, ''))}
              />
            </div>
            <button className="btn primary block" type="submit" data-testid="owner-save">
              {t('common.save')}
            </button>
          </form>
        ) : (
          <>
            <h1 style={{ margin: '8px 0 0' }}>{h.owner.name}</h1>
            {h.owner.phone && <p className="muted" style={{ margin: 0 }}>{h.owner.phone}</p>}
            <button className="btn ghost" onClick={() => setEditing(true)}>
              {t('profile.edit')}
            </button>
          </>
        )}
      </section>

      <section className="card profile-list">
        {row('family', 'people', t('home.family'), t('profile.familySub', { people: named, guardians }))}
        {row('meds', 'pill', t('home.meds'), t('profile.medsSub', { n: reminders }))}
        {isNativeApp() && row('guard', 'moon', t('home.guard'), guardOn ? t('home.guardOn') : t('home.guardOff'))}
        {row('chat', 'chat', t('home.talk'), phoneAiReady() ? t('profile.aiPhone') : t('profile.aiNoKey'))}
        {row('status', 'gear', t('nav.settings'), t('profile.settingsSub'))}
        {row('about', 'info', t('about.title'), t('profile.aboutSub'))}
      </section>

      <section className="card flat stack">
        <strong>{t('lang.label')}</strong>
        <LanguageToggle onChange={onLang} />
      </section>

      <p className="small muted" style={{ margin: 0 }}>
        {t('profile.privacy')}
      </p>
    </div>
  )
}
