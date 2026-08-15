<script setup lang="ts">
withDefaults(defineProps<{ loading: boolean; message?: string }>(), {
  message: 'Loading...',
})
</script>

<template>
  <div
    v-if="loading"
    class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#20673A] opacity-50"
    aria-live="polite"
    role="status"
  >
    <svg class="h-14 w-14 animate-spin text-white" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <p class="text-lg font-semibold text-white">{{ message }}</p>
  </div>
</template>
