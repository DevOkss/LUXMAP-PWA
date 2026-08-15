<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { runFaceBurst, waitForVideo, type FaceDescriptor, type FaceCaptureResult, type FaceDistance } from '@/services/face'

const props = defineProps<{
  mode: 'enroll' | 'verify'
  userId: number
  enrolled: FaceDescriptor[]
}>()

const emit = defineEmits<{
  success: [result: FaceCaptureResult]
  error: [message: string]
  cancel: []
}>()

interface CameraStatus {
  stage: 'starting' | 'denied' | 'unavailable' | 'running' | 'processing' | 'success' | 'error'
  message: string
}

const status = ref<CameraStatus>({ stage: 'starting', message: 'Starting camera…' })
const videoRef = ref<HTMLVideoElement | null>(null)
const busy = ref(false)
const faceDetected = ref(false)
const blinkPrompt = ref(false)
const distance = ref<FaceDistance>('none')

const ovalColor = computed(() => {
  if (status.value.stage === 'processing' && blinkPrompt.value && distance.value !== 'close' && distance.value !== 'far') {
    return 'border-emerald-400 shadow-[0_0_0_6px_rgba(16,185,129,0.3)]'
  }
  if (distance.value === 'close' || distance.value === 'far') {
    return 'border-red-400 shadow-[0_0_0_6px_rgba(248,113,113,0.25)]'
  }
  if (faceDetected.value && distance.value === 'ok') {
    return 'border-emerald-400 shadow-[0_0_0_6px_rgba(16,185,129,0.25)]'
  }
  return 'border-white/70'
})

// The single descriptive guidance line shown during live scanning.
const guidance = computed(() => {
  const s = status.value
  if (s.stage === 'starting') return { text: 'Starting camera…', kind: 'neutral' as const }
  if (s.stage === 'denied' || s.stage === 'unavailable') return { text: s.message, kind: 'error' as const }

  // Distance corrections always take priority — they tell the student exactly
  // what to change before anything else can proceed.
  if (distance.value === 'close') return { text: 'Too close — move back a little', kind: 'error' as const }
  if (distance.value === 'far') return { text: 'Too far — move closer', kind: 'error' as const }

  if (!faceDetected.value) return { text: 'Position your face inside the oval', kind: 'neutral' as const }

  // Map the live detection message to a clear, descriptive instruction.
  if (/saving|verifying|captured/i.test(s.message)) {
    return { text: 'Capturing your face…', kind: 'busy' as const }
  }
  if (/blink detected/i.test(s.message)) {
    return { text: 'Blink detected — hold still', kind: 'action' as const }
  }
  if (/open your eyes/i.test(s.message)) {
    return { text: 'Open your eyes, then blink', kind: 'action' as const }
  }
  if (/did not match/i.test(s.message)) {
    return { text: 'Face not recognized — hold still', kind: 'error' as const }
  }
  if (/face lost/i.test(s.message)) {
    return { text: 'Keep your face in the oval', kind: 'neutral' as const }
  }
  if (/hold still/i.test(s.message)) {
    return { text: 'Hold still…', kind: 'neutral' as const }
  }
  if (blinkPrompt.value) return { text: 'Blink now', kind: 'action' as const }
  if (s.message) return { text: s.message, kind: 'neutral' as const }
  return { text: 'Position your face inside the oval', kind: 'neutral' as const }
})

const guidancePill = computed(() => {
  const map = {
    neutral: 'bg-black/60 text-white',
    error: 'bg-red-500 text-white',
    busy: 'bg-black/60 text-amber-300',
    action: 'bg-emerald-600 text-white',
  }
  return map[guidance.value.kind]
})

const capturingStep = computed(() => /saving|verifying|captured/i.test(status.value.message))

let stream: MediaStream | null = null
let running = false

function stopStream() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
    stream = null
  }
  running = false
}

async function startCamera(): Promise<HTMLVideoElement> {
  const video = videoRef.value
  if (!video) {
    throw new Error('Video element not found')
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    })
    video.srcObject = stream
    await video.play()
    await waitForVideo(video)
    return video
  } catch (error) {
    const err = error as { name?: string; message?: string }
    if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
      status.value = { stage: 'denied', message: 'Camera access was denied. Enable it in your browser settings.' }
    } else if (err.name === 'NotFoundError' || err.name === 'NotReadableError' || err.name === 'OverconstrainedError') {
      status.value = { stage: 'unavailable', message: 'No camera is available on this device.' }
    } else {
      status.value = { stage: 'error', message: err.message || 'Failed to start camera.' }
    }
    throw new Error(status.value.message)
  }
}

async function startSession() {
  if (busy.value) return
  busy.value = true
  faceDetected.value = false
  status.value = { stage: 'starting', message: 'Loading face recognition…' }
  console.log('[FaceCamera] startSession mode=' + props.mode + ' userId=' + props.userId)

  let video: HTMLVideoElement | null = null
  try {
    video = await startCamera()
    running = true
    status.value = { stage: 'running', message: 'Look at the camera' }
    console.log('[FaceCamera] camera started, running burst')
    const result = await runFaceBurst(video, {
      mode: props.mode,
      userId: props.userId,
      enrolled: props.enrolled,
      onStatus: (message) => {
        if (running) {
          console.log('[FaceCamera] status:', message)
          // "Look at the camera" is the only status emitted while no face is
          // detected; every other message implies a face is framed.
          faceDetected.value = !/Look at the camera/i.test(message)
          // The oval turns green (blink state) once the face is framed and we
          // are waiting for or have just registered a blink.
          blinkPrompt.value = /Blink now|Open your eyes|Blink detected|Hold still/i.test(message)
          status.value = { stage: 'processing', message }
        }
      },
      onDistance: (state) => {
        distance.value = state
      },
    })

    console.log('[FaceCamera] burst result success=' + result.success + ' reason=' + result.reason)

    if (result.success) {
      running = false
      status.value = {
        stage: 'success',
        message: props.mode === 'enroll' ? 'Face enrolled successfully!' : 'Identity verified!',
      }
      // Brief pause so the student clearly sees the success state, then emit.
      setTimeout(() => emit('success', result), 900)
    } else {
      status.value = { stage: 'error', message: result.reason }
      emit('error', result.reason)
    }
  } catch (e) {
    const msg = (e as Error)?.message || 'Face verification failed'
    console.log('[FaceCamera] session error:', msg)
    status.value = { stage: 'error', message: msg }
    emit('error', msg)
  } finally {
    busy.value = false
    stopStream()
  }
}

function handleCancel() {
  stopStream()
  emit('cancel')
}

function retry() {
  stopStream()
  status.value = { stage: 'starting', message: 'Starting camera…' }
  startSession()
}

onMounted(() => {
  startSession()
})
</script>

<template>
  <div class="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
    <video
      ref="videoRef"
      autoplay
      muted
      playsinline
      class="absolute inset-0 h-full w-full object-cover -scale-x-100"
    />

    <!-- Face-shaped vertical oval guide -->
    <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        class="relative h-[80%] w-[58%] max-w-[260px] rounded-[50%] border-2 transition-colors duration-300"
        :class="ovalColor"
      >
        <!-- Scanning sweep line while a face is framed -->
        <div
          v-if="status.stage === 'processing' && faceDetected"
          class="scan-sweep absolute inset-x-3"
        ></div>
        <div
          class="absolute inset-3 rounded-[50%] border"
          :class="distance === 'ok' ? 'border-emerald-400/40' : distance === 'none' ? 'border-white/25' : 'border-red-400/40'"
        ></div>
        <div
          v-if="faceDetected"
          class="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          :class="distance === 'ok' ? 'bg-emerald-400' : distance === 'none' ? 'bg-white' : 'bg-red-400'"
        ></div>
      </div>
    </div>

    <div
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
      :class="status.stage === 'running' || status.stage === 'processing' ? 'bg-transparent' : 'bg-black/70'"
    >
      <!-- Starting / loading -->
      <template v-if="status.stage === 'starting'">
        <div class="h-10 w-10 animate-spin rounded-full border-4 border-white/25 border-t-white"></div>
        <p class="text-sm font-medium text-white">{{ status.message }}</p>
      </template>

      <!-- Live scanning -->
      <template v-else-if="status.stage === 'running' || status.stage === 'processing'">
        <!-- Step progress: Position → Blink → Capture -->
        <div class="absolute inset-x-0 top-4 flex justify-center px-4">
          <div class="flex items-center gap-1 rounded-full bg-black/55 px-3 py-1.5 backdrop-blur-sm">
            <span
              class="rounded-full px-2 py-0.5 text-[11px] font-bold transition-colors"
              :class="!faceDetected ? 'bg-emerald-500 text-white' : 'bg-white/20 text-white/60'"
            >
              1 · Position
            </span>
            <span class="text-white/30">›</span>
            <span
              class="rounded-full px-2 py-0.5 text-[11px] font-bold transition-colors"
              :class="faceDetected && !capturingStep ? 'bg-emerald-500 text-white' : 'bg-white/20 text-white/60'"
            >
              2 · Blink
            </span>
            <span class="text-white/30">›</span>
            <span
              class="rounded-full px-2 py-0.5 text-[11px] font-bold transition-colors"
              :class="capturingStep ? 'bg-emerald-500 text-white animate-pulse' : 'bg-white/20 text-white/60'"
            >
              3 · Capture
            </span>
          </div>
        </div>

        <!-- Persistent descriptive guidance bar -->
        <div class="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-4">
          <span
            class="inline-flex max-w-full items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur-sm transition-colors"
            :class="guidancePill"
          >
            <span
              v-if="guidance.kind === 'busy'"
              class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300/40 border-t-amber-300"
            ></span>
            <span v-else-if="guidance.kind === 'action'" class="h-2 w-2 animate-pulse rounded-full bg-white"></span>
            <span v-else-if="guidance.kind === 'error'" class="h-2 w-2 rounded-full bg-white"></span>
            <span class="truncate">{{ guidance.text }}</span>
          </span>
        </div>
        <p class="sr-only">{{ status.message }}</p>
      </template>

      <!-- Camera denied -->
      <template v-else-if="status.stage === 'denied'">
        <svg class="h-12 w-12 text-red-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <p class="text-sm font-medium text-white">{{ status.message }}</p>
        <div class="flex flex-col items-center gap-2">
          <button @click="retry" class="rounded-lg bg-white/15 px-5 py-2 text-sm font-semibold text-white ring-1 ring-white/30">
            Try Again
          </button>
          <button @click="handleCancel" class="rounded-lg bg-white/10 px-5 py-2 text-sm font-medium text-white">
            Cancel
          </button>
        </div>
      </template>

      <!-- Camera unavailable -->
      <template v-else-if="status.stage === 'unavailable'">
        <svg class="h-12 w-12 text-amber-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p class="text-sm font-medium text-white">{{ status.message }}</p>
        <div class="flex flex-col items-center gap-2">
          <button @click="retry" class="rounded-lg bg-white/15 px-5 py-2 text-sm font-semibold text-white ring-1 ring-white/30">
            Try Again
          </button>
          <button @click="handleCancel" class="rounded-lg bg-white/10 px-5 py-2 text-sm font-medium text-white">
            Cancel
          </button>
        </div>
      </template>

      <!-- Success -->
      <template v-else-if="status.stage === 'success'">
        <div class="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500">
          <svg class="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p class="text-base font-semibold text-white">{{ status.message }}</p>
      </template>

      <!-- Error -->
      <template v-else-if="status.stage === 'error'">
        <div class="flex h-16 w-16 items-center justify-center rounded-full bg-red-500">
          <svg class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p class="text-sm font-medium text-white">{{ status.message }}</p>
        <div class="flex flex-col items-center gap-2">
          <button @click="retry" class="rounded-lg bg-white/15 px-5 py-2 text-sm font-semibold text-white ring-1 ring-white/30">
            Try Again
          </button>
          <button @click="handleCancel" class="rounded-lg bg-white/10 px-5 py-2 text-sm font-medium text-white">
            Cancel
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.scan-sweep {
  height: 3px;
  top: 12%;
  border-radius: 9999px;
  background: linear-gradient(90deg, transparent, rgba(52, 211, 153, 0.95), transparent);
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.9);
  animation: scan-sweep-move 1.6s ease-in-out infinite;
  pointer-events: none;
}

@keyframes scan-sweep-move {
  0% {
    top: 12%;
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
  100% {
    top: 84%;
    opacity: 0.4;
  }
}
</style>
