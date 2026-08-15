<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import FaceCamera from '@/components/FaceCamera.vue'
import { useAuthStore } from '@/stores/authStore'
import { useSecurityStore } from '@/stores/securityStore'
import { getFaceEnrollmentLocal, type FaceDescriptor } from '@/services/face'

const router = useRouter()
const authStore = useAuthStore()
const securityStore = useSecurityStore()

const status = ref<'loading' | 'camera' | 'done' | 'error'>('loading')
const message = ref('')
const runId = ref(0)
const descriptors = ref<FaceDescriptor[]>([])

const userId = () => authStore.user?.id ?? 0

onMounted(async () => {
  try {
    const enrollment = await getFaceEnrollmentLocal(userId())
    descriptors.value = enrollment?.descriptors ?? []
    if (descriptors.value.length === 0) {
      status.value = 'error'
      message.value = 'No face profile found on this device. Enroll your face first in Security.'
      return
    }
    status.value = 'camera'
    message.value = 'Blink to confirm your identity.'
  } catch (e) {
    status.value = 'error'
    message.value = (e as Error)?.message || 'Could not load your face profile.'
  }
})

async function onSuccess() {
  securityStore.markVerified()
  status.value = 'done'
  message.value = 'Identity verified!'
  await new Promise((r) => setTimeout(r, 1200))
  router.push({ name: 'dashboard' })
}

function onError(errorMessage: string) {
  status.value = 'error'
  message.value = errorMessage
  runId.value++
}

function retry() {
  status.value = 'camera'
  message.value = 'Blink to confirm your identity.'
  runId.value++
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-3xl bg-white p-5 shadow-sm">
      <h2 class="text-lg font-bold text-gray-900">Verify your identity</h2>
      <p class="mt-1 text-sm text-gray-500">
        Confirm it's you by looking into the camera and blinking. This is required each time you sign in.
      </p>
    </div>

    <div v-if="status === 'loading'" class="rounded-2xl bg-white p-8 text-center text-sm text-gray-400">
      Loading your face profile…
    </div>

    <FaceCamera
      v-if="status === 'camera'"
      :key="runId"
      mode="verify"
      :user-id="userId()"
      :enrolled="descriptors"
      @success="onSuccess"
      @error="onError"
    />

    <div v-else-if="status === 'done'" class="rounded-2xl bg-white p-6 text-center shadow-sm">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p class="mt-3 text-sm font-semibold text-green-600">{{ message }}</p>
      <p class="mt-1 text-xs text-gray-400">Opening the app…</p>
    </div>

    <div v-else-if="status === 'error'" class="rounded-2xl bg-white p-6 text-center shadow-sm">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <svg class="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p class="mt-3 text-sm font-medium text-red-600">{{ message }}</p>
      <div class="mt-4 grid gap-2">
        <button @click="retry" class="w-full rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white">
          Try Again
        </button>
      </div>
    </div>
  </div>
</template>
