// The web demo's live AI, for judges: a small server that holds the Meta key, so the key is never in the page.
//
// What keeps the spending small, because the key has a real card behind it:
// - a judge code is needed (only its hash is here; the code itself is given in the submission form)
// - the system prompts are fixed (prompts.json at one commit), so it cannot be used as a general AI service
// - short inputs, a capped answer, and rate limits below
// - it stops by itself after the closing ceremony
// The rate limits are kept in memory, so they apply to each running copy of this server. They are not a perfect hard cap.
// Nothing a person types is logged or stored here, and store: false asks Meta not to keep the response.
const crypto = require('crypto')

const ORIGIN = 'https://professor-200629.github.io'
const CODE_SHA256 = 'f470efd3e6a12d5839c34e5bdc902896787012c4ac17df2531d92b6f22f42937'
const PROMPTS_URL = 'https://raw.githubusercontent.com/professor-200629/aurahealth/6b920d5/live-server/prompts.json'
const STOP_AT = Date.UTC(2026, 10, 10) // 10 Nov 2026, the day after the closing ceremony
const MODEL = 'muse-spark-1.1' // the choice measured in QA_AND_EVALUATION.md
const MAX_USER = 9000
const MAX_IMAGE = 3500000 // characters of base64: the app shrinks photos well below this
const LIMITS = { ipPerMinute: 6, perMinute: 12, perHour: 120 }

const recent = { all: [], ip: new Map() }
let prompts = null

async function getPrompts() {
  if (prompts) return prompts
  const resp = await fetch(PROMPTS_URL, { signal: AbortSignal.timeout(8000) })
  if (!resp.ok) throw new Error('prompts')
  prompts = await resp.json()
  return prompts
}

function tooMany(ip, now) {
  recent.all = recent.all.filter((t) => now - t < 3600000)
  const lastMinute = recent.all.filter((t) => now - t < 60000).length
  const mine = (recent.ip.get(ip) || []).filter((t) => now - t < 60000)
  if (recent.all.length >= LIMITS.perHour || lastMinute >= LIMITS.perMinute || mine.length >= LIMITS.ipPerMinute) return true
  recent.all.push(now)
  mine.push(now)
  if (recent.ip.size > 2000) recent.ip.clear()
  recent.ip.set(ip, mine)
  return false
}

function codeIsRight(code) {
  const given = crypto.createHash('sha256').update(String(code || ''), 'utf8').digest()
  return crypto.timingSafeEqual(given, Buffer.from(CODE_SHA256, 'hex'))
}

function outputText(data) {
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text
  let text = ''
  for (const item of data.output || []) {
    for (const part of item.content || []) {
      if (part.type === 'output_text' || part.type === 'text') text += part.text || ''
    }
  }
  return text
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Vary', 'Origin')
  if (req.headers.origin === ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ORIGIN)
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-judge-code')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Max-Age', '600')
  }
  const reply = (status, body) => res.status(status).json(body)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'post_only' })
  if (req.headers.origin !== ORIGIN) return reply(403, { ok: false, error: 'wrong_page' })
  if (Date.now() >= STOP_AT) return reply(410, { ok: false, error: 'ended' })
  if (!codeIsRight(req.headers['x-judge-code'])) return reply(401, { ok: false, error: 'bad_code' })

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const key = (process.env.MODEL_API_KEY || '').trim()
  if (body.ping) return reply(200, { ok: true, ready: !!key })
  if (!key) return reply(503, { ok: false, error: 'not_configured' })

  const user = typeof body.user === 'string' ? body.user : ''
  const image = typeof body.image === 'string' ? body.image : ''
  if ((body.kind !== 'chat' && body.kind !== 'photo') || !user || user.length > MAX_USER || image.length > MAX_IMAGE || (image && body.kind !== 'photo')) {
    return reply(400, { ok: false, error: 'bad_request' })
  }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
  const now = Date.now()
  if (tooMany(ip, now)) return reply(429, { ok: false, error: 'rate_limited' })

  let system
  try {
    system = (await getPrompts())[body.kind]
  } catch {
    return reply(503, { ok: false, error: 'not_configured' })
  }
  const parts = [{ type: 'input_text', text: user }]
  if (image) parts.push({ type: 'input_image', image_url: `data:image/jpeg;base64,${image}` })
  try {
    const answer = await fetch('https://api.meta.ai/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(50000),
      body: JSON.stringify({
        model: MODEL,
        instructions: system,
        input: [{ type: 'message', role: 'user', content: parts }],
        store: false,
        max_output_tokens: 2000,
        reasoning: { effort: 'low' },
        text: { format: { type: 'json_object' } },
      }),
    })
    if (answer.status === 401 || answer.status === 403) return reply(502, { ok: false, error: 'key_rejected' })
    if (answer.status === 429) return reply(429, { ok: false, error: 'rate_limited' })
    if (!answer.ok) return reply(502, { ok: false, error: `http_${answer.status}` })
    const data = await answer.json()
    return reply(200, { ok: true, content: outputText(data), model: data.model || MODEL, ms: Date.now() - now })
  } catch (err) {
    return reply(504, { ok: false, error: err && err.name === 'TimeoutError' ? 'timeout' : 'network' })
  }
}
