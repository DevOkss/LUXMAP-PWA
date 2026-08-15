export interface QrPayload {
  event_id: number
  qr_config_id: number
  type: 'time_in' | 'time_out'
  event_title: string
  event_date: string
  time_from: string | null
  time_to: string | null
  valid_time_from: string
  valid_time_until: string
  venue: string | null
  valid_from: string
  valid_until: string
  latitude: number | null
  longitude: number | null
  geofence_radius: number | null
  issued_at: string
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i)
  }
  return bytes
}

export async function decryptQrPayload(base64: string): Promise<QrPayload | null> {
  try {
    const keyHex = import.meta.env.VITE_QR_KEY
    if (!keyHex) throw new Error('QR key not configured')
    if (keyHex.length !== 64) throw new Error('QR key must be 32 bytes (64 hex chars), got ' + keyHex.length)

    const keyBytes = hexToBytes(keyHex)
    const data = base64ToBytes(base64)

    if (data.length < 32) throw new Error('QR payload too short: ' + data.length)

    const iv = data.slice(0, 16)
    const ciphertext = data.slice(16)

    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'AES-CBC' }, false, ['decrypt'])
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv as BufferSource }, cryptoKey, ciphertext as BufferSource)
    const json = new TextDecoder().decode(decrypted)
    return JSON.parse(json) as QrPayload
  } catch (e: any) {
    console.error('QR decrypt error:', e?.message || e, 'key length:', import.meta.env.VITE_QR_KEY?.length)
    return null
  }
}

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function isWithinTime(validTimeFrom: string, validTimeUntil: string): boolean {
  const now = new Date()
  const [fh, fm] = validTimeFrom.split(':').map(Number)
  const [th, tm] = validTimeUntil.split(':').map(Number)
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const fromMins = fh * 60 + fm
  const untilMins = th * 60 + tm
  return nowMins >= fromMins && nowMins <= untilMins
}
