<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/services/api'
import { getEventStatus } from '@/utils/eventTime'
import { useNow } from '@/composables/useNow'
import type { Event, QrConfiguration, Attendance } from '@/types'

const { now } = useNow()

const route = useRoute()
const eventId = route.params.eventId as string

const event = ref<Event | null>(null)
const qrConfigs = ref<QrConfiguration[]>([])
const attendedIds = ref<Set<number>>(new Set())
const loading = ref(true)

onMounted(async () => {
  try {
    const [eventRes, qrRes, attRes] = await Promise.all([
      api.get(`/events/${eventId}`),
      api.get(`/events/${eventId}/qr-configurations`),
      api.get('/attendance/history'),
    ])
    event.value = eventRes.data.data || eventRes.data
    const configs = qrRes.data.data || qrRes.data || []
    qrConfigs.value = Array.isArray(configs) ? configs : []

    const attendances: Attendance[] = attRes.data.data || attRes.data || []
    attendedIds.value = new Set(attendances.map((a: Attendance) => a.qr_configuration_id))
  } finally {
    loading.value = false
  }
})

function isAttended(configId: number): boolean {
  return attendedIds.value.has(configId)
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

function formatTimeRange(config: QrConfiguration): string {
  return `${formatTime(config.valid_from)} – ${formatTime(config.valid_until)}`
}

function eventStateBadge(evt: Event) {
  const status = getEventStatus(evt, now.value)
  if (status === 'completed') return 'bg-purple-100 text-purple-700'
  if (status === 'done') return 'bg-amber-100 text-amber-700'
  if (status === 'ongoing') return 'bg-green-100 text-green-700'
  return 'bg-blue-100 text-blue-700'
}

function eventStateLabel(evt: Event) {
  const status = getEventStatus(evt, now.value)
  if (status === 'completed') return 'Completed'
  if (status === 'done') return 'Done'
  if (status === 'ongoing') return 'Ongoing'
  return 'Upcoming'
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="flex justify-center py-12">
      <div class="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
    </div>

    <div v-else-if="event" class="space-y-4">
      <div class="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-gray-900">{{ event.title }}</h2>
          <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="eventStateBadge(event)">
            {{ eventStateLabel(event) }}
          </span>
        </div>

        <p v-if="event.description" class="text-sm text-gray-600">{{ event.description }}</p>

        <div class="flex gap-2">
          <span class="text-sm font-medium text-gray-500">{{ fmtDate(event.event_date) }}</span>
          <span class="text-sm text-gray-500">{{ formatTime(event.time_from) }} – {{ formatTime(event.time_to) }}</span>
        </div>

        <div v-if="event.venue" class="flex items-center gap-2 text-sm text-gray-500">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          {{ event.venue }}
        </div>
      </div>

      <div v-if="qrConfigs.length" class="bg-white rounded-2xl p-5 shadow-sm space-y-3">
        <h3 class="font-semibold text-gray-900">QR Attendance</h3>
        <div
          v-for="cfg in qrConfigs"
          :key="cfg.id"
          class="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full flex items-center justify-center"
              :class="cfg.type === 'time_in' ? 'bg-blue-100' : 'bg-purple-100'"
            >
              <svg v-if="cfg.type === 'time_in'" class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              <svg v-else class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-gray-900">{{ cfg.type === 'time_in' ? 'Time In' : 'Time Out' }}</p>
              <p class="text-xs text-gray-500">{{ formatTimeRange(cfg) }}</p>
            </div>
          </div>
          <span class="text-xs font-medium px-2 py-0.5 rounded-full"
            :class="isAttended(cfg.id) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
          >
            {{ isAttended(cfg.id) ? 'Attended' : 'Not Attended' }}
          </span>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-8 text-gray-400">Event not found.</div>
  </div>
</template>
