import { GUIDE_LIST, GUIDE_META } from '../guides'
import { Dual, useUi } from '../ui'

export function Help({ onPick }: { onPick: (guideId: string) => void }) {
  const { t, lang } = useUi()
  const [start, ...rest] = GUIDE_LIST
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
