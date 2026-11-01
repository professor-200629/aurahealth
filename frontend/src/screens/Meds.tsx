import { useEffect, useState } from 'react'
import { clockOf, loadDoses, mainPerson, newMed, personName, today, useHousehold } from '../household'
import type { Med, TodayDose } from '../household'
import { isNativeApp, native, nativeJson, onNativeEvent } from '../native'
import { Icon, useUi } from '../ui'

const WAITS = [15, 30, 60, 120]

interface MedStatus {
  exact: boolean
  notify: boolean
  sms: boolean
}

/** Medicine reminders. Android runs them; if a dose is not marked taken in time, the guardians get a text. */
export function Meds({ onFamily }: { onFamily: () => void }) {
  const { t } = useUi()
  const [h, save] = useHousehold()
  const [doses, setDoses] = useState(loadDoses)
  const [editing, setEditing] = useState<Med | null>(null)
  const [, setNow] = useState(Date.now())
  const [tried, setTried] = useState(false)
  const inApp = isNativeApp()
  const status = nativeJson<MedStatus>((b) => b.medStatus?.())

  useEffect(
    () =>
      onNativeEvent((e) => {
        if (e.type === 'meds') setDoses(loadDoses())
      }),
    [],
  )
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now())
      setDoses(loadDoses())
    }, 30000)
    return () => window.clearInterval(id)
  }, [])

  const guardians = h.contacts.filter((c) => c.guardian && c.number.trim())
  const list = today(h, doses)
  const saveMed = (m: Med) => {
    const clean = { ...m, name: m.name.trim(), dose: m.dose.trim(), times: [...new Set(m.times.filter(Boolean))].sort(), since: Date.now() }
    const exists = h.meds.some((x) => x.id === m.id)
    save({ ...h, meds: exists ? h.meds.map((x) => (x.id === m.id ? clean : x)) : [...h.meds, clean] })
    setEditing(null)
  }
  const removeMed = (m: Med) => {
    if (!window.confirm(t('meds.removeConfirm', { name: m.name }))) return
    save({ ...h, meds: h.meds.filter((x) => x.id !== m.id) })
    setEditing(null)
  }
  const toggle = (m: Med) => save({ ...h, meds: h.meds.map((x) => (x.id === m.id ? { ...x, on: !x.on, since: Date.now() } : x)) })
  const taken = (d: TodayDose) => {
    if (d.key && native()?.markTaken?.(d.key)) setDoses(loadDoses())
  }
  const tryIt = () => {
    native()?.testMedicine?.(mainPerson(h)?.id ?? '')
    setTried(true)
    window.setTimeout(() => setTried(false), 150000)
  }

  return (
    <div className="stack">
      <div>
        <h1>{t('meds.title')}</h1>
        <p className="muted">{t('meds.lead')}</p>
      </div>
      {!inApp && (
        <div className="banner info" data-testid="meds-web-only">
          <Icon name="info" />
          <span>{t('meds.webOnly')}</span>
        </div>
      )}
      {inApp && status && (!status.notify || !status.sms || !status.exact) && (
        <div className="banner warn" data-testid="meds-perms">
          <Icon name="alert" />
          <span>
            {[!status.notify && t('meds.perm.notify'), !status.sms && t('meds.perm.sms'), !status.exact && t('meds.perm.exact')].filter(Boolean).join(' ')}{' '}
            {(!status.notify || !status.sms) && (
              <button className="link-btn" onClick={() => native()?.requestPermissions?.()}>
                {t('guard.allow')}
              </button>
            )}
          </span>
        </div>
      )}

      <section className="card stack" aria-labelledby="today-title">
        <h2 id="today-title" style={{ margin: 0 }}>
          {t('meds.today')}
        </h2>
        {list.length === 0 && <p className="small muted">{t('meds.todayEmpty')}</p>}
        {list.map((d) => (
          <div key={`${d.key ?? d.med?.id}-${d.due}`} className={`list-row dose dose-${d.status}`} data-testid="dose-row">
            <div>
              <strong>
                {clockOf(d.due)} · {d.name}
              </strong>
              {d.dose && <span className="muted"> · {d.dose}</span>}
              <div className="small muted">
                {[personName(h, d.person), t(`meds.status.${d.status}`, { time: d.takenAt ? clockOf(d.takenAt) : '' }), d.status === 'missed' && (d.guardians ? t('meds.toldGuardians', { n: d.guardians }) : t('meds.toldNobody'))]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            {d.key && (d.status === 'due' || d.status === 'missed') && (
              <button className="btn primary" onClick={() => taken(d)} data-testid="dose-taken">
                <Icon name="check" /> {t('meds.taken')}
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="card stack" aria-labelledby="reminders-title">
        <h2 id="reminders-title" style={{ margin: 0 }}>
          {t('meds.reminders')}
        </h2>
        {h.meds.length === 0 && !editing && <p className="small muted">{t('meds.remindersEmpty')}</p>}
        {h.meds.map((m) =>
          editing?.id === m.id ? (
            <MedForm key={m.id} value={editing} onChange={setEditing} onSave={saveMed} onCancel={() => setEditing(null)} onRemove={() => removeMed(m)} />
          ) : (
            <div key={m.id} className={`list-row ${m.on ? '' : 'off'}`} data-testid="med-row">
              <div>
                <strong>{m.name}</strong>
                {m.dose && <span className="muted"> · {m.dose}</span>}
                <div className="small muted">
                  {[personName(h, m.person) && t('meds.for', { name: personName(h, m.person) }), m.times.join(', '), t('meds.waitShort', { n: m.wait })].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                <button className="btn ghost" onClick={() => toggle(m)} aria-pressed={m.on}>
                  {m.on ? t('meds.pause') : t('meds.resume')}
                </button>
                <button className="btn ghost" onClick={() => setEditing(m)}>
                  {t('common.edit')}
                </button>
              </div>
            </div>
          ),
        )}
        {editing && !h.meds.some((x) => x.id === editing.id) && <MedForm value={editing} onChange={setEditing} onSave={saveMed} onCancel={() => setEditing(null)} />}
        {!editing && (
          <button className="btn secondary" onClick={() => setEditing(newMed(mainPerson(h)?.id ?? ''))} data-testid="add-med">
            <Icon name="plus" /> {t('meds.add')}
          </button>
        )}
        <p className="tiny muted" style={{ margin: 0 }}>
          {t('meds.noAdvice')}
        </p>
      </section>

      <section className="card stack" aria-labelledby="guardian-title">
        <h2 id="guardian-title" style={{ margin: 0 }}>
          {t('meds.guardians')}
        </h2>
        {guardians.length ? (
          <p style={{ margin: 0 }} data-testid="guardian-list">
            {t('meds.guardiansAre', { names: guardians.map((g) => g.name || g.number).join(', ') })}
          </p>
        ) : (
          <div className="banner warn" data-testid="no-guardian">
            <Icon name="alert" />
            <span>{t('meds.noGuardian')}</span>
          </div>
        )}
        <button className="btn ghost" onClick={onFamily}>
          {t('meds.editGuardians')}
        </button>
        {inApp && (
          <>
            <button className="btn secondary" onClick={tryIt} disabled={tried} data-testid="meds-try">
              {tried ? t('meds.tryStarted') : t('meds.try')}
            </button>
            <p className="tiny muted" style={{ margin: 0 }}>
              {guardians.length ? t('meds.tryNote') : t('meds.tryNoteNobody')}
            </p>
          </>
        )}
      </section>
    </div>
  )
}

function MedForm(props: { value: Med; onChange: (m: Med) => void; onSave: (m: Med) => void; onCancel: () => void; onRemove?: () => void }) {
  const { t } = useUi()
  const [h] = useHousehold()
  const { value: m, onChange, onSave, onCancel, onRemove } = props
  const set = <K extends keyof Med>(k: K, v: Med[K]) => onChange({ ...m, [k]: v })
  const id = (k: string) => `m-${m.id}-${k}`
  return (
    <form
      className="edit-box stack"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(m)
      }}
      data-testid="med-form"
    >
      {h.people.length > 0 && (
        <div>
          <label className="field" htmlFor={id('person')}>
            {t('meds.forWhom')}
          </label>
          <select id={id('person')} className="input" value={m.person} onChange={(e) => set('person', e.target.value)}>
            <option value="">{t('meds.nobody')}</option>
            {h.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || t('family.noName')}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="field" htmlFor={id('name')}>
          {t('meds.name')}
        </label>
        <input id={id('name')} className="input" value={m.name} maxLength={60} required autoComplete="off" placeholder={t('meds.ph.name')} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div>
        <label className="field" htmlFor={id('dose')}>
          {t('meds.dose')}
        </label>
        <input id={id('dose')} className="input" value={m.dose} maxLength={60} autoComplete="off" placeholder={t('meds.ph.dose')} onChange={(e) => set('dose', e.target.value)} />
      </div>
      <fieldset className="contact">
        <legend>{t('meds.times')}</legend>
        {m.times.map((time, i) => (
          <div key={i} className="row" style={{ marginTop: 6 }}>
            <input
              type="time"
              className="input time-input"
              value={time}
              required
              aria-label={t('meds.time', { n: i + 1 })}
              onChange={(e) => set('times', m.times.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {m.times.length > 1 && (
              <button type="button" className="btn ghost" onClick={() => set('times', m.times.filter((_, j) => j !== i))}>
                {t('common.remove')}
              </button>
            )}
          </div>
        ))}
        {m.times.length < 6 && (
          <button type="button" className="btn ghost" style={{ marginTop: 6 }} onClick={() => set('times', [...m.times, '20:00'])}>
            <Icon name="plus" /> {t('meds.addTime')}
          </button>
        )}
      </fieldset>
      <div>
        <label className="field" htmlFor={id('wait')}>
          {t('meds.wait')}
        </label>
        <select id={id('wait')} className="input" value={m.wait} onChange={(e) => set('wait', Number(e.target.value))}>
          {WAITS.map((w) => (
            <option key={w} value={w}>
              {t('meds.waitOption', { n: w })}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <button className="btn primary" type="submit" data-testid="save-med">
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
