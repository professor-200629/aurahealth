// First-aid guides are bundled at build time, so they work with no laptop and no internet.
// The text is fixed (adapted from the IFRC 2020 guidelines); no model writes or changes it.
import pack from '../../packs/guides/en.json'
import { EMERGENCY_NUMBER } from './i18n'

export type StepKind = 'action' | 'call' | 'cpr' | 'question'

export interface GuideChoice {
  id: string
  label: string
  goto: string
}

export interface GuideStep {
  id: string
  kind: StepKind
  text: string
  log: string
  choices?: GuideChoice[]
  optional?: boolean
  end?: boolean
}

export interface Guide {
  id: string
  chat_now?: string // what to do first, shown at once by Talk to Aura (from this guide's own steps)
  title: string
  when: string
  source_pages: string
  steps: GuideStep[]
  do_not: string[]
  notes: string[]
  links?: { label: string; goto: string }[]
}

export const GUIDE_META = pack.meta
export const GUIDE_LIST = pack.guides as Guide[]
export const GUIDES: Record<string, Guide> = Object.fromEntries(GUIDE_LIST.map((g) => [g.id, g]))

export const fill = (text: string) => text.replace(/\{number\}/g, EMERGENCY_NUMBER)
