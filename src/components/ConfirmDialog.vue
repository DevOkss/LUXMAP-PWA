<script setup lang="ts">
const props = defineProps<{
  open: boolean
  title?: string
  message?: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[200] flex items-center justify-center">
      <div class="absolute inset-0 bg-black/40" @click="emit('cancel')"></div>
      <div class="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 class="text-lg font-semibold text-gray-900">{{ title || 'Confirm' }}</h3>
        <p class="mt-2 text-sm text-gray-500">{{ message || 'Are you sure?' }}</p>
        <div class="mt-5 flex gap-3">
          <button
            @click="emit('cancel')"
            class="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >Cancel</button>
          <button
            @click="emit('confirm')"
            class="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600"
          >Delete</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
