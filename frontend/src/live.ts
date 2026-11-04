// The web demo's live AI for judges. With the code from the submission form, questions go through a small server
// (live-server/) to Meta Muse Spark, and the answers get the same checks as on the phone. With no code, the web demo sends
// nothing anywhere. The Android app never uses this: it calls Meta directly with a key saved on the phone.
const URL_ = (import.meta.env.VITE_LIVE_URL as string | undefined) ?? ''
const STORE = 'aura-judge-code'
let memory = ''

export const liveOffered = () => !!URL_

export function liveCode(): string {
  if (!URL_) return ''
  try {
    return localStorage.getItem(STORE) ?? memory
  } catch {
    return memory
  }
}

function keep(code: string) {
  memory = code
  try {
    if (code) localStorage.setItem(STORE, code)
    else localStorage.removeItem(STORE)
  } catch {
    /* the code still applies until this page closes */
  }
}

export const liveOn = () => !!liveCode()
export const turnOffLive = () => keep('')

async function post(code: string, body: unknown, timeoutMs: number): Promise<{ status: number; data: Record<string, unknown> }> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const resp = await fetch(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-judge-code': code },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    return { status: resp.status, data: (await resp.json()) as Record<string, unknown> }
  } finally {
    window.clearTimeout(timer)
  }
}

/** Check a code with the server, without calling the model, and keep it if it is right. */
export async function tryCode(code: string): Promise<'ok' | 'bad' | 'down'> {
  const clean = code.trim().toUpperCase()
  try {
    const r = await post(clean, { ping: true }, 15000)
    if (r.status === 401) return 'bad'
    if (r.data.ok !== true || r.data.ready !== true) return 'down'
    keep(clean)
    return 'ok'
  } catch {
    return 'down'
  }
}

/** One question or one photo. Same answer format as the phone's own call. */
export async function askLive(kind: 'chat' | 'photo', user: string, image: string | undefined, timeoutMs: number): Promise<{ content: string } | { error: string }> {
  try {
    const r = await post(liveCode(), { kind, user, image }, Math.min(timeoutMs, 58000))
    if (r.data.ok === true && typeof r.data.content === 'string' && r.data.content.trim()) return { content: r.data.content }
    return { error: typeof r.data.error === 'string' ? r.data.error : 'bad_response' }
  } catch (err) {
    return { error: err instanceof DOMException && err.name === 'AbortError' ? 'timeout' : 'network' }
  }
}
