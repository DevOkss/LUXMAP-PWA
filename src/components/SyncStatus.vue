<script setup lang="ts">
import { onMounted } from 'vue'
import { useSyncStore } from '@/stores/syncStore'

const syncStore = useSyncStore()

onMounted(() => {
  syncStore.refreshQueueCount()
})
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      v-if="syncStore.queueCount > 0"
      @click="syncStore.triggerSync()"
      :disabled="syncStore.isSyncing"
      class="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full font-medium disabled:opacity-50"
    >
      {{ syncStore.isSyncing ? 'Syncing...' : `${syncStore.queueCount} pending` }}
    </button>
  </div>
</template>
