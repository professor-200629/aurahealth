import type { Handoff, Health, Session } from './types'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function call<T>(path: string, init?: RequestInit, timeoutMs = 20000): Promise<T> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const resp = await fetch(path, { ...init, signal: ctrl.signal, credentials: 'same-origin' })
    if (!resp.ok) {
      let detail = resp.statusText
      try {
        detail = (await resp.json()).detail ?? detail
      } catch {
        /* not JSON */
      }
      throw new ApiError(String(detail), resp.status)
    }
    return (await resp.json()) as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw new ApiError('The laptop server is not reachable.', 0)
  } finally {
    window.clearTimeout(timer)
  }
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  health: () => call<Health>('/api/health', undefined, 6000),
  internetCheck: () => call<{ reachable: boolean; method: string }>('/api/internet-check', { method: 'POST' }, 8000),
  getSession: () => call<{ session: Session | null }>('/api/session'),
  newSession: (region: string, language: string) => call<{ session: Session }>('/api/session', json('POST', { region, language })),
  patchSession: (patch: Record<string, unknown>) => call<{ session: Session }>('/api/session', json('PUT', patch)),
  deleteSession: () => call<{ deleted: boolean }>('/api/session', { method: 'DELETE' }),
  structure: (text: string) =>
    call<{ status: string; points: { text: string; flag_instruction: boolean }[]; dropped: number; uncovered?: string[]; model?: string; error?: string }>(
      '/api/structure',
      json('POST', { text }),
      120000,
    ),
  guideFinder: (text: string) =>
    call<{ status: string; matches: { guide: string; quote: string }[]; dropped: number; model?: string }>(
      '/api/guide-finder',
      json('POST', { text }),
      60000,
    ),
  samples: () => call<{ samples: string[] }>('/api/samples'),
  useSample: (name: string) => call<{ session: Session }>(`/api/document/sample/${encodeURIComponent(name)}`, { method: 'POST' }),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return call<{ session: Session }>('/api/document', { method: 'POST', body: form }, 60000)
  },
  removeDocument: () => call<{ session: Session }>('/api/document', { method: 'DELETE' }),
  extract: (engine: 'local' | 'online') =>
    call<{ job: string | null; status: string; session?: Session }>('/api/document/extract', json('POST', { engine })),
  extractStatus: (job: string) => call<{ status: string; session: Session }>(`/api/document/extract/${job}`),
  saveFields: (fields: unknown[], current: string | null) =>
    call<{ session: Session }>('/api/document/fields', json('PUT', { fields, current })),
  handoff: () => call<Handoff>('/api/handoff'),
  sendEvents: (events: unknown[]) =>
    call<{ session: Session; accepted: number; rejected: number }>('/api/session/events', json('POST', { events }), 8000),
}

export const imageUrl = (docId: string) => `/api/document/image/${docId}`
export const sampleUrl = (name: string) => `/api/samples/${encodeURIComponent(name)}.png`
