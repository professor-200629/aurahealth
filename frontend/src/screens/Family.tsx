import { useEffect, useState } from 'react'
import { newContact, newPerson, useHousehold } from '../household'
import type { HouseContact, Person } from '../household'
import { REGION } from '../i18n'
import { isNativeApp, native, nativeJson, onNativeEvent } from '../native'
import { Icon, useUi } from '../ui'

const BLOOD = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

interface LocationStatus {
  allowed: boolean
  enabled: boolean
  inAlerts: boolean
}

/** Family & health: the people at home, their health notes, and who to contact. Kept on this phone only. */
export function Family() {
  const { t } = useUi()
  const [h, save] = useHousehold()
  const [person, setPerson] = useState<Person | null>(null)
  const [contact, setContact] = useState<HouseContact | null>(null)
  const [error, setError] = useState('')
  const inApp = isNativeApp()
  const [loc, setLoc] = useState(() => nativeJson<LocationStatus>((b) => b.locationStatus?.()))
  useEffect(() => onNativeEvent((e) => e.type === 'permissions' && setLoc(nativeJson<LocationStatus>((b) => b.locationStatus?.()))), [])

  const commit = (next: typeof h) => {
    setError(save(next) ? '' : t('family.saveFailed'))
  }
  const savePerson = (p: Person) => {
    const exists = h.people.some((x) => x.id === p.id)
    let people = exists ? h.people.map((x) => (x.id === p.id ? p : x)) : [...h.people, p]
    if (p.main) people = people.map((x) => ({ ...x, main: x.id === p.id }))
    if (!people.some((x) => x.main) && people.length) people = people.map((x, i) => ({ ...x, main: i === 0 }))
    commit({ ...h, people })
    setPerson(null)
  }
  const removePerson = (p: Person) => {
    if (!window.confirm(t('family.removeConfirm', { name: p.name || t('family.noName') }))) return
    const people = h.people.filter((x) => x.id !== p.id)
    if (people.length && !people.some((x) => x.main)) people[0] = { ...people[0], main: true }
    commit({ ...h, people, meds: h.meds.map((m) => (m.person === p.id ? { ...m, person: '' } : m)) })
    setPerson(null)
  }
  const saveContact = (c: HouseContact) => {
    const exists = h.contacts.some((x) => x.id === c.id)
    commit({ ...h, contacts: exists ? h.contacts.map((x) => (x.id === c.id ? c : x)) : [...h.contacts, c] })
    setContact(null)
  }
  const removeContact = (c: HouseContact) => {
    if (!window.confirm(t('family.removeConfirm', { name: c.name || c.number }))) return
    commit({ ...h, contacts: h.contacts.filter((x) => x.id !== c.id) })
    setContact(null)
  }
  const callFirst = h.contacts.find((c) => c.call && c.number.trim())

  return (
    <div className="stack">
      <div>
        <h1>{t('family.title')}</h1>
        <p className="muted">{t('family.lead')}</p>
      </div>
      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}

      <section className="card stack" aria-labelledby="people-title">
        <h2 id="people-title" style={{ margin: 0 }}>
          {t('family.people')}
        </h2>
        {h.people.length === 0 && !person && <p className="small muted">{t('family.peopleEmpty')}</p>}
        {h.people.map((p) =>
          person?.id === p.id ? (
            <PersonForm key={p.id} value={person} onChange={setPerson} onSave={savePerson} onCancel={() => setPerson(null)} onRemove={() => removePerson(p)} />
          ) : (
            <div key={p.id} className="list-row" data-testid="person-row">
              <div>
                <strong>{p.name || t('family.noName')}</strong>
                {p.age && <span className="muted"> · {t('health.age', { age: p.age })}</span>}
                {p.main && <span className="chip ok" style={{ marginLeft: 8 }}>{t('family.mainBadge')}</span>}
                <div className="small muted">{[p.conditions, p.allergies && `${t('health.allergies')}: ${p.allergies}`].filter(Boolean).join(' · ') || t('health.noDetails')}</div>
              </div>
              <button className="btn ghost" onClick={() => setPerson(p)}>
                {t('common.edit')}
              </button>
            </div>
          ),
        )}
        {person && !h.people.some((x) => x.id === person.id) && (
          <PersonForm value={person} onChange={setPerson} onSave={savePerson} onCancel={() => setPerson(null)} />
        )}
        {!person && (
          <button className="btn secondary" onClick={() => setPerson(newPerson(h.people.length === 0))} data-testid="add-person">
            <Icon name="plus" /> {t('family.addPerson')}
          </button>
        )}
      </section>

      <section className="card stack" aria-labelledby="contacts-title">
        <div>
          <h2 id="contacts-title" style={{ margin: 0 }}>
            {t('family.contacts')}
          </h2>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            {t('family.contactsNote')}
          </p>
        </div>
        {h.contacts.length === 0 && !contact && <p className="small muted">{t('family.contactsEmpty')}</p>}
        {h.contacts.map((c) =>
          contact?.id === c.id ? (
            <ContactForm key={c.id} value={contact} onChange={setContact} onSave={saveContact} onCancel={() => setContact(null)} onRemove={() => removeContact(c)} />
          ) : (
            <div key={c.id} className="list-row" data-testid="contact-row">
              <div>
                <strong>{c.name || t('family.noName')}</strong>
                {c.relation && <span className="muted"> · {c.relation}</span>}
                <div className="small muted">
                  {[c === callFirst && t('family.roleCallFirst'), c.call && c !== callFirst && t('family.roleCall'), c.text && t('family.roleText'), c.guardian && t('family.roleGuardian')]
                    .filter(Boolean)
                    .join(' · ') || t('family.roleNone')}
                  {!c.number.trim() && ` · ${t('family.noNumber')}`}
                </div>
              </div>
              <button className="btn ghost" onClick={() => setContact(c)}>
                {t('common.edit')}
              </button>
            </div>
          ),
        )}
        {contact && !h.contacts.some((x) => x.id === contact.id) && (
          <ContactForm value={contact} onChange={setContact} onSave={saveContact} onCancel={() => setContact(null)} />
        )}
        {!contact && (
          <button className="btn secondary" onClick={() => setContact(newContact())} data-testid="add-contact">
            <Icon name="plus" /> {t('family.addContact')}
          </button>
        )}
      </section>

      {inApp && loc && (
        <section className="card stack" aria-labelledby="loc-title">
          <h2 id="loc-title" style={{ margin: 0 }}>
            {t('family.location')}
          </h2>
          <label className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={loc.inAlerts}
              onChange={(e) => {
                native()?.setLocationInAlerts?.(e.target.checked)
                setLoc({ ...loc, inAlerts: e.target.checked })
              }}
              data-testid="location-in-alerts"
            />
            <span>{t('family.locationInAlerts')}</span>
          </label>
          {loc.inAlerts && !loc.allowed && (
            <div className="banner warn">
              <Icon name="alert" />
              <span>{t('family.locationNotAllowed')}</span>
            </div>
          )}
          {loc.inAlerts && loc.allowed && !loc.enabled && (
            <div className="banner warn">
              <Icon name="alert" />
              <span>{t('family.locationOff')}</span>
            </div>
          )}
        </section>
      )}

      <section className="card flat small">
        <p style={{ margin: 0 }}>{t('family.country', { country: REGION.name.en, number: REGION.emergency.number })}</p>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          {t('family.privacy')}
        </p>
      </section>
    </div>
  )
}

function PersonForm(props: { value: Person; onChange: (p: Person) => void; onSave: (p: Person) => void; onCancel: () => void; onRemove?: () => void }) {
  const { t } = useUi()
  const { value: p, onChange, onSave, onCancel, onRemove } = props
  const set = <K extends keyof Person>(k: K, v: Person[K]) => onChange({ ...p, [k]: v })
  const id = (k: string) => `p-${p.id}-${k}`
  return (
    <form
      className="edit-box stack"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...p, name: p.name.trim() })
      }}
      data-testid="person-form"
    >
      <div>
        <label className="field" htmlFor={id('name')}>
          {t('family.name')}
        </label>
        <input id={id('name')} className="input" value={p.name} maxLength={40} required autoComplete="off" onChange={(e) => set('name', e.target.value)} />
      </div>
      <div className="two-col">
        <div>
          <label className="field" htmlFor={id('age')}>
            {t('family.age')}
          </label>
          <input id={id('age')} className="input" inputMode="numeric" value={p.age} maxLength={3} onChange={(e) => set('age', e.target.value.replace(/\D/g, ''))} />
        </div>
        <div>
          <label className="field" htmlFor={id('blood')}>
            {t('health.blood')}
          </label>
          <select id={id('blood')} className="input" value={p.blood} onChange={(e) => set('blood', e.target.value)}>
            {BLOOD.map((b) => (
              <option key={b} value={b}>
                {b || t('common.unknown')}
              </option>
            ))}
          </select>
        </div>
      </div>
      {(['conditions', 'allergies', 'medicines', 'notes'] as const).map((k) => (
        <div key={k}>
          <label className="field" htmlFor={id(k)}>
            {t(`health.${k}`)}
          </label>
          <textarea id={id(k)} className="input" style={{ minHeight: 64 }} value={p[k]} maxLength={300} placeholder={t(`family.ph.${k}`)} onChange={(e) => set(k, e.target.value)} />
        </div>
      ))}
      <label className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
        <input type="checkbox" checked={p.main} onChange={(e) => set('main', e.target.checked)} />
        <span>{t('family.main')}</span>
      </label>
      <div className="row">
        <button className="btn primary" type="submit" data-testid="save-person">
          {t('common.save')}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        {onRemove && (
          <button className="btn ghost" type="button" onClick={onRemove}>
            {t('common.remove')}
          </button>
        )}
      </div>
    </form>
  )
}

function ContactForm(props: { value: HouseContact; onChange: (c: HouseContact) => void; onSave: (c: HouseContact) => void; onCancel: () => void; onRemove?: () => void }) {
  const { t } = useUi()
  const { value: c, onChange, onSave, onCancel, onRemove } = props
  const set = <K extends keyof HouseContact>(k: K, v: HouseContact[K]) => onChange({ ...c, [k]: v })
  const id = (k: string) => `c-${c.id}-${k}`
  return (
    <form
      className="edit-box stack"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...c, name: c.name.trim(), number: c.number.trim() })
      }}
      data-testid="contact-form"
    >
      <div className="two-col">
        <div>
          <label className="field" htmlFor={id('name')}>
            {t('family.name')}
          </label>
          <input id={id('name')} className="input" value={c.name} maxLength={40} required autoComplete="off" onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className="field" htmlFor={id('relation')}>
            {t('family.relation')}
          </label>
          <input id={id('relation')} className="input" value={c.relation} maxLength={30} placeholder={t('family.ph.relation')} autoComplete="off" onChange={(e) => set('relation', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="field" htmlFor={id('number')}>
          {t('guard.number')}
        </label>
        <input
          id={id('number')}
          className="input"
          type="tel"
          inputMode="tel"
          value={c.number}
          maxLength={20}
          autoComplete="off"
          onChange={(e) => set('number', e.target.value.replace(/[^\d+ ]/g, ''))}
        />
      </div>
      <fieldset className="contact">
        <legend>{t('family.roles')}</legend>
        {(['call', 'text', 'guardian'] as const).map((k) => (
          <label key={k} className="row" style={{ gap: 10, alignItems: 'flex-start', marginTop: 6 }}>
            <input type="checkbox" checked={c[k]} onChange={(e) => set(k, e.target.checked)} data-testid={`role-${k}`} />
            <span>{t(`family.roleLong.${k}`)}</span>
          </label>
        ))}
      </fieldset>
      <div className="row">
        <button className="btn primary" type="submit" data-testid="save-contact">
          {t('common.save')}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        {onRemove && (
          <button className="btn ghost" type="button" onClick={onRemove}>
            {t('common.remove')}
          </button>
        )}
      </div>
    </form>
  )
}
