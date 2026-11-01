import { useState } from 'react'
import { mainPerson, useHousehold } from '../household'
import type { Person } from '../household'
import { canSpeak, speak } from '../speech'
import { Icon, useUi } from '../ui'

const FIELDS = ['blood', 'conditions', 'allergies', 'medicines', 'notes'] as const

/** What to tell the emergency operator about a person, from Family & health. Works with no laptop and no internet. */
export function HealthCard({ onEdit }: { onEdit: () => void }) {
  const { t } = useUi()
  const [h] = useHousehold()
  const people = h.people.filter((p) => p.name.trim())
  const [pickedId, setPickedId] = useState<string | null>(null)
  const person = people.find((p) => p.id === pickedId) ?? (mainPerson({ ...h, people }) as Person | undefined)

  if (!person) {
    return (
      <section className="card flat stack" data-testid="health-card-empty">
        <div className="row" style={{ gap: 10 }}>
          <Icon name="people" />
          <h2 style={{ margin: 0 }}>{t('health.emptyTitle')}</h2>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {t('health.emptyNote')}
        </p>
        <button className="btn primary" onClick={onEdit} data-testid="health-add">
          {t('health.add')}
        </button>
      </section>
    )
  }

  const lines = FIELDS.filter((f) => person[f].trim()).map((f) => ({ f, text: person[f].trim() }))
  const read = () =>
    speak(
      [
        person.age ? t('health.sayAge', { name: person.name, age: person.age }) : person.name,
        ...lines.map((l) => `${t(`health.${l.f}`)}: ${l.text}`),
      ].join('. '),
    )

  return (
    <section className="card health-card stack" aria-labelledby="health-title" data-testid="health-card">
      <div className="row between">
        <h2 id="health-title" style={{ margin: 0 }}>
          {t('health.title')}
        </h2>
        <button className="btn ghost" onClick={onEdit}>
          {t('common.edit')}
        </button>
      </div>
      {people.length > 1 && (
        <div className="row" role="tablist" aria-label={t('health.who')}>
          {people.map((p) => (
            <button key={p.id} role="tab" aria-selected={p.id === person.id} className={`chip-btn ${p.id === person.id ? 'on' : ''}`} onClick={() => setPickedId(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
      )}
      <div>
        <p className="health-name">
          {person.name}
          {person.age && <span className="muted"> · {t('health.age', { age: person.age })}</span>}
        </p>
        {lines.length ? (
          <dl className="health-lines">
            {lines.map((l) => (
              <div key={l.f}>
                <dt>{t(`health.${l.f}`)}</dt>
                <dd>{l.text}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="small muted">{t('health.noDetails')}</p>
        )}
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>
        {t('health.note')}
      </p>
      {canSpeak() && (
        <button className="btn secondary" onClick={read} data-testid="health-read">
          <Icon name="speaker" /> {t('health.read')}
        </button>
      )}
    </section>
  )
}
