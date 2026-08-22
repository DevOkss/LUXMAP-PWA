<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import {
  attachInstallPromptListener,
  attachInstalledListener,
  hasInstallPrompt,
  isMarkedInstalled,
  isStandalone,
  markDismissed,
  promptInstall,
} from '@/services/installPrompt'

const show = ref(false)
const installing = ref(false)
const installed = ref(false)

function syncVisibility() {
  const alreadyHandled = isStandalone() || isMarkedInstalled()
  if (alreadyHandled) {
    installed.value = true
    show.value = false
    return
  }
  show.value = hasInstallPrompt() && !installed.value
}

async function onInstall() {
  if (installing.value) return
  installing.value = true
  const ok = await promptInstall()
  installing.value = false
  if (ok) {
    installed.value = true
    show.value = false
  }
}

function onDismiss() {
  markDismissed()
  installed.value = true
  show.value = false
}

function onInstalled() {
  installed.value = true
  show.value = false
}

attachInstallPromptListener()

onMounted(() => {
  attachInstalledListener(onInstalled)
  syncVisibility()
  // The prompt event may arrive shortly after mount.
  window.addEventListener('beforeinstallprompt', syncVisibility)
  window.addEventListener('appinstalled', syncVisibility)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', syncVisibility)
  window.removeEventListener('appinstalled', syncVisibility)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="install-fade">
      <div
        v-if="show"
        class="install-banner fixed inset-x-0 bottom-0 z-[300] flex justify-center px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
      >
        <div class="install-banner-inner flex w-full max-w-sm items-center gap-3 rounded-2xl border border-primary-700/20 bg-white p-3.5 shadow-2xl">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-700">
            <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v10m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-gray-900">Install LuxMap</p>
            <p class="text-xs text-gray-500">Add it to your home screen for quick access.</p>
          </div>
          <button
            type="button"
            :disabled="installing"
            class="shrink-0 rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            @click="onInstall"
          >
            {{ installing ? 'Installing…' : 'Install' }}
          </button>
          <button
            type="button"
            aria-label="Dismiss install banner"
            class="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-600"
            @click="onDismiss"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.install-fade-enter-active,
.install-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.install-fade-enter-from,
.install-fade-leave-to {
  opacity: 0;
  transform: translateY(16px);
}
</style>
