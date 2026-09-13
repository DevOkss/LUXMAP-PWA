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
      notifications.value = response.data.data || response.data.notifications || []
      unreadCount.value =
        typeof response.data.unread_count === 'number'
          ? response.data.unread_count
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
