import { useState } from 'react'
import { api } from '../api'
import { GUIDES, GUIDE_LIST, GUIDE_META } from '../guides'
import { Dual, Icon, useUi } from '../ui'

export function Help({ onPick }: { onPick: (guideId: string) => void }) {
  const { t, lang, health, serverDown } = useUi()
  const [start, ...rest] = GUIDE_LIST
  // The finder needs the laptop's text helper; on the phone alone the guide list is all there is.
  const finderReady = !!health?.models.text && !serverDown
  return (
    <div className="stack">
      <div>
        <h1>{t('help.title')}</h1>
        <Dual k="help.hint" className="muted" />
        {lang !== 'en' && <p className="small muted">{t('help.englishOnly')}</p>}
      </div>
      <button className="guide-pick start" onClick={() => onPick(start.id)} data-testid={`guide-${start.id}`}>
        <span className="title">{start.title}</span>
        <span className="when">{start.when}</span>
      </button>
      {finderReady && <GuideFinder onPick={onPick} />}
      <div className="guide-grid">
        {rest.map((g) => (
          <button key={g.id} className="guide-pick" onClick={() => onPick(g.id)} data-testid={`guide-${g.id}`}>
            <span className="title">{g.title}</span>
            <span className="when">{g.when}</span>
          </button>
        ))}
      </div>
      <section className="card flat small">
        <p style={{ margin: 0 }}>
          Steps adapted from the{' '}
          <a href={GUIDE_META.source.url} target="_blank" rel="noreferrer">
            {GUIDE_META.source.publisher} {GUIDE_META.source.title}
          </a>
          . {GUIDE_META.source.terms}
        </p>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          {GUIDE_META.review_note} {GUIDE_META.scope_note} {GUIDE_META.left_out}
        </p>
      </section>
    </div>
  )
}

/** Type what you see; Llama 3.2 3B points to guides and shows the words it matched. Nothing opens by itself. */
function GuideFinder({ onPick }: { onPick: (guideId: string) => void }) {
  const { t } = useUi()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [matches, setMatches] = useState<{ guide: string; quote: string }[] | null>(null)
  const [message, setMessage] = useState('')

  const find = async () => {
    setBusy(true)
    setMatches(null)
    setMessage('')
    try {
      const r = await api.guideFinder(text)
      if (r.status === 'ok') setMatches(r.matches.filter((m) => GUIDES[m.guide]))
      else if (r.status === 'no_match') setMessage(t('finder.none'))
      else if (r.status === 'unsupported_language') setMessage(t('finder.language'))
      else if (r.status !== 'empty') setMessage(t('finder.unavailable'))
    } catch {
      setMessage(t('finder.unavailable'))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button className="btn secondary block" onClick={() => setOpen(true)} data-testid="finder-open">
        {t('finder.open')}
      </button>
    )
  }
  return (
    <section className="card flat stack" data-testid="finder">
      <label htmlFor="finder-text" style={{ fontWeight: 700 }}>
        {t('finder.label')}
      </label>
      <textarea
        id="finder-text"
        className="input finder-input"
        value={text}
        maxLength={500}
        placeholder={t('finder.placeholder')}
        onChange={(e) => {
          setText(e.target.value)
          setMatches(null)
          setMessage('')
        }}
      />
      <button className="btn primary block" onClick={find} disabled={busy || !text.trim()} data-testid="finder-go">
        {busy ? t('finder.busy') : t('finder.go')}
      </button>
      <p className="small muted" style={{ margin: 0 }}>
        {t('finder.note')}
      </p>
      {matches && matches.length > 0 && (
        <div className="stack" data-testid="finder-matches">
          <p style={{ margin: 0, fontWeight: 700 }}>{t('finder.result')}</p>
          {matches.map((m) => (
            <button key={m.guide} className="guide-pick suggested" onClick={() => onPick(m.guide)} data-testid={`finder-${m.guide}`}>
              <span className="title">{GUIDES[m.guide].title}</span>
              <span className="when">{t('finder.matched', { quote: m.quote })}</span>
            </button>
          ))}
        </div>
      )}
      {message && (
        <div className="banner info" role="status" data-testid="finder-message">
          <Icon name="info" />
          <span>{message}</span>
        </div>
      )}
    </section>
  )
}
