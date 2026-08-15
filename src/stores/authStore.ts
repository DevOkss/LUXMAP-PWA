import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'
import { unsubscribeFromPush } from '@/services/push'
import { useSecurityStore } from '@/stores/securityStore'
import type { OnboardingData, User, Workspace } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(JSON.parse(localStorage.getItem('user') || 'null'))
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const workspaces = ref<Workspace[]>(
    JSON.parse(localStorage.getItem('workspaces') || '[]')
  )
  const currentWorkspace = ref<Workspace | null>(
    JSON.parse(localStorage.getItem('current_workspace') || 'null'),
  )
  const onboardingData = ref<OnboardingData | null>(null)

  const isAuthenticated = computed(() => !!token.value)
  const isOnline = computed(() => navigator.onLine)

  function persistUser(value: User) {
    user.value = value
    localStorage.setItem('user', JSON.stringify(value))
  }

  async function login(studentNumber: string, password: string) {
    const response = await api.post('/login', { student_number: studentNumber, password })

    token.value = response.data.token
    persistUser(response.data.user)
    workspaces.value = response.data.workspaces || []

    localStorage.setItem('auth_token', response.data.token)
    localStorage.setItem('workspaces', JSON.stringify(response.data.workspaces || []))

    if (response.data.workspaces?.length > 0) {
      currentWorkspace.value = response.data.workspaces[0]
      localStorage.setItem('current_workspace', JSON.stringify(response.data.workspaces[0]))
    }

    return response.data
  }

  async function fetchOnboarding() {
    const response = await api.get('/onboarding')
    onboardingData.value = response.data
    return onboardingData.value
  }

  async function completeOnboarding(payload: { institute: string; program: string }) {
    const response = await api.patch('/onboarding', payload)
    persistUser(response.data.user)
    return response.data.user
  }

  async function refreshFromInstitution() {
    const response = await api.post('/me/refresh')
    if (response.data.user) {
      persistUser(response.data.user)
    }
    return response.data
  }

  async function fetchWorkspaces() {
    const response = await api.get('/workspaces')
    workspaces.value = response.data.workspaces || response.data.data || []
    localStorage.setItem('workspaces', JSON.stringify(workspaces.value))

    if (workspaces.value.length > 0) {
      const match = workspaces.value.find(w => w.id === currentWorkspace.value?.id)
      const updated = match || workspaces.value.find(w => w.role !== 'student') || workspaces.value[0]
      currentWorkspace.value = updated
      localStorage.setItem('current_workspace', JSON.stringify(updated))
    }
    return workspaces.value
  }

  async function switchWorkspace(workspace: Workspace) {
    if (workspace.organization_id) {
      await api.put(`/workspace/${workspace.organization_id}`)
    }
    currentWorkspace.value = workspace
    localStorage.setItem('current_workspace', JSON.stringify(workspace))
  }

  async function fetchUser() {
    const response = await api.get('/user')
    persistUser(response.data.user)
    return user.value
  }

  async function logout() {
    const tokenToRevoke = token.value
    token.value = null
    user.value = null
    workspaces.value = []
    currentWorkspace.value = null
    onboardingData.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    localStorage.removeItem('current_workspace')
    localStorage.removeItem('workspaces')

    useSecurityStore().clear()
    unsubscribeFromPush().catch(() => {})
    if (tokenToRevoke) {
      api
        .post('/logout', {}, { headers: { Authorization: `Bearer ${tokenToRevoke}` } })
        .catch(() => {})
    }
  }

  /**
   * Reset the local session without calling the logout API. Used when the
   * server has already invalidated this token (e.g. the binding was moved to
   * another device), so a 401 no longer needs to reach the server.
   */
  function forceLogout() {
    token.value = null
    user.value = null
    workspaces.value = []
    currentWorkspace.value = null
    onboardingData.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    localStorage.removeItem('current_workspace')
    localStorage.removeItem('workspaces')

    useSecurityStore().clear()
    unsubscribeFromPush().catch(() => {})
  }

  return {
    user,
    token,
    workspaces,
    currentWorkspace,
    onboardingData,
    isAuthenticated,
    isOnline,
    login,
    fetchOnboarding,
    completeOnboarding,
    refreshFromInstitution,
    fetchWorkspaces,
    switchWorkspace,
    fetchUser,
    logout,
    forceLogout,
  }
})
