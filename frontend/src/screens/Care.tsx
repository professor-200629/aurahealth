import { useEffect, useMemo, useState } from 'react'
import { phoneAiReady, readPlan, shrinkPhoto } from '../aura'
import type { PlanDraft } from '../aura'
import { FEELINGS, SAMPLE_PLAN, addSampleDays, dayItems, feelingTrend, history, kindOf, planEnd, planProgress, removePlan, removeSampleDays, saveCheckIn, savePlan, score, setDone, streak } from '../care'
import type { DayItem, HistoryDay } from '../care'
import { clockOf, dayKey, loadDoses, mainPerson, newMed, newPlan, personName, useHousehold } from '../household'
import type { CarePlan, Household, Med, TaskKind } from '../household'
import { isNativeApp, onNativeEvent } from '../native'
import { shareText } from '../nearby'
import { readingAnswer } from '../readings'
import { Icon, useUi } from '../ui'

const KINDS: TaskKind[] = ['medicine', 'food', 'exercise', 'care']
const LENGTHS = [7, 30, 90, 180, 365]
// 7 Jan 2024 was a Sunday, and the names come in the phone's own language.
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6].map((d) => new Date(2024, 0, 7 + d).toLocaleDateString([], { weekday: 'long' }))
const shortDate = (ms: number) => new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'short' })

/** Today: progress, the day's list, how the person feels, the doctor's plans and how each day went. */
export function Care({ onMeds }: { onMeds: () => void }) {
  const { t } = useUi()
  const [h, save] = useHousehold()
  const [doses, setDoses] = useState(loadDoses)
  const [, setTick] = useState(0)
  const [editing, setEditing] = useState<{ plan: CarePlan; tasks: Med[]; fromPhoto: boolean } | null>(null)
  useEffect(() => onNativeEvent((e) => e.type === 'meds' && setDoses(loadDoses())), [])
  useEffect(() => {
    const id = window.setInterval(() => {
      setDoses(loadDoses())
      setTick((n) => n + 1)
    }, 30000)
    return () => window.clearInterval(id)
  }, [])

  const items = dayItems(h, doses)
  const today = score(items)
  const days = useMemo(() => history(h, doses), [h, doses])
  const run = streak(days)
  const next = items.find((i) => i.status === 'due') ?? items.find((i) => i.status === 'upcoming')
  const running = h.plans.filter((p) => !planProgress(p).finished)
  const finished = h.plans.filter((p) => planProgress(p).finished)

  const startPlan = (draft?: PlanDraft) => {
    const person = mainPerson(h)?.id ?? ''
    const plan = newPlan(person)
    if (!draft) return setEditing({ plan, tasks: [{ ...newMed(person), times: ['08:00'] }], fromPhoto: false })
    plan.title = draft.title
    plan.doctor = draft.doctor
    plan.days = draft.days > 0 ? draft.days : plan.days
    plan.precautions = draft.precautions
    plan.followUp = draft.followUp
    const tasks = draft.tasks.map((x) => ({ ...newMed(person), kind: x.kind, name: x.text, dose: [x.dose, x.note].filter(Boolean).join(', '), times: x.times, weekday: x.weekday, until: x.days > 0 ? planEnd(plan, x.days) : undefined }))
    setEditing({ plan, tasks: tasks.length ? tasks : [{ ...newMed(person), times: ['08:00'] }], fromPhoto: true })
  }

  if (editing) {
    return (
      <PlanForm
        key={editing.plan.id}
        {...editing}
        household={h}
        onCancel={() => setEditing(null)}
        onSave={(plan, tasks) => {
          if (savePlan(h, save, plan, tasks)) setEditing(null)
        }}
        onRemove={
          h.plans.some((p) => p.id === editing.plan.id)
            ? () => {
                if (!window.confirm(t('care.removeConfirm', { name: editing.plan.title }))) return
                removePlan(h, save, editing.plan)
                setEditing(null)
              }
            : undefined
        }
      />
    )
  }

  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: 0 }}>{t('care.title')}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>
      {!isNativeApp() && (
        <div className="banner info" data-testid="care-web">
          <Icon name="info" />
          <span>{t('care.webNote')}</span>
        </div>
      )}

      {h.plans.some((p) => p.id === SAMPLE_PLAN) && (
        <div className="banner warn" data-testid="care-sample">
          <Icon name="alert" />
          <span>
            {t('care.sampleNote')}{' '}
            <button className="link-btn" onClick={() => removeSampleDays(h, save)} data-testid="care-sample-remove">
              {t('care.sampleRemove')}
            </button>
          </span>
        </div>
      )}

      <section className="card care-today" data-testid="care-progress">
        <Ring pct={today.pct} />
        <div style={{ minWidth: 0 }}>
          {today.total ? (
            <>
              <strong className="care-big" data-testid="care-count">
                {t('care.doneOf', { done: today.done, total: today.total })}
              </strong>
              <div className="small muted">{today.done >= today.total ? t('care.allDone') : next ? t('care.next', { name: next.med.name, time: next.due ? clockOf(next.due) : t('care.anyTime') }) : t('care.stillOpen', { n: today.total - today.done })}</div>
              {run > 1 && <div className="small care-streak">{t('care.streak', { n: run })}</div>}
            </>
          ) : (
            <>
              <strong className="care-big">{t('care.emptyTitle')}</strong>
              <div className="small muted">{t('care.emptyNote')}</div>
            </>
          )}
        </div>
      </section>

      {items.length > 0 && (
        <section className="card stack" aria-labelledby="care-list">
          <h2 id="care-list" style={{ margin: 0 }}>
            {t('care.todayList')}
          </h2>
          {items.map((i) => (
            <ItemRow key={i.id} item={i} household={h} onToggle={(v) => setDone(h, save, i, v)} />
          ))}
        </section>
      )}

      <PlansCard running={running} finished={finished} onNew={startPlan} onEdit={(plan) => setEditing({ plan, tasks: h.meds.filter((m) => m.plan === plan.id), fromPhoto: false })} />

      <CheckIn household={h} save={save} />

      <RecordCard household={h} days={days} />

      <section className="card stack">
        {!h.plans.length && (
          <button className="btn ghost" onClick={() => addSampleDays(h, save, mainPerson(h)?.id ?? '')} data-testid="care-sample-add">
            {t('care.sampleAdd')}
          </button>
        )}
        <button className="btn secondary" onClick={onMeds} data-testid="care-meds">
          <Icon name="pill" /> {t('care.manageMeds')}
        </button>
        {isNativeApp() && (
          <label className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={!h.noStatusBar} onChange={(e) => save({ ...h, noStatusBar: !e.target.checked })} data-testid="care-statusbar" />
            <span className="small">{t('care.statusBar')}</span>
          </label>
        )}
        <p className="tiny muted" style={{ margin: 0 }}>
          {t('care.noAdvice')}
        </p>
      </section>
    </div>
  )
}

function Ring({ pct }: { pct: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <svg className="care-ring" width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`${pct}%`}>
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--accent-soft)" strokeWidth="10" />
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 42 42)" />
      <text x="42" y="48" textAnchor="middle" fontSize="19" fontWeight="750" fill="var(--ink)">
        {pct}%
      </text>
    </svg>
  )
}

function ItemRow({ item: i, household: h, onToggle }: { item: DayItem; household: Household; onToggle: (v: boolean) => void }) {
  const { t } = useUi()
  const who = personName(h, i.med.person)
  const line = [i.med.dose, who, i.med.weekday !== undefined && t('care.weekly'), i.time ?? t('care.anyTime')].filter(Boolean).join(' · ')
  return (
    <label className={`care-item care-${i.status}`} data-testid="care-item">
      <input type="checkbox" checked={i.done} disabled={i.byReminder} onChange={(e) => onToggle(e.target.checked)} data-testid="care-check" />
      <span style={{ minWidth: 0 }}>
        <strong>{i.med.name}</strong>
        <span className="small muted" style={{ display: 'block' }}>
          {line}
        </span>
        {i.status === 'missed' && (
          <span className="small care-late" style={{ display: 'block' }}>
            {i.kind === 'medicine' ? (i.guardians ? t('meds.toldGuardians', { n: i.guardians }) : t('care.missed')) : t('care.missed')}
          </span>
        )}
      </span>
      <span className={`care-kind kind-${i.kind}`}>{t(`care.kind.${i.kind}`)}</span>
    </label>
  )
}

function PlansCard({ running, finished, onNew, onEdit }: { running: CarePlan[]; finished: CarePlan[]; onNew: (d?: PlanDraft) => void; onEdit: (p: CarePlan) => void }) {
  const { t } = useUi()
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const read = async (file: File) => {
    setReading(true)
    setError('')
    try {
      const r = await readPlan(await shrinkPhoto(file))
      if ('draft' in r) onNew(r.draft)
      else setError(t(r.error === 'timeout' ? 'chat.aiSlow' : r.error === 'network' ? 'chat.noInternet' : 'chat.aiFailed'))
    } catch {
      setError(t('chat.photoBad'))
    }
    setReading(false)
  }
  return (
    <section className="card stack" aria-labelledby="care-plans" data-testid="care-plans">
      <h2 id="care-plans" style={{ margin: 0 }}>
        {t('care.plans')}
      </h2>
      {!running.length && !finished.length && <p className="small muted" style={{ margin: 0 }}>{t('care.plansEmpty')}</p>}
      {running.map((p) => (
        <PlanRow key={p.id} plan={p} onEdit={() => onEdit(p)} />
      ))}
      {reading && (
        <p className="small" role="status" data-testid="care-reading" style={{ margin: 0 }}>
          {t('care.reading')}
        </p>
      )}
      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}
      {phoneAiReady() && (
        <label className={`btn primary block ${reading ? 'disabled' : ''}`} data-testid="care-photo">
          <Icon name="doc" /> {t('care.fromPhoto')}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={reading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void read(file)
            }}
          />
        </label>
      )}
      <button className="btn secondary block" onClick={() => onNew()} data-testid="care-new">
        <Icon name="plus" /> {t('care.typePlan')}
      </button>
      {finished.length > 0 && (
        <details className="answer-more">
          <summary>{t('care.finished', { n: finished.length })}</summary>
          {finished.map((p) => (
            <PlanRow key={p.id} plan={p} onEdit={() => onEdit(p)} />
          ))}
        </details>
      )}
    </section>
  )
}

function PlanRow({ plan, onEdit }: { plan: CarePlan; onEdit: () => void }) {
  const { t } = useUi()
  const [h] = useHousehold()
  const p = planProgress(plan)
  const who = personName(h, plan.person)
  return (
    <div className="care-plan" data-testid="care-plan">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: 8 }}>
        <strong style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{plan.title || t('care.untitled')}</strong>
        <button className="btn ghost" onClick={onEdit} data-testid="care-edit">
          {t('common.edit')}
        </button>
      </div>
      <div className="small muted">{[who, plan.doctor].filter(Boolean).join(' · ')}</div>
      <div className="care-bar" role="img" aria-label={`${p.pct}%`}>
        <span style={{ width: `${p.pct}%` }} />
      </div>
      <div className="small" data-testid="care-day">
        {p.finished ? t('care.courseDone', { days: p.days }) : t('care.dayOf', { day: p.day, days: p.days, left: p.left })}
      </div>
      {plan.precautions.length > 0 && (
        <details className="answer-more">
          <summary>{t('care.precautions')}</summary>
          <ul style={{ margin: '6px 0', paddingLeft: 20 }}>
            {plan.precautions.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </details>
      )}
      {plan.followUp && <div className="small muted">{t('care.followUp', { text: plan.followUp })}</div>}
    </div>
  )
}

function PlanForm(props: { plan: CarePlan; tasks: Med[]; fromPhoto: boolean; household: Household; onSave: (p: CarePlan, t: Med[]) => void; onCancel: () => void; onRemove?: () => void }) {
  const { t } = useUi()
  const { household: h, fromPhoto, onSave, onCancel, onRemove } = props
  const [plan, setPlan] = useState(props.plan)
  const [tasks, setTasks] = useState(props.tasks)
  const [precautions, setPrecautions] = useState(props.plan.precautions.join('\n'))
  const custom = !LENGTHS.includes(plan.days)
  const change = (id: string, patch: Partial<Med>) => setTasks(tasks.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  return (
    <form
      className="stack"
      data-testid="care-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...plan, title: plan.title.trim(), doctor: plan.doctor.trim(), precautions: precautions.split('\n').map((x) => x.trim()).filter(Boolean) }, tasks)
      }}
    >
      <h1 style={{ marginBottom: 0 }}>{t('care.planTitle')}</h1>
      {fromPhoto && (
        <div className="banner warn" data-testid="care-check-paper">
          <Icon name="alert" />
          <span>{t('care.checkPaper')}</span>
        </div>
      )}
      <section className="card stack">
        <div>
          <label className="field" htmlFor="plan-title">
            {t('care.name')}
          </label>
          <input id="plan-title" className="input" value={plan.title} maxLength={70} required autoComplete="off" placeholder={t('care.ph.name')} onChange={(e) => setPlan({ ...plan, title: e.target.value })} data-testid="plan-title" />
        </div>
        <div>
          <label className="field" htmlFor="plan-doctor">
            {t('care.doctor')}
          </label>
          <input id="plan-doctor" className="input" value={plan.doctor} maxLength={70} autoComplete="off" onChange={(e) => setPlan({ ...plan, doctor: e.target.value })} />
        </div>
        {h.people.length > 0 && (
          <div>
            <label className="field" htmlFor="plan-person">
              {t('meds.forWhom')}
            </label>
            <select id="plan-person" className="input" value={plan.person} onChange={(e) => setPlan({ ...plan, person: e.target.value })}>
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
          <label className="field" htmlFor="plan-length">
            {t('care.length')}
          </label>
          <select id="plan-length" className="input" value={custom ? 'custom' : String(plan.days)} onChange={(e) => setPlan({ ...plan, days: e.target.value === 'custom' ? 14 : Number(e.target.value) })} data-testid="plan-length">
            {LENGTHS.map((d) => (
              <option key={d} value={d}>
                {t(`care.len.${d}`)}
              </option>
            ))}
            <option value="custom">{t('care.lenCustom')}</option>
          </select>
          {custom && (
            <input className="input" style={{ marginTop: 8 }} type="number" min={1} max={1825} value={plan.days} aria-label={t('care.lenCustom')} onChange={(e) => setPlan({ ...plan, days: Math.max(1, Math.min(1825, Number(e.target.value) || 1)) })} />
          )}
        </div>
      </section>
      <section className="card stack">
        <h2 style={{ margin: 0 }}>{t('care.daily')}</h2>
        <p className="tiny muted" style={{ margin: 0 }}>{t('care.dailyNote')}</p>
        {tasks.map((m, index) => (
          <div key={m.id} className="edit-box stack" data-testid="plan-task">
            <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <select className="input" style={{ width: 'auto', flex: 'none' }} value={kindOf(m)} aria-label={t('care.kindLabel')} onChange={(e) => change(m.id, { kind: e.target.value as TaskKind })} data-testid="task-kind">
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`care.kind.${k}`)}
                  </option>
                ))}
              </select>
              <button type="button" className="btn ghost" onClick={() => setTasks(tasks.filter((x) => x.id !== m.id))} aria-label={t('common.remove')}>
                {t('common.remove')}
              </button>
            </div>
            <input className="input" value={m.name} maxLength={80} autoComplete="off" placeholder={t(`care.ph.${kindOf(m)}`)} aria-label={t('care.what', { n: index + 1 })} onChange={(e) => change(m.id, { name: e.target.value })} data-testid="task-name" />
            {kindOf(m) === 'medicine' && <input className="input" value={m.dose} maxLength={80} autoComplete="off" placeholder={t('care.ph.dose')} aria-label={t('meds.dose')} onChange={(e) => change(m.id, { dose: e.target.value })} data-testid="task-dose" />}
            <select className="input" value={m.weekday ?? -1} aria-label={t('care.howOften')} onChange={(e) => change(m.id, { weekday: Number(e.target.value) < 0 ? undefined : Number(e.target.value) })} data-testid="task-repeat">
              <option value={-1}>{t('care.everyDay')}</option>
              {WEEKDAYS.map((name, d) => (
                <option key={d} value={d}>
                  {t('care.onceOn', { day: name })}
                </option>
              ))}
            </select>
            <div className="row" style={{ gap: 6 }}>
              {m.times.map((time, i) => (
                <span key={i} className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                  <input type="time" className="input time-input" value={time} aria-label={t('meds.time', { n: i + 1 })} onChange={(e) => change(m.id, { times: m.times.map((x, j) => (j === i ? e.target.value : x)) })} data-testid="task-time" />
                  <button type="button" className="btn ghost" aria-label={t('common.remove')} onClick={() => change(m.id, { times: m.times.filter((_, j) => j !== i) })}>
                    <Icon name="x" size={16} />
                  </button>
                </span>
              ))}
              {m.times.length < 6 && (
                <button type="button" className="btn ghost" onClick={() => change(m.id, { times: [...m.times, m.times.length ? '20:00' : '08:00'] })} data-testid="task-add-time">
                  <Icon name="plus" size={16} /> {t('meds.addTime')}
                </button>
              )}
            </div>
            {!m.times.length && <p className="tiny muted" style={{ margin: 0 }}>{t('care.noTime')}</p>}
            <p className="tiny muted" style={{ margin: 0 }} data-testid="task-until">
              {t('care.ends', { date: shortDate(m.until ?? planEnd(plan)) })}
            </p>
          </div>
        ))}
        <button type="button" className="btn secondary" onClick={() => setTasks([...tasks, { ...newMed(plan.person), kind: 'care', times: [] }])} data-testid="task-add">
          <Icon name="plus" /> {t('care.addItem')}
        </button>
      </section>
      <section className="card stack">
        <label className="field" htmlFor="plan-precautions" style={{ marginBottom: 0 }}>
          {t('care.precautionsLabel')}
        </label>
        <textarea id="plan-precautions" className="input" rows={3} value={precautions} placeholder={t('care.ph.precautions')} onChange={(e) => setPrecautions(e.target.value)} data-testid="plan-precautions" />
      </section>
      <div className="row">
        <button className="btn primary" type="submit" data-testid="plan-save">
          {t('common.save')}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        {onRemove && (
          <button className="btn ghost" type="button" onClick={onRemove} data-testid="plan-remove">
            {t('common.remove')}
          </button>
        )}
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>
        {t('care.noAdvice')}
      </p>
    </form>
  )
}

function CheckIn({ household: h, save }: { household: Household; save: (h: Household) => boolean }) {
  const { t } = useUi()
  const log = h.days[dayKey()]
  const [bp, setBp] = useState(log?.bp ?? '')
  const [sugar, setSugar] = useState(log?.sugar ?? '')
  const [temp, setTemp] = useState(log?.temp ?? '')
  const [weight, setWeight] = useState(log?.weight ?? '')
  const [note, setNote] = useState(log?.note ?? '')
  const [notes, setNotes] = useState<{ text: string; urgent: boolean }[]>([])
  const [saved, setSaved] = useState(false)
  const store = () => {
    saveCheckIn(h, save, { bp: bp.trim(), sugar: sugar.trim(), temp: temp.trim(), weight: weight.trim(), note: note.trim() })
    setSaved(true)
    // The numbers get the same fixed explanation as in Talk to Aura, with no AI.
    const asks = [bp.trim() && `BP ${bp.trim()}`, sugar.trim() && `sugar ${sugar.trim()}`, temp.trim() && `temperature ${temp.trim()}`].filter(Boolean) as string[]
    setNotes(asks.map((q) => readingAnswer(q)).filter((a) => !!a).map((a) => ({ text: a!.text, urgent: a!.action === 'call_emergency' })))
  }
  return (
    <section className="card stack" aria-labelledby="care-checkin" data-testid="care-checkin">
      <h2 id="care-checkin" style={{ margin: 0 }}>
        {t('care.howToday')}
      </h2>
      <div className="care-feel" role="group" aria-label={t('care.howToday')}>
        {FEELINGS.map((k, i) => (
          <button key={k} type="button" className={`chip-btn ${log?.feel === i + 1 ? 'on' : ''}`} aria-pressed={log?.feel === i + 1} onClick={() => saveCheckIn(h, save, { feel: i + 1 })} data-testid={`care-feel-${i + 1}`}>
            {t(k)}
          </button>
        ))}
      </div>
      <div className="care-numbers">
        <div>
          <label className="field" htmlFor="c-bp">{t('care.bp')}</label>
          <input id="c-bp" className="input" value={bp} inputMode="numeric" placeholder="120/80" maxLength={9} onChange={(e) => { setBp(e.target.value); setSaved(false) }} data-testid="care-bp" />
        </div>
        <div>
          <label className="field" htmlFor="c-sugar">{t('care.sugar')}</label>
          <input id="c-sugar" className="input" value={sugar} inputMode="numeric" placeholder="110" maxLength={5} onChange={(e) => { setSugar(e.target.value); setSaved(false) }} data-testid="care-sugar" />
        </div>
        <div>
          <label className="field" htmlFor="c-temp">{t('care.temp')}</label>
          <input id="c-temp" className="input" value={temp} inputMode="decimal" placeholder="98.6" maxLength={5} onChange={(e) => { setTemp(e.target.value); setSaved(false) }} data-testid="care-temp" />
        </div>
        <div>
          <label className="field" htmlFor="c-weight">{t('care.weight')}</label>
          <input id="c-weight" className="input" value={weight} inputMode="decimal" placeholder="60" maxLength={5} onChange={(e) => { setWeight(e.target.value); setSaved(false) }} data-testid="care-weight" />
        </div>
      </div>
      <div>
        <label className="field" htmlFor="c-note">{t('care.note')}</label>
        <input id="c-note" className="input" value={note} maxLength={140} autoComplete="off" onChange={(e) => { setNote(e.target.value); setSaved(false) }} data-testid="care-note" />
      </div>
      <button type="button" className="btn secondary" onClick={store} data-testid="care-save">
        {saved ? t('care.saved') : t('care.saveDay')}
      </button>
      {notes.map((n, i) => {
        const [first, ...rest] = n.text.split(/(?<=[.!?])\s+/)
        return (
          <div key={i} className={n.urgent ? 'answer-urgent' : 'answer-next'} data-testid="care-reading-note">
            <strong>{first}</strong>
            {rest.length > 0 && (
              <details className="answer-more" open={n.urgent}>
                <summary>{t('care.whatToDo')}</summary>
                <p>{rest.join(' ')}</p>
              </details>
            )}
          </div>
        )
      })}
    </section>
  )
}

function RecordCard({ household: h, days }: { household: Household; days: HistoryDay[] }) {
  const { t } = useUi()
  const [shared, setShared] = useState(false)
  const week = days.slice(-7)
  const totals = week.reduce((s, d) => ({ done: s.done + d.done, total: s.total + d.total }), { done: 0, total: 0 })
  const trend = feelingTrend(days)
  const hasFeel = days.some((d) => d.log?.feel)
  const hasAny = days.some((d) => d.total > 0 || d.log?.feel)
  const readings = [...days].reverse().filter((d) => d.log?.bp || d.log?.sugar || d.log?.temp || d.log?.weight).slice(0, 5)
  const share = async () => {
    const lines = [t('care.shareTitle')]
    for (const p of h.plans.filter((x) => !planProgress(x).finished)) {
      const q = planProgress(p)
      lines.push(`${p.title}: ${t('care.dayOf', { day: q.day, days: q.days, left: q.left })}`)
    }
    if (totals.total) lines.push(t('care.weekLine', { pct: Math.round((totals.done / totals.total) * 100), done: totals.done, total: totals.total }))
    for (const d of week) {
      const parts = [d.total ? t('care.doneOf', { done: d.done, total: d.total }) : '', d.log?.feel ? t(FEELINGS[d.log.feel - 1]) : '', d.log?.bp && `BP ${d.log.bp}`, d.log?.sugar && `${t('care.sugar')} ${d.log.sugar}`, d.log?.temp && `${t('care.temp')} ${d.log.temp}`, d.log?.weight && `${t('care.weight')} ${d.log.weight}`, d.log?.note].filter(Boolean)
      if (parts.length) lines.push(`${shortDate(d.date)}: ${parts.join(', ')}`)
    }
    lines.push(t('care.shareNote'))
    setShared(await shareText(lines.join('\n')))
  }
  return (
    <section className="card stack" aria-labelledby="care-record" data-testid="care-record">
      <h2 id="care-record" style={{ margin: 0 }}>
        {t('care.record')}
      </h2>
      {!hasAny && <p className="small muted" style={{ margin: 0 }}>{t('care.recordEmpty')}</p>}
      {totals.total > 0 && (
        <p style={{ margin: 0 }} data-testid="care-week">
          {t('care.weekLine', { pct: Math.round((totals.done / totals.total) * 100), done: totals.done, total: totals.total })}
        </p>
      )}
      {hasAny && (
        <div className="care-chart" role="img" aria-label={t('care.chartLabel')} data-testid="care-chart">
          {days.map((d) => (
            <div key={d.key} className="care-col" title={`${shortDate(d.date)}: ${d.done}/${d.total}`}>
              <div className="care-col-bar">
                <span className={d.total && d.done >= d.total ? 'full' : ''} style={{ height: `${d.total ? Math.max(6, d.pct) : 0}%` }} />
              </div>
              <span className="tiny muted">{new Date(d.date).getDate()}</span>
            </div>
          ))}
        </div>
      )}
      {hasFeel && (
        <>
          <h3 style={{ margin: 0, fontSize: 17 }}>{t('care.recovery')}</h3>
          <FeelLine days={days} />
          {trend && <p className="small" style={{ margin: 0 }} data-testid="care-trend">{t(`care.trend.${trend}`)}</p>}
        </>
      )}
      {readings.length > 0 && (
        <table className="care-table small" data-testid="care-readings">
          <thead>
            <tr>
              <th scope="col">{t('care.date')}</th>
              <th scope="col">{t('care.bp')}</th>
              <th scope="col">{t('care.sugar')}</th>
              <th scope="col">{t('care.temp')}</th>
              <th scope="col">{t('care.weight')}</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((d) => (
              <tr key={d.key}>
                <td>{shortDate(d.date)}</td>
                <td>{d.log?.bp || '-'}</td>
                <td>{d.log?.sugar || '-'}</td>
                <td>{d.log?.temp || '-'}</td>
                <td>{d.log?.weight || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {hasAny && (
        <button type="button" className="btn secondary" onClick={() => void share()} data-testid="care-share">
          {shared ? t('care.shared') : t('care.share')}
        </button>
      )}
    </section>
  )
}

function FeelLine({ days }: { days: HistoryDay[] }) {
  const { t } = useUi()
  const W = 320
  const H = 90
  const step = W / Math.max(1, days.length - 1)
  const y = (v: number) => H - 12 - ((v - 1) / 4) * (H - 24)
  const points = days.map((d, i) => (d.log?.feel ? { x: i * step, y: y(d.log.feel) } : null)).filter((p): p is { x: number; y: number } => !!p)
  return (
    <svg viewBox={`-6 0 ${W + 12} ${H}`} className="care-feelline" role="img" aria-label={t('care.recovery')} data-testid="care-feelline">
      <line x1="0" x2={W} y1={y(3)} y2={y(3)} stroke="var(--line-2)" strokeDasharray="4 4" />
      <polyline fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={points.map((p) => `${p.x},${p.y}`).join(' ')} />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4.5" fill="var(--accent)" />
      ))}
    </svg>
  )
}
