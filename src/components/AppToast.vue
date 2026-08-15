<script setup lang="ts">
import { useToast } from '@/composables/useToast'
const { toasts, remove } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 left-1/2 -translate-x-1/2 z-[3000] flex flex-col gap-2 w-[90vw] max-w-sm">
      <div
        v-for="t in toasts"
        :key="t.id"
        @click="remove(t.id)"
        class="rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg cursor-pointer animate-[slide-down_0.3s_ease-out]"
        :class="t.type === 'success' ? 'bg-primary-700' : 'bg-red-500'"
      >
        {{ t.message }}
      </div>
    </div>
  </Teleport>
</template>
