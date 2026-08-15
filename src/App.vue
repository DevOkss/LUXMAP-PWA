<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import SplashScreen from '@/components/SplashScreen.vue'
import AppToast from '@/components/AppToast.vue'
import InstallPrompt from '@/components/InstallPrompt.vue'
import { useAuthStore } from '@/stores/authStore'
import { useSecurityStore } from '@/stores/securityStore'

const router = useRouter()
const authStore = useAuthStore()
const showSplash = ref(true)

function handleSessionExpired() {
  authStore.forceLogout()
  router.replace({ name: 'login' })
}

onMounted(() => {
  window.setTimeout(() => {
    showSplash.value = false
  }, 2600)

  // Listen for 401s (e.g. the binding was transferred to another device and
  // this device's token was revoked) and route the student back to login.
  window.addEventListener('soms:session-expired', handleSessionExpired)

  // Refresh the security gate from the server on boot so a stale local cache
  // (e.g. the device was unbound elsewhere) can't silently grant access.
  let storedUserId = 0
  try {
    const stored = JSON.parse(localStorage.getItem('user') || 'null')
    storedUserId = Number(stored?.id) || 0
  } catch {
    /* ignore */
  }
  if (storedUserId) {
    const security = useSecurityStore()
    security.resolve(storedUserId, { force: true }).catch(() => {})
  }
})

onUnmounted(() => {
  window.removeEventListener('soms:session-expired', handleSessionExpired)
})
</script>

<template>
  <Transition name="splash-fade">
    <SplashScreen v-if="showSplash" />
  </Transition>

  <RouterView />
  <AppToast />
  <InstallPrompt />
</template>

<style>
.splash-fade-enter-active {
  transition: opacity 0.3s ease;
}

.splash-fade-enter-from {
  opacity: 0;
}

.splash-fade-leave-active {
  transition: opacity 0.4s ease;
}

.splash-fade-leave-to {
  opacity: 0;
}
</style>
