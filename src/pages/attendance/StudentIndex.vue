<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'
import { useSyncStore } from '@/stores/syncStore'
import { db } from '@/services/db'
import type { OrgAttendanceStats } from '@/types'

const router = useRouter()
const syncStore = useSyncStore()
const orgData = ref<Record<number, OrgAttendanceStats>>({})
const offline = ref(false)
const pendingCount = ref(0)

const cards = [
  { type: 'ssc', label: 'SSC', color: 'from-primary-700 to-primary-900', badge: 'bg-primary-50 text-primary-700' },
  { type: 'isc', label: 'ISC', color: 'from-blue-700 to-blue-900', badge: 'bg-blue-50 text-blue-700' },
  { type: 'sro', label: 'SRO', color: 'from-amber-600 to-amber-800', badge: 'bg-amber-50 text-amber-700' },
]

onMounted(async () => {
  loadStats()
  pendingCount.value = await db.getQueueCount().catch(() => 0)
})

async function loadStats() {
  offline.value = false
  try {
    const res = await api.get('/attendance/student-stats')
    const list: OrgAttendanceStats[] = res.data.organizations || res.data || []
    orgData.value = {}
    for (const org of list) {
      orgData.value[org.id] = org
    }
    await syncStore.refreshQueueCount()
    pendingCount.value = await db.getQueueCount()
  } catch {
    offline.value = true
  }
}

function findCard(type: string): OrgAttendanceStats | undefined {
  return Object.values(orgData.value).find(o => o.type === type)
}

function getOrgId(type: string): number | null {
  const org = findCard(type)
  return org ? org.id : null
}

function getOrgName(type: string): string {
  const org = findCard(type)
  return org
    ? org.name
    : type === 'ssc'
      ? 'Supreme Student Council'
      : type === 'isc'
        ? 'Institute Student Council'
        : 'Student Organization'
}

function goToOrg(type: string) {
  const id = getOrgId(type)
  if (id) router.push({ name: 'attendance-org', params: { orgId: id }, query: { type } })
}

function goToSyncQueue() {
  router.push({ name: 'attendance-queue' })
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-gray-900">Attendance</h2>
      <button
        @click="goToSyncQueue"
        class="relative flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm hover:text-primary-700 hover:border-primary-300 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Sync
        <span
          v-if="pendingCount > 0"
          class="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
        >{{ pendingCount }}</span>
      </button>
    </div>

    <button
      v-if="offline"
      @click="loadStats"
      class="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-gray-400 hover:text-primary-600 py-2"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      Refresh
    </button>

    <div class="space-y-3">
      <button
        v-for="card in cards"
        :key="card.type"
        @click="goToOrg(card.type)"
        class="w-full bg-white rounded-2xl shadow-sm border overflow-hidden cursor-pointer hover:shadow-md transition-shadow text-left"
      >
        <div class="flex items-center">
          <div class="w-16 h-16 flex items-center justify-center shrink-0 bg-gradient-to-br" :class="card.color">
            <span class="text-white text-xl font-extrabold">{{ card.label }}</span>
          </div>
          <div class="px-4 py-3 flex items-center justify-between flex-1">
            <div>
              <p class="font-semibold text-gray-900 text-[15px]">{{ getOrgName(card.type) }}</p>
              <span class="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full" :class="card.badge">{{ card.label }}</span>
            </div>
            <svg class="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>
