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

const LOCAL_FINGERPRINT_KEY = 'soms_device_fingerprint'
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
 * Stable-enough device fingerprint: a per-install random id mixed with a small
 * set of stable browser signals, hashed with SHA-256. Clearing browser site
 * data destroys the id, which is a documented browser limitation.
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (fingerprintPromise) return fingerprintPromise
  fingerprintPromise = computeDeviceFingerprint()
  return fingerprintPromise
}

async function computeDeviceFingerprint(): Promise<string> {
  const existing = readStoredId()
  if (existing) return existing

  let id = generateId()
  storeId(id)

  const meta = getDeviceMeta()
  const signal = [id, meta.platform, meta.cores, meta.screen, meta.language, meta.ua]
    .filter(Boolean)
    .join('|')

  try {
    const hashed = await sha256(signal)
    if (hashed) return hashed
  } catch {
    /* fall through to raw id when WebCrypto is unavailable */
  }
  return id
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

export async function checkDeviceStatus(): Promise<DebugDeviceBinding | null> {
  const response = await api.get('/device/status')
  const binding = response.data?.binding ?? null
  cacheDeviceBinding(binding)
  return binding
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