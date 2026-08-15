<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'

const emit = defineEmits<{
  scan: [data: string]
  error: [error: string]
}>()

type ScannerStatus = 'starting' | 'scanning' | 'denied' | 'unavailable' | 'error'
const status = ref<ScannerStatus>('starting')
const errorMsg = ref('')
const readerId = ref(`qr-reader-${Date.now()}`)

let scanner: Html5Qrcode | null = null

onMounted(() => {
  setTimeout(() => startScanning(), 300)
})

onUnmounted(() => {
  stopScanning()
})

async function startScanning() {
  status.value = 'starting'
  errorMsg.value = ''
  stopScanning()
  try {
    scanner = new Html5Qrcode(readerId.value)
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      (decodedText: string) => {
        emit('scan', decodedText)
        scanner?.stop().catch(() => {})
      },
      () => {},
    )
    status.value = 'scanning'
  } catch (e: any) {
    const msg = e?.message || e?.toString() || ''
    if (msg.includes('NotAllowed') || msg.includes('Permission')) {
      status.value = 'denied'
      errorMsg.value = 'Camera access was denied. Please enable it in your browser settings.'
    } else if (msg.includes('NotFound') || msg.includes('No video') || msg.includes('streaming')) {
      status.value = 'unavailable'
      errorMsg.value = 'Camera not available. Make sure camera permissions are granted and no other app is using it.'
    } else {
      status.value = 'error'
      errorMsg.value = msg || 'Failed to start scanner.'
    }
    emit('error', errorMsg.value)
  }
}

function stopScanning() {
  if (scanner) {
    try { scanner.stop() } catch {}
    try { scanner.clear() } catch {}
    scanner = null
  }
}

async function retry() {
  stopScanning()
  readerId.value = `qr-reader-${Date.now()}`
  await nextTick()
  await startScanning()
}

defineExpose({ stopScanning })
</script>

<template>
  <div class="relative">
    <div
      :id="readerId"
      class="w-full overflow-hidden rounded-xl"
      :class="status === 'scanning' ? '' : 'invisible absolute'"
    ></div>

    <div v-if="status === 'starting'" class="bg-white rounded-xl p-8 text-center">
      <div class="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3"></div>
      <p class="text-sm text-gray-500">Starting camera...</p>
    </div>

    <div v-else-if="status === 'denied'" class="bg-white rounded-xl p-8 text-center">
      <svg class="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
      </svg>
      <p class="text-sm font-medium text-gray-700 mb-1">Camera Denied</p>
      <p class="text-xs text-gray-400 mb-4">{{ errorMsg }}</p>
      <button @click="retry" class="rounded-lg bg-primary-700 px-6 py-2 text-sm font-medium text-white">Retry</button>
    </div>

    <div v-else-if="status === 'unavailable'" class="bg-white rounded-xl p-8 text-center">
      <svg class="w-12 h-12 text-amber-400 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"/>
      </svg>
      <p class="text-sm font-medium text-gray-700 mb-1">No Camera</p>
      <p class="text-xs text-gray-400 mb-4">{{ errorMsg }}</p>
      <button @click="retry" class="rounded-lg bg-primary-700 px-6 py-2 text-sm font-medium text-white">Retry</button>
    </div>

    <div v-else-if="status === 'error'" class="bg-white rounded-xl p-8 text-center">
      <svg class="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
      </svg>
      <p class="text-sm font-medium text-gray-700 mb-1">Scanner Error</p>
      <p class="text-xs text-gray-400 mb-4">{{ errorMsg }}</p>
      <button @click="retry" class="rounded-lg bg-primary-700 px-6 py-2 text-sm font-medium text-white">Retry</button>
    </div>
  </div>
</template>
