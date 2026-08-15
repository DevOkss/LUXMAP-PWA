<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import { useAuthStore } from '@/stores/authStore'
import { useSecurityStore } from '@/stores/securityStore'
import { runSecurityGate } from '@/services/securityGate'

const router = useRouter()
const authStore = useAuthStore()
const securityStore = useSecurityStore()

const form = ref({ studentNumber: '', password: '' })
const error = ref('')
const loading = ref(false)
const showPassword = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const data = await authStore.login(form.value.studentNumber, form.value.password)
    // Every fresh login requires a fresh face verification.
    securityStore.resetVerified()
    if (data.user?.needs_onboarding) {
      router.push({ name: 'onboarding' })
      return
    }
    const gate = await runSecurityGate(data.user.id)
    console.log('[Login] gate:', gate.decision, gate)
    switch (gate.decision) {
      case 'proceed':
        router.push({ name: 'dashboard' })
        return
      case 'setup':
        router.push({ name: 'security-setup' })
        return
      case 'enroll-face':
        router.push({ name: 'security-face-enroll' })
        return
      case 'transfer':
        router.push({ name: 'security-transfer' })
        return
      case 'offline-blocked':
        error.value =
          'Set up your device once while online. Connect to the internet and try again.'
        return
    }
  } catch (e: unknown) {
    const axiosError = e as { response?: { data?: { message?: string } } }
    error.value = axiosError.response?.data?.message || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <LoadingOverlay :loading="loading" message="Signing in..." />

    <h2 class="text-4xl font-bold text-[#20673A] sm:text-5xl">Welcome Back!</h2>

    <div class=" mb-6 h-1 w-20 rounded-full bg-[#FFA808]"></div>

    <p class="mb-6 text-gray-500 sm:mb-10">
      Login to your account to continue your journey with us.
    </p>

    <form @submit.prevent="submit" class="flex flex-col gap-5 sm:gap-6">
      <div
        v-if="error"
        class="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-left text-sm text-red-600"
      >
        {{ error }}
      </div>

      <div class="grid gap-2">
        <label for="studentNumber" class="text-sm font-semibold text-gray-700">ID Number</label>
        <input
          id="studentNumber"
          v-model="form.studentNumber"
          type="text"
          required
          autofocus
          autocomplete="username"
          inputmode="numeric"
          placeholder="Enter your ID number"
          class="w-full rounded-xl border border-gray-300 px-5 py-4 text-gray-900 placeholder-gray-400 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#20673A]"
        />
      </div>

      <div class="grid gap-2">
        <label for="password" class="text-sm font-semibold text-gray-700">Password</label>
        <div class="relative">
          <input
            id="password"
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            required
            autocomplete="current-password"
            placeholder="Enter your password"
            class="w-full rounded-xl border border-gray-300 py-4 pl-5 pr-12 text-gray-900 placeholder-gray-400 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#20673A]"
          />
          <button
            type="button"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            @click="showPassword = !showPassword"
            class="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-400 transition hover:text-gray-600 focus:outline-none"
          >
            <svg
              v-if="showPassword"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"
              />
            </svg>
            <svg
              v-else
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </button>
        </div>
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="w-full rounded-xl bg-[#20673A] py-4 font-semibold text-white transition duration-300 hover:bg-[#027F3B] disabled:opacity-50"
      >
        {{ loading ? 'Signing in...' : 'Signin' }}
      </button>
    </form>
  </div>
</template>
