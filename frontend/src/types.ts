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
    timing?: { wall_s: number; load_s: number; output_tokens?: number }
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
}

export type Provenance = 'user' | 'user_split' | 'doc_confirmed' | 'doc_corrected'

export interface HandoffItem {
  section: 'person' | 'age' | 'what' | 'onset' | 'details' | 'report' | 'report_current'
  value: Record<string, string | null>
  provenance: Provenance
  evidence: {
    full_text?: string
    model?: string | null
    document_id?: string
    model_value?: string | null
    flag_instruction?: boolean
    from_document?: boolean
  }
}

export interface Handoff {
  region: string
  language: Lang
  items: HandoffItem[]
  unknown: string[]
  not_assessed: boolean
  simulation: boolean
}

export interface Health {
  ok: boolean
  version: string
  lan: boolean
  models: { runtime: boolean; text: boolean; vision: boolean; text_model: string; vision_model: string }
}
