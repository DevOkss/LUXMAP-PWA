<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api'
import { getEventStatus } from '@/utils/eventTime'
import { useNow } from '@/composables/useNow'
import { useAuthStore } from '@/stores/authStore'
import { isStudentRequired, requiredYearsLabel } from '@/utils/requiredStudents'
import type { Event } from '@/types'
import type { EventStatus } from '@/utils/eventTime'

const { now } = useNow()

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const orgType = route.params.type as string

const allEvents = ref<Event[]>([])
const loading = ref(true)
const offline = ref(false)
const filterView = ref('')
const viewMode = ref<'list' | 'calendar'>('list')
const calendarMonth = ref(new Date().getMonth())
const calendarYear = ref(new Date().getFullYear())
const selectedDate = ref<string | null>(null)

const orgName = ref(
  orgType === 'ssc' ? 'Supreme Student Council' :
  orgType === 'isc' ? 'Institute Student Council' :
  'Student Organization'
)

const typeLabel = orgType === 'ssc' ? 'SSC' : orgType === 'isc' ? 'ISC' : 'SRO'
const labelColor = orgType === 'ssc' ? 'bg-primary-50 text-primary-700' : orgType === 'isc' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'

const CACHE_KEY = `org_id_${orgType}`
let orgId: number | null = null

onMounted(async () => { await doLoad() })

async function resolveOrgId(): Promise<number | null> {
  if (orgId) return orgId
  try {
    const res = await api.get('/events/student')
    const orgs = res.data.organizations || res.data || []
    const match = orgs.find((o: any) => o.type === orgType)
    if (match) {
      orgId = match.id
      orgName.value = match.name || orgName.value
      localStorage.setItem(CACHE_KEY, String(orgId))
      return orgId
    }
  } catch {}
  return null
}

function getEventState(evt: Event): EventStatus {
  return getEventStatus(evt, now.value)
}

const filteredEvents = computed(() => {
  let list = allEvents.value.filter(e => e.status !== 'draft')
  if (filterView.value) {
    list = list.filter(e => getEventState(e) === filterView.value)
  }
  return list
})

async function doLoad() {
  loading.value = true
  offline.value = false

  if (!orgId) {
    orgId = await resolveOrgId()
    if (!orgId) {
      offline.value = true
      loading.value = false
      return
    }
  }

  try {
    const res = await api.get('/events', { params: { organization_id: String(orgId) } })
    allEvents.value = (res.data.data || res.data.events || res.data || []).sort(eventSortDesc)
    offline.value = false
  } catch {
    offline.value = true
  } finally {
    loading.value = false
  }
}

function toEventTimestamp(e: Event): number {
  const dateMs = new Date(e.event_date).getTime()
  if (isNaN(dateMs)) return 0
  const [h = 0, m = 0] = (e.time_from || '0:0').split(':').map(Number)
  return dateMs + (h * 60 + m) * 60000
}

function eventSortDesc(a: Event, b: Event): number {
  return toEventTimestamp(b) - toEventTimestamp(a)
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

function stateBadge(s: EventStatus) {
  if (s === 'upcoming') return 'bg-blue-100 text-blue-700'
  if (s === 'ongoing') return 'bg-green-100 text-green-700'
  if (s === 'done') return 'bg-amber-100 text-amber-700'
  return 'bg-purple-100 text-purple-700'
}

function isRequired(evt: Event): boolean {
  return isStudentRequired(evt.required_years, authStore.user?.year_level)
}

function requiredLabel(evt: Event): string {
  return requiredYearsLabel(evt.required_years)
}

function stateLabel(s: EventStatus) {
  if (s === 'upcoming') return 'Upcoming'
  if (s === 'ongoing') return 'Ongoing'
  if (s === 'done') return 'Done'
  return 'Completed'
}

function dateOf(e: Event): string {
  return (e.event_date || '').slice(0, 10)
}

const calendarDays = computed(() => {
  const year = calendarYear.value
  const month = calendarMonth.value
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toISOString().split('T')[0]

  const days: { day: number; date: string; isToday: boolean; eventCount: number }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({
      day: d,
      date,
      isToday: date === today,
      eventCount: filteredEvents.value.filter(e => dateOf(e) === date).length,
    })
  }
  return { firstDay, days }
})

const selectedDateEvents = computed(() => {
  if (!selectedDate.value) return []
  return filteredEvents.value.filter(e => dateOf(e) === selectedDate.value)
})

function prevMonth() {
  if (calendarMonth.value === 0) { calendarMonth.value = 11; calendarYear.value-- }
  else calendarMonth.value--
}
function nextMonth() {
  if (calendarMonth.value === 11) { calendarMonth.value = 0; calendarYear.value++ }
  else calendarMonth.value++
}

function selectDate(date: string) {
  selectedDate.value = date
}

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-bold text-gray-900">{{ orgName }}</h2>
        <span class="text-xs font-medium px-2 py-0.5 rounded-full" :class="labelColor">{{ typeLabel }}</span>
      </div>
      <button
        @click="doLoad()"
        class="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-primary-600"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Refresh
      </button>
    </div>

    <div class="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
      <button
        @click="viewMode = 'list'"
        class="flex-1 rounded-lg py-2 text-sm font-medium transition-colors"
        :class="viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'"
      >List</button>
      <button
        @click="viewMode = 'calendar'"
        class="flex-1 rounded-lg py-2 text-sm font-medium transition-colors"
        :class="viewMode === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'"
      >Calendar</button>
    </div>

    <div v-if="viewMode === 'list'" class="space-y-1.5">
      <label class="text-sm font-semibold text-gray-700">Status</label>
      <select
        v-model="filterView"
        class="w-full rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#20673A]"
      >
        <option value="">All</option>
        <option value="upcoming">Upcoming</option>
        <option value="ongoing">Ongoing</option>
        <option value="done">Done</option>
        <option value="completed">Completed</option>
      </select>
    </div>

    <div v-if="!loading && !offline && viewMode === 'calendar'" class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
      <div class="flex items-center justify-between">
        <button @click="prevMonth" class="p-2 hover:bg-gray-100 rounded-lg">
          <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <p class="text-sm font-semibold text-gray-900">{{ months[calendarMonth] }} {{ calendarYear }}</p>
        <button @click="nextMonth" class="p-2 hover:bg-gray-100 rounded-lg">
          <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>

      <div class="grid grid-cols-7 text-center text-xs font-semibold text-gray-400">
        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
      </div>

      <div class="grid grid-cols-7 text-center gap-y-1">
        <div v-for="i in calendarDays.firstDay" :key="'e' + i" />
        <button
          v-for="d in calendarDays.days"
          :key="d.date"
          @click="selectDate(d.date)"
          class="relative py-1.5 rounded-lg text-sm transition-colors"
          :class="[
            selectedDate === d.date ? 'bg-primary-600 text-white' : d.eventCount ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100 text-gray-700',
            d.isToday && selectedDate !== d.date ? 'font-bold ring-1 ring-primary-300' : '',
          ]"
        >
          {{ d.day }}
          <span
            v-if="d.eventCount"
            class="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 text-[10px] font-bold leading-none rounded-full py-0.5"
            :class="selectedDate === d.date ? 'bg-white/25 text-white' : 'bg-primary-600 text-white'"
          >{{ d.eventCount }}</span>
        </button>
      </div>

      <div v-if="selectedDateEvents.length" class="border-t pt-3 space-y-2">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {{ fmtDate(selectedDate!) }} · {{ selectedDateEvents.length }} event{{ selectedDateEvents.length !== 1 ? 's' : '' }}
        </p>
        <div
          v-for="evt in selectedDateEvents"
          :key="evt.id"
          @click="router.push({ name: 'events-show', params: { type: orgType, eventId: evt.id } })"
          class="rounded-lg bg-white p-4 shadow-sm border cursor-pointer hover:border-primary-300 transition-colors"
        >
          <div class="flex items-center justify-between mb-1">
            <p class="font-medium text-gray-900">{{ evt.title }}</p>
            <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="stateBadge(getEventState(evt))">
              {{ stateLabel(getEventState(evt)) }}
            </span>
          </div>
          <p class="text-xs text-gray-400">
            {{ fmtDate(evt.event_date) }} · {{ evt.venue || '—' }}
            <span v-if="evt.time_from"> · {{ formatTime(evt.time_from) }} – {{ formatTime(evt.time_to) }}</span>
          </p>
          <div v-if="requiredLabel(evt)" class="mt-2 flex flex-wrap items-center gap-1.5">
            <span class="text-xs text-gray-500">{{ requiredLabel(evt) }}</span>
            <span
              v-if="isRequired(evt)"
              class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"
            >You're required</span>
          </div>
        </div>
      </div>
      <div v-else-if="selectedDate" class="border-t pt-3 text-center text-sm text-gray-400">
        No events on this day
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
    </div>

    <div v-else-if="offline && !filteredEvents.length" class="text-center py-16">
      <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 8v4m0 4h.01"/>
        </svg>
      </div>
      <p class="text-sm font-medium text-gray-500 mb-1">No internet connection</p>
      <p class="text-xs text-gray-400 mb-4">Connect online and refresh to see events</p>
      <button @click="doLoad" class="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Refresh
      </button>
    </div>

    <template v-else-if="viewMode === 'list'">
      <div v-if="!filteredEvents.length" class="text-center py-8 text-gray-400">
        No events found.
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="evt in filteredEvents"
          :key="evt.id"
          @click="router.push({ name: 'events-show', params: { type: orgType, eventId: evt.id } })"
          class="rounded-lg bg-white p-4 shadow-sm border cursor-pointer hover:border-primary-300 transition-colors"
        >
          <div class="flex items-center justify-between mb-1">
            <p class="font-medium text-gray-900">{{ evt.title }}</p>
            <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="stateBadge(getEventState(evt))">
              {{ stateLabel(getEventState(evt)) }}
            </span>
          </div>
          <p class="text-xs text-gray-400">
            {{ fmtDate(evt.event_date) }} · {{ evt.venue || '—' }}
            <span v-if="evt.time_from"> · {{ formatTime(evt.time_from) }} – {{ formatTime(evt.time_to) }}</span>
          </p>
          <div v-if="requiredLabel(evt)" class="mt-2 flex flex-wrap items-center gap-1.5">
            <span class="text-xs text-gray-500">{{ requiredLabel(evt) }}</span>
            <span
              v-if="isRequired(evt)"
              class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"
            >You're required</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
