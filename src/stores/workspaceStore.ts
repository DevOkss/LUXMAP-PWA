import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './authStore'

export const useWorkspaceStore = defineStore('workspace', () => {
  const sidebarOpen = ref(false)

  const authStore = useAuthStore()

  const currentWorkspace = computed(() => authStore.currentWorkspace)
  const workspaces = computed(() => authStore.workspaces)

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  return {
    sidebarOpen,
    currentWorkspace,
    workspaces,
    toggleSidebar,
  }
})
