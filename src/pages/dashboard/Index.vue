<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useFeeStore } from '@/stores/feeStore'
import api from '@/services/api'
import { isStudentRequired, requiredYearsLabel } from '@/utils/requiredStudents'
import { isEventEnded } from '@/utils/eventTime'
import type { OrgEventStats, Event, Fee } from '@/types'

const router = useRouter()
const authStore = useAuthStore()
const feeStore = useFeeStore()

const upcoming = ref<Event[]>([])
const loadingUpcoming = ref(false)
const dueFees = ref<Fee[]>([])
const showLocationPrompt = ref(false)

onMounted(async () => {
  await loadUpcoming()
  await feeStore.fetchFees().catch(() => {})
  dueFees.value = feeStore.dueFees.slice(0, 3)

  if (!localStorage.getItem('location_prompted')) {
    showLocationPrompt.value = true
  }
})

async function loadUpcoming() {
  loadingUpcoming.value = true
  try {
    const res = await api.get('/events/student')
    const orgs: OrgEventStats[] = res.data.organizations || res.data || []
    const orgIds = orgs.map(o => o.id)
    if (!orgIds.length) return

    const promises = orgIds.map(id =>
      api.get('/events', { params: { organization_id: String(id) } }).catch(() => ({ data: [] }))
    )
    const responses = await Promise.all(promises)

    const all: Event[] = []
    for (const r of responses) {
      const list = r.data.data || r.data.events || r.data || []
      for (const e of (Array.isArray(list) ? list : [])) {
        if (e.status === 'published' && !isEventEnded(e.event_date, e.time_to)) {
          all.push(e)
        }
      }
    }
    all.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
    upcoming.value = all.slice(0, 3)
  } catch {
    // offline — events stay empty
  } finally {
    loadingUpcoming.value = false
  }
}

function isRequired(evt: Event): boolean {
  return isStudentRequired(evt.required_years, authStore.user?.year_level)
}

function requiredLabel(evt: Event): string {
  return requiredYearsLabel(evt.required_years)
}

function goToEvent(evt: Event) {
  const type = evt.organization?.type
  if (!type) return
  router.push({ name: 'events-show', params: { type, eventId: evt.id } })
}

function orgBadge(evt: Event): string {
  const type = evt.organization?.type
  if (type === 'ssc') return 'bg-primary-50 text-primary-700'
  if (type === 'isc') return 'bg-blue-50 text-blue-700'
  if (type === 'sro') return 'bg-amber-50 text-amber-700'
  return 'bg-gray-100 text-gray-600'
}

function requestLocation() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      () => { console.log('Location enabled') },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }
  localStorage.setItem('location_prompted', '1')
  showLocationPrompt.value = false
}

function skipLocation() {
  localStorage.setItem('location_prompted', '1')
  showLocationPrompt.value = false
}

function monthLabel(d: string) {
  return new Date(d).toLocaleString('en', { month: 'short' }).toUpperCase()
}
function dayLabel(d: string) {
  return String(new Date(d).getDate())
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })
}
function formatTime(t: string | null) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
}
</script>

<template>
  <Teleport to="body">
    <div v-if="showLocationPrompt" class="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center">
      <div class="absolute inset-0 bg-black/40" @click="skipLocation"></div>
      <div class="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-3xl bg-white p-6 shadow-xl">
        <div class="flex flex-col items-center text-center">
          <div class="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
            </svg>
          </div>
          <h3 class="text-lg font-bold text-gray-900">Enable Location</h3>
          <p class="mt-2 text-sm text-gray-500">We use your location to verify attendance during events.</p>
        </div>
        <div class="mt-6 flex flex-col gap-2">
          <button @click="requestLocation" class="w-full rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white">Allow</button>
          <button @click="skipLocation" class="w-full rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-600">Not Now</button>
        </div>
      </div>
    </div>
  </Teleport>

  <div class="space-y-6">

    <!-- Quick Access -->
    <div class="bg-white rounded-3xl shadow-sm p-5">
      <h2 class="text-slate-900 font-bold text-lg mb-4">Quick Access</h2>
      <div class="grid grid-cols-4 gap-3">
        <button @click="router.push('/events')" class="flex flex-col items-center gap-2">
          <span class="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center">
            <svg class="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 15l2 2 4-4"/>
            </svg>
          </span>
          <span class="text-xs font-medium text-primary-800">Events</span>
        </button>
        <button @click="router.push('/attendance')" class="flex flex-col items-center gap-2">
          <span class="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </span>
          <span class="text-xs font-medium text-green-700">Attendance</span>
        </button>
        <button @click="router.push('/fees')" class="flex flex-col items-center gap-2">
          <span class="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
            <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path d="M3 7a2 2 0 012-2h13a1 1 0 011 1v3M3 7v11a2 2 0 002 2h14a2 2 0 002-2v-8a1 1 0 00-1-1h-4a2 2 0 100 4h5"/>
            </svg>
          </span>
          <span class="text-xs font-medium text-amber-700">Fees</span>
        </button>
        <button @click="router.push('/announcements')" class="flex flex-col items-center gap-2">
          <span class="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
            </svg>
          </span>
          <span class="text-xs font-medium text-blue-700">Announcement</span>
        </button>
      </div>
    </div>

    <!-- Upcoming Events -->
    <div class="bg-white rounded-3xl shadow-sm p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-slate-900 font-bold text-lg">Upcoming Events</h2>
        <button @click="router.push('/events')" class="flex items-center gap-1 text-primary-700 text-sm font-semibold">
          View all
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>

      <div v-if="loadingUpcoming" class="flex justify-center py-6">
        <div class="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
      <p v-else-if="!upcoming.length" class="text-gray-400 text-sm text-center py-4">No upcoming events</p>

      <div v-else class="space-y-4">
        <button
          v-for="evt in upcoming"
          :key="evt.id"
          @click="goToEvent(evt)"
          class="w-full flex items-start gap-4 text-left cursor-pointer hover:bg-gray-50 rounded-2xl p-1 -m-1 transition-colors"
        >
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-b from-primary-700 to-primary-900 text-white flex flex-col items-center justify-center shrink-0">
            <span class="text-[11px] font-semibold tracking-wide">{{ monthLabel(evt.event_date) }}</span>
            <span class="text-2xl font-extrabold leading-none">{{ dayLabel(evt.event_date) }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <h3 class="font-bold text-slate-900 text-[15px] leading-snug">{{ evt.title }}</h3>
              <svg class="w-4 h-4 text-gray-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </div>
            <div v-if="evt.organization?.name" class="mt-1">
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full" :class="orgBadge(evt)">{{ evt.organization.name }}</span>
            </div>
            <div class="mt-1 flex items-center gap-1.5 text-slate-500 text-sm" v-if="evt.venue">
              <svg class="w-4 h-4 text-primary-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 21c-4-4-7-7.5-7-11a7 7 0 1114 0c0 3.5-3 7-7 11z"/>
                <circle cx="12" cy="10" r="2.5"/>
              </svg>
              {{ evt.venue }}
            </div>
            <div class="mt-1 flex items-center gap-1.5 text-slate-500 text-sm" v-if="evt.time_from">
              <svg class="w-4 h-4 text-primary-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 2"/>
              </svg>
              {{ formatTime(evt.time_from) }} – {{ formatTime(evt.time_to) }}
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-1.5 text-slate-500 text-sm" v-if="requiredLabel(evt)">
              <svg class="w-4 h-4 text-primary-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
              <span>{{ requiredLabel(evt) }}</span>
              <span
                v-if="isRequired(evt)"
                class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"
              >You're required</span>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Pending Fees -->
    <div v-if="dueFees.length" class="bg-white rounded-3xl shadow-sm p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-slate-900 font-bold text-lg">Pending Fees</h2>
        <button @click="router.push('/fees')" class="flex items-center gap-1 text-primary-700 text-sm font-semibold">
          Pay now
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div class="space-y-3">
        <div v-for="fee in dueFees" :key="fee.id" class="flex items-center justify-between">
  <div class="space-y-6">
            <p class="font-semibold text-sm">{{ fee.name }}</p>
            <p class="text-xs text-gray-400" v-if="fee.due_date">Due {{ new Date(fee.due_date).toLocaleDateString() }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-amber-600">₱{{ Number(fee.amount).toFixed(2) }}</span>
            <span class="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pending</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
