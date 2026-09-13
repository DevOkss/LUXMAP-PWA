import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api'
import type { Notification } from '@/types'

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([])
  const loading = ref(false)
  const unreadCount = ref(0)

  function recomputeUnread() {
    unreadCount.value = notifications.value.filter((n) => !n.read_at).length
  }

  async function fetchNotifications() {
    loading.value = true
    try {
      const response = await api.get('/notifications')
      const payload = response.data as Record<string, unknown>
      let list: Notification[] = []
      const maybeNotifications = payload.notifications as unknown
      const maybeData = (payload as Record<string, unknown>).data as unknown
      if (Array.isArray(maybeNotifications)) {
        list = maybeNotifications as Notification[]
      } else if (
        maybeNotifications &&
        typeof maybeNotifications === 'object' &&
        'data' in (maybeNotifications as Record<string, unknown>) &&
        Array.isArray((maybeNotifications as Record<string, unknown>).data)
      ) {
        list = (maybeNotifications as Record<string, unknown>).data as Notification[]
      } else if (Array.isArray(maybeData)) {
        list = maybeData as Notification[]
      } else if (
        maybeData &&
        typeof maybeData === 'object' &&
        'data' in (maybeData as Record<string, unknown>) &&
        Array.isArray((maybeData as Record<string, unknown>).data)
      ) {
        list = (maybeData as Record<string, unknown>).data as Notification[]
      }
      notifications.value = list
      unreadCount.value =
        typeof payload.unread_count === 'number'
          ? (payload.unread_count as number)
          : notifications.value.filter((n) => !n.read_at).length
    } finally {
      loading.value = false
    }
  }

  async function markRead(id: string) {
    await api.post(`/notifications/${id}/read`)
    const notification = notifications.value.find((n) => n.id === id)
    if (notification) {
      notification.read_at = new Date().toISOString()
    }
    recomputeUnread()
  }

  async function markAllRead() {
    await api.post('/notifications/read-all')
    notifications.value.forEach((n) => {
      n.read_at = new Date().toISOString()
    })
    recomputeUnread()
  }

  async function deleteNotification(id: string) {
    await api.delete(`/notifications/${id}`)
    notifications.value = notifications.value.filter((n) => n.id !== id)
    recomputeUnread()
  }

  async function clearAll() {
    await api.delete('/notifications')
    notifications.value = []
    unreadCount.value = 0
  }

  return {
    notifications,
    loading,
    unreadCount,
    fetchNotifications,
    markRead,
    markAllRead,
    deleteNotification,
    clearAll,
  }
})
