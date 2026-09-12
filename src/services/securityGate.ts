import { getDeviceFingerprint, checkDeviceStatusDetailed, getCachedDeviceBinding, isSimilarDevice } from '@/services/device'
import { isFaceEnrolled } from '@/services/face'

export type SecurityGateResult =
  | 'proceed'
  | 'setup'
  | 'enroll-face'
  | 'transfer'
  | 'offline-blocked'

export interface SecurityGateInfo {
  decision: SecurityGateResult
  boundToCurrentDevice: boolean
  bindingExists: boolean
  faceEnrolled: boolean
}

const CACHE_KEY = 'soms_security_gate'
const CACHE_TTL_MS = 60_000

export interface CachedSecurityGate {
  userId: number
  fingerprint: string
  info: SecurityGateInfo
  checkedAt: number
}

/**
 * Written after the login/onboarding steps and before allowing entry into
 * the app. The server is the authority on which device the account is bound
 * to; when offline we fall back to the locally cached binding.
 *
 * Order of requirements (first missing step wins):
 *   1. face enrollment   — face verification must exist before anything else
 *   2. device binding    — then the current device must be authorized
 *   3. device transfer   — if the account is bound to a different device
 */
export async function runSecurityGate(userId: number): Promise<SecurityGateInfo> {
  const fingerprint = await getDeviceFingerprint()

  let binding: Awaited<ReturnType<typeof getCachedDeviceBinding>> = null
  let isTrusted = false
  let isSimilar = false

  if (navigator.onLine) {
    try {
      const detailed = await checkDeviceStatusDetailed()
      binding = detailed.binding
      isTrusted = detailed.is_trusted
      isSimilar = detailed.is_similar
      // Fallback client-side similarity check if server didn't flag similar but metas are close
      if (!isSimilar && binding?.device_meta) {
        const { getDeviceMeta } = await import('@/services/device')
        isSimilar = isSimilarDevice(binding.device_meta, getDeviceMeta())
      }
    } catch {
      binding = await getCachedDeviceBinding()
    }
  } else {
    // Offline: skip the network call entirely — the locally cached binding is
    // the only source of truth until we're back online. Keeps the scanner and
    // face verification usable without an internet connection.
    binding = await getCachedDeviceBinding()
  }

  const faceEnrolled = await isFaceEnrolled(userId)
  const bindingExists = !!binding
  // Hybrid: same physical device but different browser/incognito now counts as bound
  // if the backend says trusted or similar (coarse hardware class matches).
  // isSimilar alone still requires face enrollment, but we treat it as bound for gate
  // so user goes to face-verify instead of transfer.
  const boundToCurrentDevice =
    (!!binding && binding.device_fingerprint === fingerprint) || isTrusted || isSimilar

  let decision: SecurityGateResult
  if (!faceEnrolled) {
    decision = 'enroll-face'
  } else if (!bindingExists) {
    decision = navigator.onLine ? 'setup' : 'offline-blocked'
  } else if (boundToCurrentDevice) {
    decision = 'proceed'
  } else {
    decision = 'transfer'
  }

  return {
    decision,
    boundToCurrentDevice,
    bindingExists,
    faceEnrolled,
  }
}

export async function getCachedSecurityGate(userId: number): Promise<SecurityGateInfo | null> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedSecurityGate
    if (parsed.userId !== userId) return null
    if (Date.now() - parsed.checkedAt > CACHE_TTL_MS) return null
    // Invalidate cache if fingerprint changed (e.g., same phone different browser)
    // This ensures a cross-browser login doesn't reuse a stale 'transfer' decision.
    try {
      const currentFp = await getDeviceFingerprint()
      if (parsed.fingerprint && parsed.fingerprint !== currentFp) return null
    } catch {
      /* if we can't read fingerprint, be safe and invalidate */
      return null
    }
    return parsed.info
  } catch {
    return null
  }
}

export async function setCachedSecurityGate(userId: number, info: SecurityGateInfo): Promise<void> {
  try {
    const fp = await getDeviceFingerprint()
    const payload: CachedSecurityGate = { userId, fingerprint: fp, info, checkedAt: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    /* private mode / storage disabled — the in-memory store still works */
  }
}

export function clearCachedSecurityGate(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
}
