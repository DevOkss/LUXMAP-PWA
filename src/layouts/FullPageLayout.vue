<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const backLabel = computed(() => (route.meta.back as string) || 'Back')
const backRoute = computed(() => (route.meta.backRoute as string) || null)
// Security-gate pages (device binding / face enrollment / transfer / verify)
// have no other escape route — the router guard keeps the student there until
// the step is completed — so offer a Sign Out.
const securityFlow = computed(() => !!route.meta.securityFlow)
const signingOut = ref(false)

function goBack() {
  if (backRoute.value) {
    router.push({ name: backRoute.value, params: route.meta.backParams as Record<string, string> || undefined })
  } else {
    router.back()
  }
}

async function signOut() {
  if (signingOut.value) return
  signingOut.value = true
  await authStore.logout().catch(() => {})
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="min-h-dvh bg-[#F3F4F1]">
    <div class="max-w-3xl mx-auto px-4 py-4">
      <div class="mb-4 flex items-center justify-between gap-3">
        <button
          @click="goBack"
          class="flex items-center gap-1 text-primary-700 text-sm font-medium hover:text-primary-800"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          {{ backLabel }}
        </button>
        <button
          v-if="securityFlow"
          @click="signOut"
          :disabled="signingOut"
          class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          {{ signingOut ? 'Signing out…' : 'Sign Out' }}
        </button>
      </div>
      <RouterView v-slot="{ Component }">
        <transition name="page">
          <component :is="Component" />
        </transition>
      </RouterView>
    </div>
  </div>
</template>
