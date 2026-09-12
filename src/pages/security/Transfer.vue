<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useSecurityStore } from '@/stores/securityStore'
import {
  requestDeviceTransfer,
  listTransferRequests,
  bindDevice,
  bindDeviceFaceVerified,
  checkDeviceStatusDetailed,
  getDeviceFingerprint,
  formatDevice,
  isSimilarDevice,
  getDeviceMeta,
  type TransferRequest,
} from '@/services/device'
import { fetchServerFaceEnrollment, saveFaceEnrollmentLocal, isFaceEnrolled } from '@/services/face'

const router = useRouter()
const authStore = useAuthStore()
const securityStore = useSecurityStore()

const userId = () => authStore.user?.id ?? 0

const stage = ref<'intro' | 'requesting' | 'waiting' | 'done' | 'rejected' | 'error'>('intro')
const message = ref('')
const fingerprint = ref('')
const requestId = ref<number | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

// Same-device instant bind (fixes same phone different browser/incognito false transfer)
const canInstant = ref(false)
const instantChecking = ref(true)

onMounted(async () => {
  try {
    const detailed = await checkDeviceStatusDetailed()
    const similar =
      detailed.is_similar ||
      (detailed.binding?.device_meta ? isSimilarDevice(detailed.binding.device_meta, getDeviceMeta()) : false)
    const faceOk = await isFaceEnrolled(userId())
    canInstant.value = similar && faceOk
  } catch {
    canInstant.value = false
  } finally {
    instantChecking.value = false
  }
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})

async function start() {
  stage.value = 'requesting'
  message.value = 'Contacting the server…'
  fingerprint.value = await getDeviceFingerprint()
  try {
    const request = await requestDeviceTransfer()
    requestId.value = request.id
    stage.value = 'waiting'
    message.value = 'Transfer requested. Open the LuxMap app on your previous device, go to Security, and approve the transfer.'
    pollTimer = setInterval(poll, 3000)
  } catch (e) {
    stage.value = 'error'
    message.value =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
      (e as Error)?.message ||
      'Could not request the transfer.'
  }
}

async function poll() {
  if (requestId.value === null) return
  try {
    const requests = await listTransferRequests()
    const mine = requests.find((r) => r.id === requestId.value)
    if (!mine) return
    if (mine.status === 'pending') return
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (mine.status === 'approved') {
      await completeTransfer()
    } else {
      stage.value = 'rejected'
      message.value = 'The transfer request was declined on your previous device.'
    }
  } catch {
    /* transient network error — keep polling */
  }
}

async function completeTransfer() {
  stage.value = 'requesting'
  message.value = 'Moving your device binding…'
  await bindDevice()
  const descriptors = await fetchServerFaceEnrollment(userId())
  if (descriptors && descriptors.length) {
    await saveFaceEnrollmentLocal(userId(), descriptors)
  }
  // Refresh the security gate so the app treats this device as authorized.
  await securityStore.resolve(userId(), { force: true })
  stage.value = 'done'
  message.value = descriptors && descriptors.length
    ? `${formatDevice()} is now bound to your account. Your face profile was moved to this device.`
    : `${formatDevice()} is now bound to your account. Enroll your face to use attendance.`
}

async function instantBind() {
  stage.value = 'requesting'
  message.value = 'Verifying same device and face — binding instantly…'
  fingerprint.value = await getDeviceFingerprint()
  try {
    const binding = await bindDeviceFaceVerified()
    const descriptors = await fetchServerFaceEnrollment(userId())
    if (descriptors && descriptors.length) {
      await saveFaceEnrollmentLocal(userId(), descriptors)
    }
    await securityStore.resolve(userId(), { force: true })
    stage.value = 'done'
    message.value = binding
      ? `${formatDevice()} is now bound to your account (same device, different browser). Your face profile was moved.`
      : `${formatDevice()} is now bound.`
  } catch (e) {
    stage.value = 'error'
    message.value =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
      (e as Error)?.message ||
      'Instant bind failed. Use Request Transfer instead (needs old device approval).'
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-3xl bg-white p-5 shadow-sm">
      <h2 class="text-lg font-bold text-gray-900">Transfer to this device</h2>
      <p class="mt-1 text-sm text-gray-500">
        Your account is bound to another device. You can move the binding here, but the other device must approve first. Your face profile is kept on the server — no re-enrollment is needed.
      </p>
    </div>

    <div v-if="stage === 'intro' || stage === 'requesting' || stage === 'waiting'" class="rounded-2xl bg-white p-6 text-center shadow-sm">
      <p v-if="stage === 'waiting'" class="text-sm text-gray-600">{{ message }}</p>
      <p v-else-if="stage === 'requesting'" class="text-sm text-gray-400">{{ message }}</p>
      <div v-else-if="stage === 'intro' && !instantChecking && canInstant" class="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
        Same device detected (different browser/incognito). You can bind instantly with face verification — no old device needed.
      </div>
      <div class="mt-4 grid gap-2">
        <button
          v-if="stage === 'intro' && canInstant"
          @click="instantBind"
          class="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white"
        >
          Verify Face & Bind Instantly (Same Device)
        </button>
        <button
          v-if="stage === 'intro'"
          @click="start"
          class="w-full rounded-xl py-3 text-sm font-semibold text-white"
          :class="canInstant ? 'bg-white border border-primary-700 text-primary-700' : 'bg-primary-700'"
        >
          {{ canInstant ? 'Request Transfer (Needs Old Device)' : 'Request Transfer' }}
        </button>
        <button
          v-if="stage !== 'intro'"
          @click="router.push({ name: 'security' })"
          class="w-full rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-600"
        >
          Cancel
        </button>
      </div>
      <p v-if="stage === 'intro' && canInstant" class="mt-2 text-[11px] text-gray-400">Instant bind checks that this browser shares hardware with your bound device (platform/screen/cores) and that face is enrolled.</p>
    </div>

    <div v-else-if="stage === 'done'" class="rounded-2xl bg-white p-6 text-center shadow-sm">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 class="mt-3 text-base font-bold text-gray-900">Device Bound Successfully</h3>
      <p class="mt-1 text-sm text-gray-500">{{ message }}</p>
      <div class="mt-4 grid gap-2">
        <button
          @click="router.push({ name: 'dashboard' })"
          class="w-full rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white"
        >
          Continue
        </button>
      </div>
    </div>

    <div v-else class="rounded-2xl bg-white p-6 text-center shadow-sm">
      <p class="text-sm font-medium text-red-600">{{ message }}</p>
      <div class="mt-4 grid gap-2">
        <button @click="start" class="w-full rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white">
          Try Again
        </button>
        <button @click="router.push({ name: 'security' })" class="w-full rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-600">
          Back to Security
        </button>
      </div>
    </div>
  </div>
</template>