<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FaceCamera from '@/components/FaceCamera.vue'
import { useAuthStore } from '@/stores/authStore'
import { useSecurityStore } from '@/stores/securityStore'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const securityStore = useSecurityStore()

const status = ref<'idle' | 'camera' | 'done' | 'error'>('camera')
const message = ref('Look into the camera and blink when prompted.')
const runId = ref(0)

const userId = () => authStore.user?.id ?? 0

async function advanceToNextStep() {
  const info = await securityStore.resolve(userId(), { force: true })
  console.log('[FaceEnroll] gate after enroll:', info.decision, info)
  if (info.decision === 'proceed') {
    router.push({ name: 'dashboard' })
  } else {
    const step = info.decision === 'setup'
      ? 'security-setup'
      : info.decision === 'transfer'
        ? 'security-transfer'
        : 'security'
    console.log('[FaceEnroll] advancing to', step)
    router.push({ name: step })
  }
}

async function onEnrollSuccess() {
  status.value = 'done'
  message.value = 'Face enrolled!'
  console.log('[FaceEnroll] onEnrollSuccess')
  // Give the student a moment to see the success state, then continue to the
  // next required step automatically.
  await new Promise((r) => setTimeout(r, 1200))
  await advanceToNextStep()
}

function onEnrollError(errorMessage: string) {
  status.value = 'error'
  message.value = errorMessage
  console.log('[FaceEnroll] onEnrollError:', errorMessage)
  runId.value++
}

function onEnrollCancel() {
  status.value = 'error'
  message.value = 'Enrollment canceled.'
  runId.value++
}

function retry() {
  status.value = 'camera'
  message.value = 'Look into the camera and blink when prompted.'
  runId.value++
}

function finish() {
  const next = (route.query.next as string) || 'security'
  router.push({ name: next })
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-3xl bg-white p-5 shadow-sm">
      <h2 class="text-lg font-bold text-gray-900">Enroll your face</h2>
      <p class="mt-1 text-sm text-gray-500">
        Face verification is required for attendance. Keep your face centered in the oval and blink when the prompt appears.
      </p>
    </div>

    <FaceCamera
      v-if="status === 'camera'"
      :key="runId"
      mode="enroll"
      :user-id="userId()"
      :enrolled="[]"
      @success="onEnrollSuccess"
      @error="onEnrollError"
      @cancel="onEnrollCancel"
    />

    <div v-else-if="status === 'done'" class="rounded-2xl bg-white p-6 text-center shadow-sm">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p class="mt-3 text-sm font-semibold text-green-600">{{ message }}</p>
      <p class="mt-1 text-xs text-gray-400">Continuing to the next step…</p>
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
        <button @click="finish" class="w-full rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-600">
          Back to Security
        </button>
      </div>
    </div>
  </div>
</template>
