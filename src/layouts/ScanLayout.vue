<template>
  <div class="relative min-h-dvh bg-white">
    <button
      @click="$router.back()"
      class="absolute top-6 left-4 z-10 flex items-center gap-1 rounded-full bg-black/5 px-3 py-1.5 text-xs font-medium text-gray-600 backdrop-blur"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
      </svg>
      Close
    </button>
    <RouterView />
  </div>
</template>
