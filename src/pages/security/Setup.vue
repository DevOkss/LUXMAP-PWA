<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import FaceCamera from '@/components/FaceCamera.vue'
import { useAuthStore } from '@/stores/authStore'
import { useSecurityStore } from '@/stores/securityStore'
import { bindDevice, formatDevice } from '@/services/device'
import { isFaceEnrolled } from '@/services/face'

const router = useRouter()
const authStore = useAuthStore()
const securityStore = useSecurityStore()

const stage = ref<'loading' | 'bind-error' | 'bound' | 'camera' | 'done'>('loading')
const message = ref('')
const enrolled = ref(false)
const runId = ref(0)

const userId = () => authStore.user?.id ?? 0

onMounted(() => {
  bindAndCheck()
})

async function bindAndCheck() {
  stage.value = 'loading'
  message.value = 'Binding this device to your account…'
  console.log('[Setup] bindAndCheck start, userId=' + userId())
  try {
    const binding = await bindDevice()
    if (!binding) throw new Error('No binding returned by the server.')
    console.log('[Setup] device bound:', binding.device_fingerprint)

    // Confirm to the student before moving on, so binding is not a silent step.
    stage.value = 'bound'
    message.value = `${formatDevice()} is now registered to your account.`
    enrolled.value = await isFaceEnrolled(userId())
    console.log('[Setup] bound, faceEnrolled=' + enrolled.value)
  } catch (e) {
    stage.value = 'bind-error'
    message.value =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
      (e as Error)?.message ||
      'Could not bind this device. Make sure you are online.'
    console.log('[Setup] bind FAILED:', message.value)
  }
}

async function continueAfterBind() {
  console.log('[Setup] continueAfterBind')
  // Device is bound — make sure the gate reflects it before we go further.
  await securityStore.resolve(userId(), { force: true })
  if (await isFaceEnrolled(userId())) {
    stage.value = 'done'
    message.value = 'Device bound and face enrolled.'
  } else {
    stage.value = 'camera'
    message.value = 'Now look into the camera and blink to finish.'
  }
}

async function onEnrollSuccess() {
  await securityStore.resolve(userId(), { force: true })
  stage.value = 'done'
  message.value = 'Device bound and face enrolled.'
}

function onEnrollError(errorMessage: string) {
  message.value = errorMessage
  runId.value++
}

function onEnrollCancel() {
  message.value = 'Enrollment canceled.'
  runId.value++
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-3xl bg-white p-5 shadow-sm">
      <h2 class="text-lg font-bold text-gray-900">Secure your account</h2>
      <p class="mt-1 text-sm text-gray-500">One device per account. Your face verifies each attendance.</p>
    </div>

    <div v-if="stage === 'loading'" class="rounded-2xl bg-white p-8 text-center text-sm text-gray-400">
      {{ message }}
    </div>

    <div v-else-if="stage === 'bind-error'" class="rounded-2xl bg-white p-6 text-center">
      <p class="text-sm font-medium text-red-600">{{ message }}</p>
      <div class="mt-4 grid gap-2">
        <button @click="bindAndCheck" class="rounded-xl bg-primary-700 px-6 py-2.5 text-sm font-semibold text-white">
          Try Again
        </button>
        <button @click="router.push({ name: 'security' })" class="rounded-xl border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-600">
          Back to Security
        </button>
      </div>
    </div>

    <!-- Device bound successfully -->
    <div v-else-if="stage === 'bound'" class="rounded-2xl bg-white p-6 text-center shadow-sm">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 class="mt-3 text-base font-bold text-gray-900">Device Bound Successfully</h3>
      <p class="mt-1 text-sm text-gray-500">{{ message }}</p>
      <div class="mt-4">
        <button
          @click="continueAfterBind"
          class="w-full rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white"
        >
          {{ enrolled ? 'Continue' : 'Continue to Face Enrollment' }}
        </button>
      </div>
    </div>

    <div v-else-if="stage === 'camera' || stage === 'done'" class="space-y-3">
      <FaceCamera
        v-if="stage === 'camera'"
        :key="runId"
        mode="enroll"
        :user-id="userId()"
        :enrolled="[]"
        @success="onEnrollSuccess"
        @error="onEnrollError"
        @cancel="onEnrollCancel"
      />
      <p v-if="stage === 'camera'" class="text-center text-xs text-gray-500">{{ message }}</p>

      <div v-else class="rounded-2xl bg-white p-6 text-center shadow-sm">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p class="mt-3 text-sm font-semibold text-green-600">{{ message }}</p>
      </div>

      <div class="grid gap-2">
        <button
          v-if="stage === 'done'"
          @click="router.push({ name: 'dashboard' })"
          class="w-full rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white"
        >
          Continue
        </button>
      </div>
    </div>
  </div>
</template>
