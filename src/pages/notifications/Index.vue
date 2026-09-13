<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useNotificationStore } from '@/stores/notificationStore'

const notificationStore = useNotificationStore()

const PAGE_SIZE = 10
const visibleCount = ref(PAGE_SIZE)

onMounted(() => {
  notificationStore.fetchNotifications()
})

const visibleNotifications = computed(() =>
  notificationStore.notifications.slice(0, visibleCount.value),
)

const hasMore = computed(() => visibleCount.value < notificationStore.notifications.length)

function showMore() {
  visibleCount.value += PAGE_SIZE
}

function notificationTitle(notification: { data: Record<string, unknown>; type: string }): string {
  const title = notification.data?.title
  if (typeof title === 'string' && title.trim()) return title
  return 'Notification'
}

function notificationBody(notification: { data: Record<string, unknown> }): string {
  const body = notification.data?.body
  if (typeof body === 'string' && body.trim()) return body
  const message = notification.data?.message
  return typeof message === 'string' ? message : ''
}

async function confirmDelete(id: string, event: Event) {
  event.stopPropagation()
  if (!confirm('Delete this notification?')) return
  await notificationStore.deleteNotification(id)
}

async function confirmClearAll() {
  if (!confirm('Delete all notifications? This cannot be undone.')) return
  await notificationStore.clearAll()
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-gray-900">Notifications</h2>
      <div class="flex items-center gap-3">
        <button
          v-if="notificationStore.unreadCount > 0"
          @click="notificationStore.markAllRead()"
          class="text-sm text-primary-600 font-medium"
        >
          Mark All Read
        </button>
        <button
          v-if="notificationStore.notifications.length > 0"
          @click="confirmClearAll"
          class="text-sm text-red-600 font-medium"
        >
          Delete All
        </button>
      </div>
    </div>

    <div v-if="notificationStore.loading" class="text-center py-12">
      <p class="text-gray-500">Loading...</p>
    </div>

    <div v-else-if="notificationStore.notifications.length === 0" class="text-center py-12">
      <p class="text-gray-500">No notifications</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="notification in visibleNotifications"
        :key="notification.id"
        @click="notificationStore.markRead(notification.id)"
        class="bg-white border rounded-xl p-4 cursor-pointer transition-colors"
        :class="notification.read_at ? 'border-gray-200' : 'border-primary-200 bg-primary-50/50'"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium" :class="notification.read_at ? 'text-gray-900' : 'text-primary-900'">
              {{ notificationTitle(notification) }}
            </p>
            <p v-if="notificationBody(notification)" class="text-xs text-gray-500 mt-0.5">
              {{ notificationBody(notification) }}
            </p>
            <p class="text-xs text-gray-400 mt-1">{{ new Date(notification.created_at).toLocaleString() }}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              @click="confirmDelete(notification.id, $event)"
              class="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50"
            >
              Delete
            </button>
            <div v-if="!notification.read_at" class="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0"></div>
          </div>
        </div>
      </div>

      <button
        v-if="hasMore"
        @click="showMore"
        class="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-primary-600 hover:bg-gray-50"
      >
        Show more
      </button>
    </div>
  </div>
</template>
