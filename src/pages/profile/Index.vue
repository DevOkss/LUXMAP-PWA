<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import { useAuthStore } from '@/stores/authStore'
import { getPushState, subscribeToPush, unsubscribeFromPush } from '@/services/push'
import type { PushState } from '@/services/push'

const router = useRouter()
const authStore = useAuthStore()
const signingOut = ref(false)
const pushState = ref<PushState>({ supported: false, permission: 'unsupported', subscribed: false, loading: true })
const pushBusy = ref(false)
const pushError = ref('')

async function refreshPushState() {
  pushState.value = await getPushState()
}

async function handlePushToggle() {
  pushError.value = ''
  if (pushState.value.subscribed) {
    pushBusy.value = true
    try {
      await unsubscribeFromPush()
    } finally {
      pushBusy.value = false
    }
  } else {
    pushBusy.value = true
    try {
      const enabled = await subscribeToPush()
      if (!enabled) {
        pushError.value =
          'Could not enable notifications. Notifications require a secure connection (HTTPS or localhost) and browser permission. Enable them in your browser settings and try again.'
      }
    } finally {
      pushBusy.value = false
    }
  }
  await refreshPushState()
}

onMounted(() => {
  refreshPushState()
  authStore.refreshFromInstitution().catch(() => {})
})
watch(() => pushState.value.permission, refreshPushState)

async function handleLogout() {
  signingOut.value = true
  await authStore.logout()
  router.push({ name: 'login' })
}

const initials = computed(() => {
  const name = authStore.user?.name || ''
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
})

function yearLabel(level: number | null | undefined): string {
  if (!level) return '—'
  const ordinals: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' }
  return `${ordinals[level] || level} Year`
}

function sexLabel(sex: string | null | undefined): string {
  if (!sex) return '—'
  const value = sex.toLowerCase()
  if (value === 'm') return 'Male'
  if (value === 'f') return 'Female'
  return sex
}

const infoRows = computed(() => {
  const u = authStore.user
  return [
    { icon: 'institute' as const, label: 'Institute', value: u?.institute || '—' },
    { icon: 'program' as const, label: 'Program / Course', value: u?.program || '—' },
    { icon: 'year' as const, label: 'Year Level', value: yearLabel(u?.year_level) },
    { icon: 'email' as const, label: 'Email', value: u?.email || '—' },
    { icon: 'phone' as const, label: 'Phone', value: u?.phone || '—' },
    { icon: 'sex' as const, label: 'Sex', value: sexLabel(u?.sex) },
  ]
})
</script>

<template>
  <div class="space-y-4">
    <LoadingOverlay :loading="signingOut" message="Signing out..." />

    <!-- Hero -->
    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 p-6 shadow-sm">
      <div class="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-white/10"></div>
      <div class="absolute -bottom-8 left-8 h-24 w-24 rounded-full bg-white/5"></div>
      <div class="relative flex flex-col items-center text-center">
        <div class="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg ring-4 ring-white/20">
          <span class="text-2xl font-extrabold text-primary-800">{{ initials }}</span>
        </div>
        <h2 class="text-lg font-bold text-white">{{ authStore.user?.name }}</h2>
        <p class="mt-0.5 text-sm font-medium tracking-wide text-primary-100">{{ authStore.user?.student_number }}</p>
        <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span class="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-primary-50">Student</span>
          <span
            v-if="authStore.user?.academic_term"
            class="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-primary-50"
          >
            {{ authStore.user.academic_term }}
          </span>
        </div>
      </div>
    </div>

    <!-- Student information -->
    <div class="rounded-3xl bg-white p-5 shadow-sm">
      <h3 class="mb-4 text-lg font-bold text-slate-900">Student Information</h3>
      <div class="grid grid-cols-2 gap-3">
        <div v-for="row in infoRows" :key="row.label" class="rounded-2xl bg-gray-50 p-4">
          <span
            class="mb-2 flex h-9 w-9 items-center justify-center rounded-xl"
            :class="{
              'bg-primary-50 text-primary-700': row.icon === 'institute',
              'bg-green-50 text-green-600': row.icon === 'program',
              'bg-amber-50 text-amber-600': row.icon === 'year',
              'bg-blue-50 text-blue-600': row.icon === 'email',
              'bg-teal-50 text-teal-600': row.icon === 'phone',
              'bg-violet-50 text-violet-600': row.icon === 'sex',
            }"
          >
            <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <template v-if="row.icon === 'institute'">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9h.01M9 12h.01M9 15h.01M9 18h.01" />
              </template>
              <template v-else-if="row.icon === 'program'">
                <path stroke-linecap="round" stroke-linejoin="round" d="M22 10v6M2 10l10-5 10 5-10 5zM6 12v5c3 3 9 3 12 0v-5" />
              </template>
              <template v-else-if="row.icon === 'year'">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 3v4M16 3v4M3 10h18" />
              </template>
              <template v-else-if="row.icon === 'email'">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path stroke-linecap="round" stroke-linejoin="round" d="m22 7-10 5L2 7" />
              </template>
              <template v-else-if="row.icon === 'phone'">
                <path stroke-linecap="round" stroke-linejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </template>
              <template v-else-if="row.icon === 'sex'">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
              </template>
            </svg>
          </span>
          <p class="text-xs text-gray-400">{{ row.label }}</p>
          <p class="mt-0.5 text-sm font-semibold text-gray-900">{{ row.value }}</p>
        </div>
      </div>
    </div>

    <!-- Notifications -->
    <div v-if="pushState.supported" class="rounded-3xl bg-white p-5 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-start gap-3">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50">
            <svg class="h-5 w-5 text-primary-700" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </span>
          <div>
            <p class="text-sm font-semibold text-gray-900">Push Notifications</p>
            <p class="mt-0.5 text-xs text-gray-500">Receive alerts for fee postings and due dates.</p>
            <p v-if="pushState.permission === 'denied'" class="mt-1 text-xs text-red-600">
              Notifications are blocked. Enable them for this site in your browser settings.
            </p>
            <p v-else-if="pushError" class="mt-1 text-xs text-red-600">{{ pushError }}</p>
          </div>
        </div>
        <button
          :disabled="pushBusy || pushState.permission === 'denied'"
          role="switch"
          :aria-checked="pushState.subscribed"
          class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          :class="pushState.subscribed ? 'bg-primary-600' : 'bg-gray-300'"
          @click="handlePushToggle"
        >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
            :class="pushState.subscribed ? 'translate-x-6' : 'translate-x-1'"
          />
        </button>
      </div>
    </div>

    <!-- Device & Security -->
    <button
      @click="router.push({ name: 'security' })"
      class="w-full rounded-3xl bg-white p-5 text-left shadow-sm transition-colors hover:bg-gray-50"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50">
            <svg class="h-5 w-5 text-primary-700" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </span>
          <div>
            <p class="text-sm font-semibold text-gray-900">Device & Security</p>
            <p class="text-xs text-gray-500">Device binding and face verification</p>
          </div>
        </div>
        <svg class="h-5 w-5 text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7" />
        </svg>
      </div>
    </button>

    <!-- Request Shift -->
    <button
      @click="router.push({ name: 'shift-request' })"
      class="w-full rounded-3xl bg-white p-5 text-left shadow-sm transition-colors hover:bg-gray-50"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50">
            <svg class="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M22 11l-3-3m0 0l-3 3m3-3v8" />
            </svg>
          </span>
          <div>
            <p class="text-sm font-semibold text-gray-900">Request Shift</p>
            <p class="text-xs text-gray-500">Move to another institute or program</p>
          </div>
        </div>
        <svg class="h-5 w-5 text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7" />
        </svg>
      </div>
    </button>

    <!-- Sign out -->
    <button
      @click="handleLogout"
      class="w-full rounded-3xl bg-white p-5 text-left shadow-sm transition-colors hover:bg-gray-50"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50">
            <svg class="h-5 w-5 text-red-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" />
            </svg>
          </span>
          <div>
            <p class="text-sm font-semibold text-red-600">Sign Out</p>
            <p class="text-xs text-gray-500">End your session on this device</p>
          </div>
        </div>
        <svg class="h-5 w-5 text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7" />
        </svg>
      </div>
    </button>
  </div>
</template>
