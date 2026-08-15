<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/services/api'
import { db } from '@/services/db'
import type { EventAttendanceSummary } from '@/types'

const route = useRoute()
const orgId = Number(route.params.orgId)

const orgName = ref('')
const orgType = ref((route.query.type as string) || '')
const summaries = ref<EventAttendanceSummary[]>([])
const loading = ref(true)
const offline = ref(false)
const expandedId = ref<string | null>(null)
const pendingIds = ref<number[]>([])

const orgLabel = computed(() => (orgType.value ? orgType.value.toUpperCase() : 'ORG'))
const labelColor = computed(() =>
  orgType.value === 'ssc' ? 'bg-primary-50 text-primary-700'
  : orgType.value === 'isc' ? 'bg-blue-50 text-blue-700'
  : 'bg-amber-50 text-amber-700',
)
const gradient = computed(() =>
  orgType.value === 'ssc' ? 'from-primary-700 to-primary-900'
  : orgType.value === 'isc' ? 'from-blue-700 to-blue-900'
  : 'from-amber-600 to-amber-800',
)

onMounted(async () => { await load() })

async function load() {
  loading.value = true
  offline.value = false
  try {
    const res = await api.get('/attendance/events', { params: { organization_id: orgId } })
    orgName.value = res.data.organization?.name || ''
    if (!orgType.value && res.data.organization?.type) {
      orgType.value = res.data.organization.type
    }
    summaries.value = res.data.data || []
    const queue = await db.getQueuedAttendance()
    pendingIds.value = queue.filter(r => !r.synced).map(r => r.qr_configuration_id)
  } catch {
    offline.value = true
  } finally {
    loading.value = false
  }
}

function toggle(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function isPending(configId: number): boolean {
  return pendingIds.value.includes(configId)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatTime12(t: string) {
  const d = new Date(t)
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3 bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div class="w-14 h-14 flex items-center justify-center shrink-0 bg-gradient-to-br" :class="gradient">
        <span class="text-white text-lg font-extrabold">{{ orgLabel }}</span>
      </div>
      <div class="py-3 pr-4 min-w-0 flex-1">
        <p class="font-semibold text-gray-900 truncate">{{ orgName || 'Attendance' }}</p>
        <span class="inline-block mt-0.5 text-xs font-medium px-2 py-0.5 rounded-full" :class="labelColor">{{ orgLabel }}</span>
      </div>
    </div>

    <div v-if="offline && !loading" class="text-center py-16">
      <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 8v4m0 4h.01"/>
        </svg>
      </div>
      <p class="text-sm font-medium text-gray-500 mb-1">No internet connection</p>
      <p class="text-xs text-gray-400 mb-4">Connect online and refresh to see your attendance</p>
      <button @click="load" class="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Refresh
      </button>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
    </div>

    <div v-else-if="!summaries.length" class="text-center py-10 text-gray-400">
      No events attended yet.
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="summary in summaries"
        :key="summary.event.id"
        class="bg-white rounded-2xl shadow-sm border overflow-hidden"
      >
        <button
          @click="toggle(summary.event.id)"
          class="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3"
        >
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900 truncate">{{ summary.event.title }}</p>
            <p class="text-xs text-gray-400 mt-0.5">
              {{ fmtDate(summary.event.event_date) }}
              <span v-if="summary.event.venue"> · {{ summary.event.venue }}</span>
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <div class="text-right">
              <p class="text-sm font-bold text-gray-900">
                {{ summary.attended_count }}<span class="text-gray-400 font-medium">/{{ summary.total_qr_configs }}</span>
              </p>
              <span
                v-if="summary.complete"
                class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700"
              >Complete</span>
            </div>
            <svg
              class="w-5 h-5 text-gray-300 shrink-0 transition-transform duration-200"
              :class="expandedId === summary.event.id ? 'rotate-90' : ''"
              fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
        </button>

        <div v-if="expandedId === summary.event.id" class="border-t px-4 py-2">
          <div
            v-for="att in summary.attendances"
            :key="att.id"
            class="flex items-center justify-between py-2"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span
                class="text-xs font-medium px-2 py-0.5 rounded-full"
                :class="att.type === 'time_in' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'"
              >{{ att.type === 'time_in' ? 'Time In' : 'Time Out' }}</span>
              <span class="text-xs text-gray-500">{{ formatTime12(att.scanned_at) }}</span>
            </div>
            <span
              v-if="isPending(att.qr_configuration_id)"
              class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0"
            >Pending</span>
            <span
              v-else-if="att.synced_at"
              class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0"
            >Synced</span>
          </div>
          <div v-if="!summary.attendances.length" class="py-2 text-xs text-gray-400">No attendance records.</div>
        </div>
      </div>
    </div>
  </div>
</template>
