<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import {
  checkDeviceStatus,
  getDeviceFingerprint,
  listTransferRequests,
  approveTransfer,
  rejectTransfer,
  formatDevice,
  type TransferRequest,
} from '@/services/device'
import { isFaceEnrolled } from '@/services/face'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const fingerprint = ref('')
const bindingExists = ref(false)
const boundToCurrentDevice = ref(false)
const faceEnrolled = ref(false)
const transfers = ref<TransferRequest[]>([])
const busy = ref(false)
const error = ref('')

const incoming = computed(() => transfers.value.filter((t) => t.direction === 'incoming' && t.status === 'pending'))
const outgoing = computed(() => transfers.value.filter((t) => t.direction === 'outgoing'))

onMounted(async () => {
  try {
    fingerprint.value = await getDeviceFingerprint()
    const binding = await checkDeviceStatus()
    bindingExists.value = !!binding
    boundToCurrentDevice.value = !!binding && binding.device_fingerprint === fingerprint.value
    faceEnrolled.value = await isFaceEnrolled(authStore.user?.id ?? 0)
    try {
      transfers.value = await listTransferRequests()
    } catch {
      transfers.value = []
    }
  } catch (e) {
    error.value = (e as Error)?.message || 'Could not load device security settings.'
  } finally {
    loading.value = false
  }
})

const bindingStatusText = computed(() => {
  if (boundToCurrentDevice.value) return `${formatDevice()} is bound to your account.`
  if (bindingExists.value) return 'Your account is bound to another device. Transfer the binding to this device to continue.'
  return 'No device is bound to your account.'
})

const primaryLabel = computed(() => {
  if (!bindingExists.value) return 'Bind This Device'
  if (!boundToCurrentDevice.value) return 'Transfer to This Device'
  return 'Re-tie This Device'
})

async function handleApprove(request: TransferRequest) {
  busy.value = true
  error.value = ''
  try {
    await approveTransfer(request.id)
    transfers.value = await listTransferRequests()
  } catch (e) {
    error.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not approve the transfer.'
  } finally {
    busy.value = false
  }
}

async function handleReject(request: TransferRequest) {
  busy.value = true
  error.value = ''
  try {
    await rejectTransfer(request.id)
    transfers.value = await listTransferRequests()
  } catch (e) {
    error.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not reject the transfer.'
  } finally {
    busy.value = false
  }
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="error" class="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
      {{ error }}
    </div>

    <div v-if="loading" class="rounded-2xl bg-white p-8 text-center text-sm text-gray-400">
      Loading…
    </div>

    <template v-else>
      <!-- Binding card -->
      <div class="rounded-3xl bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-green-50">
            <svg class="h-5 w-5 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-900">One-Device Binding</p>
            <p class="mt-0.5 text-xs text-gray-500">
              {{ bindingStatusText }}
            </p>
          </div>
        </div>

<div class="mt-4 grid gap-2">
          <p class="rounded-xl bg-gray-50 px-2 py-2.5 font-mono text-[11px] text-gray-400">{{ fingerprint.slice(0, 32) }}…</p>
        </div>

        <div class="mt-4 flex flex-col gap-2">
          <button
            @click="router.push({ name: bindingExists && !boundToCurrentDevice ? 'security-transfer' : 'security-setup' })"
            class="w-full rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white"
          >
            {{ primaryLabel }}
          </button>
          <button
            v-if="boundToCurrentDevice && !faceEnrolled"
            @click="router.push({ name: 'security-face-enroll' })"
            class="w-full rounded-xl border border-primary-600 py-3 text-sm font-medium text-primary-700"
          >
            Enroll Face
          </button>
          <button
            v-else-if="boundToCurrentDevice"
            @click="router.push({ name: 'security-face-enroll' })"
            class="w-full rounded-xl border border-primary-600 py-3 text-sm font-medium text-primary-700"
          >
            Re-enroll Face
          </button>
          <button
            @click="router.push({ name: 'security-transfer' })"
            class="w-full rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-600"
          >
            Transfer to Another Device
          </button>
        </div>
      </div>

      <!-- Face status -->
      <div class="rounded-3xl bg-white p-5 shadow-sm">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-2xl" :class="faceEnrolled ? 'bg-green-50' : 'bg-amber-50'">
            <svg class="h-5 w-5" :class="faceEnrolled ? 'text-green-600' : 'text-amber-600'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM5 20a6.9 6.9 0 0114 0M9 9a3 3 0 116 0" />
            </svg>
          </span>
          <div>
            <p class="text-sm font-semibold text-gray-900">Face Verification</p>
            <p class="mt-0.5 text-xs text-gray-500">{{ faceEnrolled ? 'Enrolled — scanning requires face + blink confirmation.' : 'Not enrolled — enroll to use attendance.' }}</p>
          </div>
        </div>
      </div>

      <!-- Pending incoming transfers -->
      <div v-if="incoming.length" class="rounded-3xl bg-white p-5 shadow-sm">
        <h3 class="text-sm font-bold text-gray-900">Transfer Requests</h3>
        <p class="mt-0.5 text-xs text-gray-500">A new device asked to take over your device binding.</p>
        <div class="mt-3 space-y-2">
          <div v-for="request in incoming" :key="request.id" class="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
            <div class="min-w-0">
              <p class="truncate text-xs font-semibold text-gray-700">{{ request.requesting_meta?.platform || 'New device' }}</p>
              <p class="text-[11px] text-gray-400">{{ formatDate(request.requested_at) }}</p>
            </div>
            <div class="flex gap-2">
              <button
                type="button" :disabled="busy" @click="handleReject(request)"
                class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Reject
              </button>
              <button
                type="button" :disabled="busy" @click="handleApprove(request)"
                class="rounded-lg bg-primary-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Outgoing transfer status -->
      <div v-if="outgoing.length" class="rounded-3xl bg-white p-5 shadow-sm">
        <h3 class="text-sm font-bold text-gray-900">Pending Transfer</h3>
        <p class="mt-0.5 text-xs text-gray-500">You requested to move your device binding to another device.</p>
        <div class="mt-3 space-y-2">
          <div v-for="request in outgoing" :key="request.id" class="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
            <p class="text-xs font-medium capitalize text-gray-700">{{ request.status }}</p>
            <p class="text-[11px] text-gray-400">{{ formatDate(request.requested_at) }}</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>