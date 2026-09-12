import api from '@/services/api'

export interface DeviceMeta {
  platform: string
  ua: string
  device_memory?: number
  cores?: number
  screen?: string
  language?: string
}

export interface DebugDeviceBinding {
  user_id: number
  device_fingerprint: string
  device_meta: DeviceMeta | null
  bound_at: string | null
}

export interface TransferRequest {
  id: number
  user_id: number
  requesting_fingerprint: string
  requesting_meta: DeviceMeta | null
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  decided_at: string | null
  direction: 'incoming' | 'outgoing'
}

const LOCAL_FINGERPRINT_KEY = 'soms_device_fingerprint' // legacy v1 (per-install UUID) - kept for migration
const LOCAL_FINGERPRINT_KEY_V2 = 'soms_device_fingerprint_v2'
const LOCAL_BINDING_KEY = 'soms_device_binding'

let fingerprintPromise: Promise<string> | null = null

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
}

export function getDeviceMeta(): DeviceMeta {
  const ua = navigator.userAgent
  return {
    platform: navigator.platform || 'unknown',
    ua,
    cores: navigator.hardwareConcurrency,
    screen: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`,
    language: navigator.language,
  }
}

export interface CoarseDeviceClass {
  platform: string
  screenBucket: string
  coresBucket: string
  language: string
}

export function getCoarseDeviceClass(): CoarseDeviceClass {
  const meta = getDeviceMeta()
  const w = window.screen?.width ?? 0
  const h = window.screen?.height ?? 0
  // Bucket screens to reduce noise across browsers that report slightly different sizes
  const bucket = w >= 1000 ? 'large' : w >= 700 ? 'medium' : w >= 400 ? 'small' : 'tiny'
  const cores = meta.cores ?? 0
  const coresBucket = cores >= 8 ? '8+' : cores >= 4 ? '4-7' : cores >= 2 ? '2-3' : '1'
  return {
    platform: (meta.platform || 'unknown').toLowerCase(),
    screenBucket: `${bucket}:${w}x${h}`,
    coresBucket,
    language: (meta.language || 'en').split('-')[0].toLowerCase(),
  }
}

export function isSimilarDevice(a: DeviceMeta | null, b: DeviceMeta | null): boolean {
  if (!a || !b) return false
  // Platform must match (e.g., Win32 vs Linux vs iPhone) - strong signal
  if ((a.platform || '').toLowerCase() !== (b.platform || '').toLowerCase()) return false
  // Screen size must be reasonably close - allow small variance but not phone vs desktop
  const screenA = a.screen || ''
  const screenB = b.screen || ''
  if (screenA && screenB && screenA !== screenB) {
    // Allow bucketed similarity: both small/medium etc.
    const bucket = (s: string) => {
      const w = parseInt(s.split('x')[0] || '0', 10)
      if (w >= 1000) return 'large'
      if (w >= 700) return 'medium'
      if (w >= 400) return 'small'
      return 'tiny'
    }
    if (bucket(screenA) !== bucket(screenB)) return false
  }
  // Cores bucket similar
  const coresA = a.cores ?? 0
  const coresB = b.cores ?? 0
  const coresBucket = (c: number) => (c >= 8 ? '8+' : c >= 4 ? '4-7' : c >= 2 ? '2-3' : '1')
  if (coresA && coresB && coresBucket(coresA) !== coresBucket(coresB)) return false
  // Language base must match if both present
  if (a.language && b.language && a.language.split('-')[0].toLowerCase() !== b.language.split('-')[0].toLowerCase()) return false
  return true
}

export function isIncognitoContext(): boolean {
  // Heuristic: incognito/private often has different storage quota or throws on localStorage
  // This is best-effort - exact detection is impossible, but we can warn the user.
  try {
    const testKey = '__soms_incognito_test__'
    localStorage.setItem(testKey, '1')
    localStorage.removeItem(testKey)
  } catch {
    return true
  }
  return false
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function readStoredId(): string | null {
  try {
    return localStorage.getItem(LOCAL_FINGERPRINT_KEY)
  } catch {
    return null
  }
}

function storeId(id: string): void {
  try {
    localStorage.setItem(LOCAL_FINGERPRINT_KEY, id)
  } catch {
    /* private mode / storage disabled */
  }
}

/**
 * Stable-enough device fingerprint (v2): deterministic hash of stable signals.
 * Previous v1 used per-install random UUID stored in localStorage, which caused
 * same physical device but different browser/incognito to appear as different
 * device and force "request transfer". v2 survives incognito/clear by
 * recomputing from hardware signals. localStorage v2 is cache only.
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (fingerprintPromise) return fingerprintPromise
  fingerprintPromise = computeDeviceFingerprint()
  return fingerprintPromise
}

function readStoredV2(): string | null {
  try {
    return localStorage.getItem(LOCAL_FINGERPRINT_KEY_V2)
  } catch {
    return null
  }
}
function storeV2(id: string): void {
  try {
    localStorage.setItem(LOCAL_FINGERPRINT_KEY_V2, id)
  } catch {
    /* private mode */
  }
}

async function computeDeviceFingerprint(): Promise<string> {
  // v2 cache hit - return deterministic hash quickly
  const existingV2 = readStoredV2()
  if (existingV2) return existingV2

  const meta = getDeviceMeta()
  // Deterministic signals - deliberately EXCLUDE full UA which varies per browser.
  // Same physical device but Chrome vs Firefox vs Incognito should produce SAME hash,
  // so we rely only on hardware/OS signals that are identical across browsers.
  const tz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    } catch {
      return ''
    }
  })()
  const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? ''
  const osHint = meta.platform || ''
  // Note: UA excluded intentionally for cross-browser stability on same hardware
  const signal = [osHint, meta.cores, meta.screen, meta.language, tz, String(deviceMemory)].filter(Boolean).join('|')

  try {
    const hashed = await sha256(signal || meta.ua || 'fallback')
    if (hashed) {
      storeV2(hashed)
      // Keep v1 for migration: server can map old UUID to new hash via trusted list
      return hashed
    }
  } catch {
    /* fall through */
  }
  // Fallback: per-install random (legacy) if crypto unavailable - will still trigger transfer but preserves function
  const legacy = readStoredId()
  if (legacy) return legacy
  const id = generateId()
  storeId(id)
  return id
}

export function clearFingerprintCache(): void {
  fingerprintPromise = null
  try {
    localStorage.removeItem(LOCAL_FINGERPRINT_KEY_V2)
  } catch {
    /* ignore */
  }
}

export async function getCachedDeviceBinding(): Promise<DebugDeviceBinding | null> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_BINDING_KEY) || 'null')
  } catch {
    return null
  }
}

function cacheDeviceBinding(binding: DebugDeviceBinding | null): void {
  try {
    if (binding) {
      localStorage.setItem(LOCAL_BINDING_KEY, JSON.stringify(binding))
    } else {
      localStorage.removeItem(LOCAL_BINDING_KEY)
    }
  } catch {
    /* ignore */
  }
}

export interface DeviceStatusDetailed {
  fingerprint: string
  binding: DebugDeviceBinding | null
  trusted_fingerprints: string[]
  is_trusted: boolean
  is_similar: boolean
}

export async function checkDeviceStatus(): Promise<DebugDeviceBinding | null> {
  const detailed = await checkDeviceStatusDetailed()
  return detailed.binding
}

export async function checkDeviceStatusDetailed(): Promise<DeviceStatusDetailed> {
  const response = await api.get('/device/status')
  const binding = response.data?.binding ?? null
  cacheDeviceBinding(binding)
  return {
    fingerprint: response.data?.fingerprint ?? (await getDeviceFingerprint()),
    binding,
    trusted_fingerprints: response.data?.trusted_fingerprints ?? [],
    is_trusted: response.data?.is_trusted ?? false,
    is_similar: response.data?.is_similar ?? false,
  }
}

export async function bindDevice(): Promise<DebugDeviceBinding | null> {
  const fingerprint = await getDeviceFingerprint()
  const response = await api.post('/devices/bind', {
    device_fingerprint: fingerprint,
    device_meta: getDeviceMeta(),
  })
  const binding = response.data?.binding ?? null
  cacheDeviceBinding(binding)
  return binding
}

export async function bindDeviceFaceVerified(): Promise<DebugDeviceBinding | null> {
  const fingerprint = await getDeviceFingerprint()
  const response = await api.post('/devices/bind/face-verified', {
    device_fingerprint: fingerprint,
    device_meta: getDeviceMeta(),
  })
  const binding = response.data?.binding ?? null
  cacheDeviceBinding(binding)
  return binding
}

export async function clearDeviceBindingCache(): Promise<void> {
  cacheDeviceBinding(null)
}

export async function requestDeviceTransfer(): Promise<TransferRequest> {
  const fingerprint = await getDeviceFingerprint()
  const response = await api.post('/devices/transfer/request', {
    device_fingerprint: fingerprint,
    device_meta: getDeviceMeta(),
  })
  return response.data?.request
}

export async function listTransferRequests(): Promise<TransferRequest[]> {
  const response = await api.get('/devices/transfer/requests')
  return response.data?.requests ?? []
}

export async function approveTransfer(id: number): Promise<void> {
  const fingerprint = await getDeviceFingerprint()
  await api.post(`/devices/transfer/requests/${id}/approve`, {
    device_fingerprint: fingerprint,
  })
}

export async function rejectTransfer(id: number): Promise<void> {
  const fingerprint = await getDeviceFingerprint()
  await api.post(`/devices/transfer/requests/${id}/reject`, {
    device_fingerprint: fingerprint,
  })
}

export function formatDevice(): string {
  const meta = getDeviceMeta()
  return `${meta.platform || 'Device'} · ${meta.screen || ''}`
}