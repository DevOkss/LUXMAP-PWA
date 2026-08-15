import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api'
import { db } from '@/services/db'
import type { Attendance } from '@/types'

export const useAttendanceStore = defineStore('attendance', () => {
  const history = ref<Attendance[]>([])
  const queueCount = ref(0)
  const loading = ref(false)

  async function fetchHistory() {
    loading.value = true
    try {
      const response = await api.get('/attendance/history')
      history.value = response.data.data || response.data.attendances || []
    } finally {
      loading.value = false
    }
  }

  async function scanOnline(data: { qr_configuration_id: number; scanned_at: string }) {
    const response = await api.post('/attendance/scan', data)
    return response.data
  }

  async function scanOffline(data: { qr_configuration_id: number; user_id: number; scanned_at: string; qr_payload: Record<string, unknown> | null }): Promise<number> {
    const id = await db.queueAttendance(data)
    await refreshQueueCount()
    return id
  }

  async function refreshQueueCount() {
    queueCount.value = await db.getQueueCount()
  }

  return {
    history,
    queueCount,
    loading,
    fetchHistory,
    scanOnline,
    scanOffline,
    refreshQueueCount,
  }
})
