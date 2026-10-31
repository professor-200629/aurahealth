export type Lang = 'en' | 'te'

export interface Point {
  id: string
  text: string
  source: 'user' | 'user_split'
  kept: boolean
  flag_instruction?: boolean
}

export interface DocField {
  id: string
  label: string
  model_value: string | null
  value: string
  status: 'proposed' | 'confirmed' | 'removed'
  origin: 'model' | 'user'
  flag_instruction: boolean
}

export interface DocumentState {
  id: string
  filename: string
  is_sample: boolean
  width: number
  height: number
  extraction: {
    status: 'not_started' | 'running' | 'done' | 'no_fields' | 'failed' | 'reader_missing'
    job?: string
    model?: string
    error?: string
    timing?: { wall_s: number; load_s: number; output_tokens?: number; cost_usd?: number; ocr_s?: number }
    engine?: 'local' | 'online' | 'ocr' | 'glimmer'
    ocr_text?: string | null
  }
  fields: DocField[]
  current: 'yes' | 'no' | null
}

export interface Session {
  id: string
  region: string
  language: Lang
  who: { choice: 'me' | 'someone' | null; label: string }
  age: string | null
  description: { text: string; points: Point[]; assist: { status?: string; model?: string; dropped?: number } | null }
  onset: { choice: string | null; other_text: string }
  details: { allergies: string; medicines: string; conditions: string; other: string }
  document: DocumentState | null
  events?: GuideEventStored[]
}

export interface GuideEventStored {
  id: string
  kind: string
  guide: string
  step: string | null
  at: string
  received: string
  text: string
}

export type Provenance = 'user' | 'user_split' | 'doc_confirmed' | 'doc_corrected' | 'user_logged'

export interface HandoffItem {
  section: 'person' | 'age' | 'what' | 'onset' | 'details' | 'report' | 'report_current' | 'firstaid'
  value: Record<string, string | null>
  provenance: Provenance
  evidence: {
    full_text?: string
    model?: string | null
    document_id?: string
    model_value?: string | null
    flag_instruction?: boolean
    from_document?: boolean
    guide?: string
    step?: string | null
    received?: string
  }
}

export interface Handoff {
  region: string
  language: Lang
  items: HandoffItem[]
  unknown: string[]
  not_assessed: boolean
  simulation: boolean
  sources: { title: string; publisher: string; url: string }[]
  last_seen_well: string | null
}

export interface Health {
  ok: boolean
  version: string
  lan: boolean
  models: {
    runtime: boolean
    text: boolean
    vision: boolean
    text_model: string
    vision_model: string
    vision_runnable?: boolean
    online_reader?: boolean
    online_model?: string
    ocr_reader?: boolean
    glimmer_reader?: boolean
    ai_provider?: 'glimmer' | 'llama'
    ai_online?: boolean
  }
}
