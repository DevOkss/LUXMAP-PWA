<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import type { Workspace } from '@/types'

const router = useRouter()
const authStore = useAuthStore()
const open = ref(false)

function toggle() { open.value = !open.value }

async function switchTo(ws: Workspace) {
  open.value = false
  await authStore.switchWorkspace(ws)
  router.push(ws.role !== 'student' ? { name: 'officer-dashboard' } : { name: 'dashboard' })
}
</script>

<template>
  <div v-if="authStore.workspaces.length > 1" class="relative">
    <button
      @click="toggle"
      class="flex items-center gap-1 rounded-lg border border-white/30 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7"/>
      </svg>
      Switch
    </button>

    <div v-if="open" class="absolute right-0 top-full mt-2 z-50 w-52 rounded-xl bg-white shadow-xl border py-1">
      <div class="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Workspaces</div>
      <button
        v-for="ws in authStore.workspaces"
        :key="ws.id"
        @click="switchTo(ws)"
        class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
        :class="{ 'bg-primary-50 text-primary-700 font-medium': ws.id === authStore.currentWorkspace?.id }"
      >
        <span class="truncate">{{ ws.name }}</span>
        <svg v-if="ws.id === authStore.currentWorkspace?.id" class="w-4 h-4 text-primary-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </button>
    </div>
  </div>
</template>
