import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  runSecurityGate,
  getCachedSecurityGate,
  setCachedSecurityGate,
  clearCachedSecurityGate,
  type SecurityGateInfo,
} from '@/services/securityGate'

/**
 * Caches the last security-gate evaluation for the signed-in user so the
 * router guard can enforce face-enrollment + device-binding requirements
 * without a network round-trip on every navigation. Explicitly refresh after
 * each security action (bind / enroll / transfer) via `force`.
 */
export const useSecurityStore = defineStore('security', () => {
  const info = ref<SecurityGateInfo | null>(null)
  const loading = ref(false)
  // Survives page refreshes (sessionStorage) but is wiped when the app/tab is
  // closed, so a face verify is required on every fresh app open — not on
  // every reload. QR scanning always verifies per-scan regardless of this.
  const verified = ref(sessionStorage.getItem('soms_face_verified') === '1')

  async function resolve(userId: number, opts: { force?: boolean } = {}): Promise<SecurityGateInfo> {
    if (!opts.force && info.value) return info.value

    const cached = getCachedSecurityGate(userId)
    if (!opts.force && cached) {
      info.value = cached
      return cached
    }

    loading.value = true
    try {
      const result = await runSecurityGate(userId)
      info.value = result
      setCachedSecurityGate(userId, result)
      return result
    } finally {
      loading.value = false
    }
  }

  function markVerified(): void {
    verified.value = true
    sessionStorage.setItem('soms_face_verified', '1')
  }

  function resetVerified(): void {
    verified.value = false
    sessionStorage.removeItem('soms_face_verified')
  }

  function clear(): void {
    info.value = null
    verified.value = false
    sessionStorage.removeItem('soms_face_verified')
    clearCachedSecurityGate()
  }

  return { info, loading, verified, resolve, markVerified, resetVerified, clear }
})
