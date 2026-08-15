import { defineStore } from 'pinia'
import { ref } from 'vue'
import { syncManager } from '@/services/sync'
import { db } from '@/services/db'

export const useSyncStore = defineStore('sync', () => {
  const isSyncing = ref(false)
  const queueCount = ref(0)
  const lastSync = ref<string | null>(null)

  async function refreshQueueCount() {
    queueCount.value = await db.getQueueCount()
  }

  async function triggerSync() {
    isSyncing.value = true
    try {
      const result = await syncManager.sync()
      lastSync.value = new Date().toISOString()
      await refreshQueueCount()
      return result
    } finally {
      isSyncing.value = false
    }
  }

  return {
    isSyncing,
    queueCount,
    lastSync,
    refreshQueueCount,
    triggerSync,
  }
})
