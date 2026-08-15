<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'

const route = useRoute()
const router = useRouter()
const notificationStore = useNotificationStore()

onMounted(() => {
  notificationStore.fetchNotifications()
})

interface Tab { name: string; label: string; icon: string; path: string }
interface Pill { leftTabs: Tab[]; rightTabs: Tab[]; fab: { icon: string; path: string } }

const pill: Pill = {
  leftTabs: [
    { name: 'dashboard', label: 'Home', icon: 'home', path: '/dashboard' },
    { name: 'payments', label: 'Payments', icon: 'fees', path: '/payments/history' },
  ],
  rightTabs: [
    { name: 'notifications', label: 'Notifications', icon: 'bell', path: '/notifications' },
    { name: 'profile', label: 'Profile', icon: 'person', path: '/profile' },
  ],
  fab: { icon: 'scan', path: '/scanner' },
}

function isActive(path: string): boolean {
  return route.path.startsWith(path)
}

function navigate(path: string) {
  router.push(path)
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 w-full px-3 z-20" style="padding-bottom: env(safe-area-inset-bottom, 0.75rem)">
    <div class="max-w-lg mx-auto bg-white rounded-2xl shadow-lg px-1.5 py-2 flex items-center justify-between">
      <button
        v-for="tab in pill.leftTabs"
        :key="tab.name"
        @click="navigate(tab.path)"
        class="relative flex flex-col items-center justify-center flex-1 py-1 text-xs transition-colors"
        :class="isActive(tab.path) ? 'text-primary-700' : 'text-slate-400'"
      >
        <span v-if="isActive(tab.path)" class="absolute -top-1.5 w-8 h-0.5 rounded-full bg-primary-700" />

        <svg v-if="tab.icon === 'home'" class="w-5 h-5 mb-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z"/>
        </svg>
        <svg v-else-if="tab.icon === 'fees'" class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
        </svg>
        <svg v-else-if="tab.icon === 'calendar'" class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>
        </svg>
        <span class="text-[10px] font-medium">{{ tab.label }}</span>
      </button>

      <div class="flex-1 flex justify-center">
        <button
          @click="navigate(pill.fab.path)"
          class="w-14 h-14 rounded-full bg-primary-700 flex items-center justify-center shadow-lg -mt-8 border-4 border-[#F3F4F1]"
        >
          <svg v-if="pill.fab.icon === 'scan'" class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
          </svg>
          <svg v-else class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </div>

      <button
        v-for="tab in pill.rightTabs"
        :key="tab.name"
        @click="navigate(tab.path)"
        class="relative flex flex-col items-center justify-center flex-1 py-1 text-xs transition-colors"
        :class="isActive(tab.path) ? 'text-primary-700' : 'text-slate-400'"
      >
        <span v-if="isActive(tab.path)" class="absolute -top-1.5 w-8 h-0.5 rounded-full bg-primary-700" />

        <svg v-if="tab.icon === 'bell'" class="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        <span
          v-if="tab.icon === 'bell' && notificationStore.unreadCount > 0"
          class="absolute top-0 right-1.5 bg-red-500 text-white text-[9px] leading-none rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-semibold"
        >
          {{ notificationStore.unreadCount > 99 ? '99+' : notificationStore.unreadCount }}
        </span>
        <svg v-else-if="tab.icon === 'person'" class="w-5 h-5 mb-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 4a3 3 0 100 6 3 3 0 000-6zm0 14a7.97 7.97 0 01-6-3c.045-2 4-3.1 6-3.1s5.955 1.1 6 3.1a7.97 7.97 0 01-6 3z" clip-rule="evenodd"/>
        </svg>
        <span class="text-[10px] font-medium">{{ tab.label }}</span>
      </button>
    </div>
  </nav>
</template>
