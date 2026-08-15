<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useAttendanceStore } from '@/stores/attendanceStore'

const attendanceStore = useAttendanceStore()

onMounted(() => {
  attendanceStore.fetchHistory()
})

const grouped = computed(() => {
  const groups: Record<string, typeof attendanceStore.history> = {}
  attendanceStore.history.forEach((a) => {
    const date = new Date(a.scanned_at).toLocaleDateString()
    if (!groups[date]) groups[date] = []
    groups[date].push(a)
  })
  return groups
})
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-bold text-gray-900">Attendance History</h2>

    <div v-if="attendanceStore.loading" class="text-center py-12">
      <p class="text-gray-500">Loading...</p>
    </div>

    <div v-else-if="attendanceStore.history.length === 0" class="text-center py-12">
      <p class="text-gray-500">No attendance records yet</p>
    </div>

    <div v-else class="space-y-4">
      <div v-for="(records, date) in grouped" :key="date">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{{ date }}</p>
        <div class="space-y-2">
          <div v-for="record in records" :key="record.id" class="bg-white border border-gray-200 rounded-xl p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-900">{{ record.qr_configuration_id ? `QR #${record.qr_configuration_id}` : 'Attendance' }}</p>
                <p class="text-xs text-gray-500">{{ new Date(record.scanned_at).toLocaleTimeString() }}</p>
              </div>
              <span v-if="!record.synced_at" class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pending Sync</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
