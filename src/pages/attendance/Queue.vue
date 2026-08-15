<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import api from '@/services/api'
import { db, type AttendanceQueueRecord } from '@/services/db'
import { useSyncStore } from '@/stores/syncStore'
import { useToast } from '@/composables/useToast'

const syncStore = useSyncStore()
const toast = useToast()
const records = ref<AttendanceQueueRecord[]>([])
const syncingKey = ref<string | null>(null)

interface AttendanceGroup {
  key: string
  title: string
  date: string | null
  venue: string | null
  records: AttendanceQueueRecord[]
}

onMounted(async () => {
  await load()
})

async function load() {
  records.value = await db.getQueuedAttendance()
}

const groups = computed<AttendanceGroup[]>(() => {
  const map = new Map<string, AttendanceGroup>()
  for (const r of records.value) {
    const p = r.qr_payload || {}
    const eventId = typeof p.event_id === 'number'
      ? p.event_id
      : typeof p.event_id === 'string'
        ? Number(p.event_id) || null
        : null
    const key = eventId ? String(eventId) : `qr-${r.qr_configuration_id}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        title: typeof p.event_title === 'string' ? p.event_title : `QR #${r.qr_configuration_id}`,
        date: typeof p.event_date === 'string' ? p.event_date : null,
        venue: typeof p.venue === 'string' ? p.venue : null,
        records: [],
      })
    }
    map.get(key)!.records.push(r)
  }
  return [...map.values()]
})

const totalPending = computed(() => records.value.length)

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatTime12(t: string) {
  const d = new Date(t)
  if (isNaN(d.getTime())) return t
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function recordType(r: AttendanceQueueRecord): 'time_in' | 'time_out' {
  return r.qr_payload?.type === 'time_out' ? 'time_out' : 'time_in'
}

function recordTimeRange(r: AttendanceQueueRecord): string | null {
  const p = r.qr_payload
  if (!p || typeof p.valid_from !== 'string' || typeof p.valid_until !== 'string') return null
  return `${formatTime12(p.valid_from)} – ${formatTime12(p.valid_until)}`
}

async function handleSyncAll() {
  if (!totalPending.value) return
  await syncStore.triggerSync()
  await load()
  toast.show('All attendance synced', 'success')
}

async function handleSyncGroup(group: AttendanceGroup) {
  const unsynced = group.records
  if (!unsynced.length || syncingKey.value) return
  syncingKey.value = group.key
  try {
    await api.post('/attendance/sync', {
      records: unsynced.map(r => ({
        qr_configuration_id: r.qr_configuration_id,
        user_id: r.user_id,
        scanned_at: r.scanned_at,
      })),
    })
    for (const r of unsynced) {
      await db.deleteQueuedAttendance(r.id!)
    }
    await syncStore.refreshQueueCount()
    await load()
    toast.show(`${unsynced.length} attendance synced`, 'success')
  } catch {
    toast.show('Sync failed', 'error')
  } finally {
    syncingKey.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-gray-900">Sync Queue</h2>
        <p v-if="totalPending" class="text-xs text-gray-500 mt-0.5">
          {{ totalPending }} record{{ totalPending !== 1 ? 's' : '' }} across {{ groups.length }} event{{ groups.length !== 1 ? 's' : '' }}
        </p>
      </div>
      <button
        v-if="totalPending > 0"
        @click="handleSyncAll"
        :disabled="syncStore.isSyncing"
        class="text-sm font-semibold bg-primary-600 text-white px-4 py-2 rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ syncStore.isSyncing ? 'Syncing...' : 'Sync All' }}
      </button>
    </div>

    <div v-if="!totalPending && !syncStore.isSyncing" class="text-center py-16">
      <div class="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <p class="text-sm font-medium text-gray-500">All caught up</p>
      <p class="text-xs text-gray-400 mt-1">No attendance waiting to be synced.</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="group in groups"
        :key="group.key"
        class="bg-white rounded-2xl shadow-sm border overflow-hidden"
      >
        <div class="flex items-center justify-between px-4 py-3.5">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900 truncate">{{ group.title }}</p>
            <p class="text-xs text-gray-400 mt-0.5">
              <template v-if="group.date">{{ formatDate(group.date) }}</template>
              <template v-if="group.venue"><span v-if="group.date"> · </span>{{ group.venue }}</template>
            </p>
          </div>
          <button
            @click="handleSyncGroup(group)"
            :disabled="syncingKey === group.key || syncStore.isSyncing"
            class="shrink-0 ml-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ syncingKey === group.key ? 'Syncing...' : 'Sync' }}
          </button>
        </div>
        <div class="border-t divide-y divide-gray-100">
          <div v-for="r in group.records" :key="r.id" class="flex items-center justify-between px-4 py-2.5">
            <div class="flex items-center gap-2.5 min-w-0">
              <span
                class="text-xs font-medium px-2 py-0.5 rounded-full"
                :class="recordType(r) === 'time_in' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'"
              >{{ recordType(r) === 'time_in' ? 'Time In' : 'Time Out' }}</span>
              <span class="text-xs text-gray-500">{{ formatTime12(r.scanned_at) }}</span>
            </div>
            <span v-if="recordTimeRange(r)" class="text-xs text-gray-400 shrink-0 ml-2">{{ recordTimeRange(r) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
