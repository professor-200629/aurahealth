// Nearest hospital or medical store, and sharing where the phone is. Maps need internet; the location itself comes
// from the phone's GPS. Inside the Android app the phone's own location service and share sheet are used.
import { isNativeApp, native, onNativeEvent } from './native'

export interface Spot {
  lat: number
  lng: number
  accuracy: number
  link: string
}

export type SpotResult = { ok: true; spot: Spot } | { ok: false; reason: 'permission' | 'off' | 'unknown' | 'unsupported' }

const QUERY = { hospital: 'hospital', pharmacy: 'pharmacy' } as const

export function openNearby(kind: keyof typeof QUERY) {
  if (isNativeApp() && native()?.openMaps) {
    native()!.openMaps!(QUERY[kind])
    return
  }
  window.open(`https://www.google.com/maps/search/${encodeURIComponent(QUERY[kind] + ' near me')}`, '_blank', 'noopener')
}

const link = (lat: number, lng: number) => `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`

/** Ask the phone where it is (up to about 20 seconds). */
export function locate(): Promise<SpotResult> {
  if (isNativeApp() && native()?.requestLocation) {
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        off()
        resolve({ ok: false, reason: 'unknown' })
      }, 25000)
      const off = onNativeEvent((e) => {
        if (e.type !== 'location') return
        window.clearTimeout(timer)
        off()
        if (e.ok && e.lat !== undefined && e.lng !== undefined)
          resolve({ ok: true, spot: { lat: e.lat, lng: e.lng, accuracy: e.accuracy ?? 0, link: e.link ?? link(e.lat, e.lng) } })
        else resolve({ ok: false, reason: e.reason ?? 'unknown' })
      })
      native()!.requestLocation!()
    })
  }
  if (!('geolocation' in navigator) || !window.isSecureContext) return Promise.resolve({ ok: false, reason: 'unsupported' })
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          ok: true,
          spot: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy), link: link(p.coords.latitude, p.coords.longitude) },
        }),
      (err) => resolve({ ok: false, reason: err.code === err.PERMISSION_DENIED ? 'permission' : 'unknown' }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
    ),
  )
}

/** Opens the phone's share sheet (WhatsApp, SMS...) with the text. The person picks who gets it. */
export async function shareText(text: string): Promise<boolean> {
  if (isNativeApp() && native()?.shareText) {
    native()!.shareText!(text)
    return true
  }
  try {
    if (navigator.share) {
      await navigator.share({ text })
      return true
    }
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
