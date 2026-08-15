import { db } from './db'
import api from './api'

class SyncManager {
  private isSyncing = false

  async sync(): Promise<{ synced: number }> {
    if (this.isSyncing || !navigator.onLine) return { synced: 0 }
    this.isSyncing = true
    let synced = 0
    try {
      const queue = await db.getQueuedAttendance()
      if (!queue.length) return { synced: 0 }

      const records = queue.map(r => ({
        qr_configuration_id: r.qr_configuration_id,
        user_id: r.user_id,
        scanned_at: r.scanned_at,
      }))

      await api.post('/attendance/sync', { records })

      for (const r of queue) {
        await db.deleteQueuedAttendance(r.id!)
        synced++
      }
    } finally {
      this.isSyncing = false
    }
    return { synced }
  }
}

export const syncManager = new SyncManager()
