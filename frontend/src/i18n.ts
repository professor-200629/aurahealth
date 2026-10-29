// Language and region packs are bundled at build time, so the emergency path works
// even if the laptop server is unreachable after the page has loaded.
import en from '../../packs/i18n/en.json'
import te from '../../packs/i18n/te.json'
import IN from '../../packs/regions/IN.json'
import type { Lang } from './types'

type Pack = Record<string, string> & { meta?: unknown }

const PACKS: Record<Lang, Pack> = { en: en as unknown as Pack, te: te as unknown as Pack }

export const REGION = IN
export const EMERGENCY_NUMBER = IN.emergency.number
export const TEL_URI = IN.emergency.tel_uri

export const LANGUAGES: { code: Lang; native: string; review: string }[] = [
  { code: 'en', native: en.meta.native_name, review: en.meta.review },
  { code: 'te', native: te.meta.native_name, review: te.meta.review },
]

export function makeT(lang: Lang) {
  const pack = PACKS[lang] ?? PACKS.en
  return (key: string, vars: Record<string, string | number> = {}) => {
    const raw = (pack[key] as string | undefined) ?? (PACKS.en[key] as string | undefined) ?? key
    return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? (name === 'number' ? EMERGENCY_NUMBER : `{${name}}`)))
  }
}

/** English baseline, shown under unreviewed translations for safety-critical lines. */
export const tEn = makeT('en')

export type T = ReturnType<typeof makeT>
