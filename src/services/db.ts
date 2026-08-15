import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'soms_pwa_db'
const DB_VERSION = 2

let dbInstance: IDBPDatabase | null = null

export interface AttendanceQueueRecord {
  id?: number
  qr_configuration_id: number
  user_id: number
  scanned_at: string
  synced: boolean
  qr_payload: Record<string, unknown> | null
}

interface CacheRecord {
  id: number
  [key: string]: unknown
}

interface SyncLog {
  id?: number
  timestamp: string
  status: string
  count: number
}

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (!db.objectStoreNames.contains('attendance_queue')) {
        db.createObjectStore('attendance_queue', {
          keyPath: 'id',
          autoIncrement: true,
        })
      } else if (oldVersion < 2) {
        // Booleans are not valid IndexedDB keys, so this index never worked.
        const store = transaction.objectStore('attendance_queue')
        if (store.indexNames.contains('synced')) {
          store.deleteIndex('synced')
        }
      }

      if (!db.objectStoreNames.contains('events_cache')) {
        const store = db.createObjectStore('events_cache', {
          keyPath: 'id',
        })
        store.createIndex('event_date', 'event_date')
      }

      if (!db.objectStoreNames.contains('fees_cache')) {
        const store = db.createObjectStore('fees_cache', {
          keyPath: 'id',
        })
        store.createIndex('status', 'pivot.status')
      }

      if (!db.objectStoreNames.contains('notifications_cache')) {
        const store = db.createObjectStore('notifications_cache', {
          keyPath: 'id',
        })
        store.createIndex('read_at', 'read_at')
      }

      if (!db.objectStoreNames.contains('sync_log')) {
        db.createObjectStore('sync_log', {
          keyPath: 'id',
          autoIncrement: true,
        })
      }
    },
  })

  return dbInstance
}

export const db = {
  async queueAttendance(record: {
    qr_configuration_id: number
    user_id: number
    scanned_at: string
    qr_payload: Record<string, unknown> | null
  }): Promise<number> {
    const database = await getDB()
    const all = await database.getAll('attendance_queue')
    const alreadyQueued = all.some(
      r => !r.synced && r.qr_configuration_id === record.qr_configuration_id,
    )
    if (alreadyQueued) return 0
    const id = await database.add('attendance_queue', {
      ...record,
      synced: false,
      sync_error: undefined,
    } as AttendanceQueueRecord)
    return id as number
  },

  async getQueuedAttendance(): Promise<AttendanceQueueRecord[]> {
    const database = await getDB()
    const all = await database.getAll('attendance_queue')
    return all.filter(r => !r.synced)
  },

  async deleteQueuedAttendance(id: number): Promise<void> {
    const database = await getDB()
    await database.delete('attendance_queue', id)
  },

  async markSyncError(id: number, error: string): Promise<void> {
    const database = await getDB()
    const tx = database.transaction('attendance_queue', 'readwrite')
    const record = await tx.store.get(id)
    if (record) {
      record.sync_error = error
      await tx.store.put(record)
    }
  },

  async getQueueCount(): Promise<number> {
    const database = await getDB()
    const all = await database.getAll('attendance_queue')
    return all.filter(r => !r.synced).length
  },

  async cacheEvents(events: CacheRecord[]): Promise<void> {
    const database = await getDB()
    const tx = database.transaction('events_cache', 'readwrite')
    for (const event of events) {
      await tx.store.put(event)
    }
  },

  async getCachedEvents(): Promise<CacheRecord[]> {
    const database = await getDB()
    return database.getAll('events_cache')
  },

  async clearCache(): Promise<void> {
    const database = await getDB()
    const stores = ['events_cache', 'fees_cache', 'notifications_cache'] as const
    const tx = database.transaction(stores, 'readwrite')
    for (const name of stores) {
      await tx.objectStore(name).clear()
    }
  },
}
