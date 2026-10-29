import { EMERGENCY_NUMBER, REGION } from './i18n'
import type { T } from './i18n'
import type { Handoff, HandoffItem, Lang, Provenance } from './types'

export const SECTIONS = ['person', 'age', 'what', 'onset', 'details', 'report'] as const
export type SectionKey = (typeof SECTIONS)[number]

const SECTION_TITLE: Record<SectionKey, string> = {
  person: 'card.person',
  age: 'card.age',
  what: 'card.what',
  onset: 'card.onset',
  details: 'card.details',
  report: 'card.report',
}

export const sectionOf = (item: HandoffItem): SectionKey => (item.section === 'report_current' ? 'report' : item.section)
export const sectionTitle = (t: T, s: SectionKey) => t(SECTION_TITLE[s])

export function itemText(t: T, item: HandoffItem): string {
  const v = item.value
  switch (item.section) {
    case 'person': {
      const who = v.choice === 'me' ? t('who.me') : t('who.someone')
      return v.label ? `${who} (${v.label})` : who
    }
    case 'age':
      return t(`age.${v.choice}`)
    case 'what':
      return v.text ?? ''
    case 'onset':
      return v.choice ? t(`onset.${v.choice}`) : (v.text ?? '')
    case 'details':
      return `${t(`details.${v.field}`)}: ${v.text}`
    case 'report':
      return `${v.label}: ${v.text}`
    case 'report_current':
      return v.current === 'yes' ? t('card.reportCurrent') : t('card.reportNotCurrent')
  }
}

export function unknownLabel(t: T, key: string): string {
  if (key.startsWith('details.')) return t(key)
  return sectionTitle(t, key as SectionKey)
}

const PROV_KEY: Record<Provenance, string> = {
  user: 'prov.user',
  user_split: 'prov.userSplit',
  doc_confirmed: 'prov.doc',
  doc_corrected: 'prov.docCorrected',
}
export const provLabel = (t: T, p: Provenance) => t(PROV_KEY[p])
export const provClass = (p: Provenance) => (p === 'doc_confirmed' ? 'doc' : p === 'doc_corrected' ? 'corrected' : 'user')

export const regionName = (lang: Lang) => (REGION.name as Record<string, string>)[lang] ?? REGION.name.en

/** Plain-text version for copy, download and reading aloud by the user. */
export function toPlainText(t: T, lang: Lang, h: Handoff, preparedAt: Date): string {
  const lines: string[] = []
  lines.push(`AuraHealth · ${t('review.title')}`)
  lines.push(t('card.simulation'))
  lines.push(t('card.prepared', { time: preparedAt.toLocaleString() }))
  lines.push(`${t('card.region')}: ${regionName(lang)} · ${t('card.number')}: ${EMERGENCY_NUMBER}`)
  for (const s of SECTIONS) {
    const items = h.items.filter((i) => sectionOf(i) === s)
    if (!items.length) continue
    lines.push('', sectionTitle(t, s))
    for (const i of items) lines.push(`- ${itemText(t, i)}  [${provLabel(t, i.provenance)}]`)
  }
  if (h.unknown.length) {
    lines.push('', `${t('card.unknown')}: ${h.unknown.map((k) => unknownLabel(t, k)).join(', ')}`)
  }
  lines.push('', t('card.notAssessed'))
  return lines.join('\n')
}
