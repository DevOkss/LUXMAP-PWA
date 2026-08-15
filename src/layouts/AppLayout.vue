<script setup lang="ts">
import { onMounted, watch, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import BottomTabBar from '@/components/BottomTabBar.vue'
import OfflineBadge from '@/components/OfflineBadge.vue'
import { useAuthStore } from '@/stores/authStore'
import { useSyncStore } from '@/stores/syncStore'

const router = useRouter()
const authStore = useAuthStore()
const syncStore = useSyncStore()
const showSyncPrompt = ref(false)

const userInitials = computed(() => {
  const name = authStore.user?.name || ''
  const parts = name.split(' ')
  return parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2).toUpperCase()
})

onMounted(async () => {
  await syncStore.refreshQueueCount()
  if (syncStore.queueCount > 0) {
    showSyncPrompt.value = true
  }
  authStore.refreshFromInstitution().catch(() => {})
  if (!authStore.currentWorkspace?.role || authStore.workspaces.length === 0) {
    await authStore.fetchWorkspaces().catch(() => {})
    if (!authStore.currentWorkspace?.role && authStore.workspaces.length > 0) {
      const ws = authStore.workspaces[0]
      await authStore.switchWorkspace(ws)
    }
  }
})

function goToSyncQueue() {
  showSyncPrompt.value = false
  router.push({ name: 'attendance-queue' })
}

function dismissSyncPrompt() {
  showSyncPrompt.value = false
}

watch(() => authStore.isAuthenticated, (val) => {
  if (!val) router.push({ name: 'login' })
})
</script>

<template>
  <div class="relative flex flex-col min-h-dvh bg-[#F3F4F1]">

    <header
      class="relative z-0 px-5 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-16"
      style="background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 50%), linear-gradient(160deg, #064E3B 0%, #065F46 55%, #047857 100%)"
    >
      <div class="max-w-3xl mx-auto flex items-start justify-between">
        <div class="flex items-center gap-4 min-w-0">
          <div class="w-14 h-14 rounded-full bg-white flex items-center justify-center shrink-0 shadow-md p-0.5">
            <span class="text-base font-bold text-primary-800">{{ userInitials }}</span>
          </div>
          <div class="min-w-0">
            <p class="text-primary-100 text-sm">Welcome back,</p>
            <h1 class="text-white text-lg font-bold leading-tight truncate">{{ authStore.user?.name || 'Student' }}</h1>
            <p class="text-primary-100 text-sm">
              <span>Student</span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <OfflineBadge />
        </div>
      </div>
    </header>

    <main class="relative z-10 -mt-10 px-4 sm:px-6 pb-32 flex-1">
      <div class="max-w-3xl mx-auto space-y-5">
        <RouterView v-slot="{ Component }">
          <transition name="page">
            <component :is="Component" />
          </transition>
        </RouterView>
      </div>
    </main>

    <div class="fixed left-0 bottom-0 w-full h-36 overflow-hidden pointer-events-none z-0">
      <svg viewBox="0 0 430 160" class="w-full h-full" preserveAspectRatio="none">
        <path d="M0,60 C120,10 260,140 430,70 L430,160 L0,160 Z" fill="#064E3B"/>
        <path d="M430,90 C350,130 300,60 200,110 C160,130 120,150 0,140 L0,160 L430,160 Z" fill="#F59E0B" opacity="0.9"/>
      </svg>
    </div>

    <BottomTabBar />

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showSyncPrompt" class="fixed inset-0 z-[200] flex items-center justify-center px-6">
          <div class="absolute inset-0 bg-black/50" @click="dismissSyncPrompt"></div>
          <div class="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl">
            <div class="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <svg class="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </div>
            <h3 class="text-center text-lg font-bold text-gray-900">Attendance needs to sync</h3>
            <p class="text-center text-sm text-gray-500 mt-2">
              You have {{ syncStore.queueCount }} record{{ syncStore.queueCount !== 1 ? 's' : '' }} saved offline.
              Go to the sync page to upload them.
            </p>
            <div class="mt-6 space-y-2">
              <button
                @click="goToSyncQueue"
                class="w-full rounded-xl bg-[#20673A] py-3.5 font-semibold text-white hover:bg-[#1b5a31] transition-colors"
              >
                Go to Sync
              </button>
              <button
                @click="dismissSyncPrompt"
                class="w-full rounded-xl py-3 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
