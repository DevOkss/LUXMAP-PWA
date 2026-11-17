<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const form = ref({
  currentPassword: '',
  password: '',
  passwordConfirmation: '',
})
const error = ref('')
const loading = ref(false)
const showPassword = ref(false)

async function submit() {
  error.value = ''

  if (form.value.password.length < 8) {
    error.value = 'Your new password must be at least 8 characters.'
    return
  }

  if (form.value.password !== form.value.passwordConfirmation) {
    error.value = 'The new password confirmation does not match.'
    return
  }

  if (form.value.password === form.value.currentPassword) {
    error.value = 'Your new password must be different from the temporary password.'
    return
  }

  loading.value = true

  try {
    await authStore.changePassword(
      form.value.currentPassword,
      form.value.password,
      form.value.passwordConfirmation,
    )
    router.push({ name: 'dashboard' })
  } catch (e: unknown) {
    const axiosError = e as {
      response?: { data?: { message?: string; errors?: Record<string, string[]> } }
    }
    const errors = axiosError.response?.data?.errors
    error.value =
      errors?.current_password?.[0] ||
      errors?.password?.[0] ||
      axiosError.response?.data?.message ||
      'Could not change your password.'
  } finally {
    loading.value = false
  }
}

async function signOut() {
  loading.value = true
  await authStore.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div>
    <LoadingOverlay :loading="loading" message="Updating password..." />

    <h2 class="text-4xl font-bold text-[#20673A] sm:text-5xl">Change Password</h2>

    <div class="mb-6 h-1 w-20 rounded-full bg-[#FFA808]"></div>

    <p class="mb-6 text-gray-500 sm:mb-10">
      Your account is using a temporary password. Set a new password before continuing.
    </p>

    <form @submit.prevent="submit" class="flex flex-col gap-5 sm:gap-6">
      <div
        v-if="error"
        class="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-left text-sm text-red-600"
      >
        {{ error }}
      </div>

      <div class="grid gap-2">
        <label for="currentPassword" class="text-sm font-semibold text-gray-700">Temporary password</label>
        <div class="relative">
          <input
            id="currentPassword"
            v-model="form.currentPassword"
            :type="showPassword ? 'text' : 'password'"
            required
            autofocus
            autocomplete="current-password"
            placeholder="Enter your temporary password"
            class="w-full rounded-xl border border-gray-300 py-4 pl-5 pr-12 text-gray-900 placeholder-gray-400 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#20673A]"
          />
          <button
            type="button"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            @click="showPassword = !showPassword"
            class="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-400 transition hover:text-gray-600 focus:outline-none"
          >
            <svg v-if="showPassword" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
            </svg>
            <svg v-else class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
      </div>

      <div class="grid gap-2">
        <label for="password" class="text-sm font-semibold text-gray-700">New password</label>
        <input
          id="password"
          v-model="form.password"
          :type="showPassword ? 'text' : 'password'"
          required
          autocomplete="new-password"
          placeholder="At least 8 characters"
          class="w-full rounded-xl border border-gray-300 px-5 py-4 text-gray-900 placeholder-gray-400 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#20673A]"
        />
      </div>

      <div class="grid gap-2">
        <label for="passwordConfirmation" class="text-sm font-semibold text-gray-700">Confirm new password</label>
        <input
          id="passwordConfirmation"
          v-model="form.passwordConfirmation"
          :type="showPassword ? 'text' : 'password'"
          required
          autocomplete="new-password"
          placeholder="Re-enter your new password"
          class="w-full rounded-xl border border-gray-300 px-5 py-4 text-gray-900 placeholder-gray-400 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#20673A]"
        />
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="w-full rounded-xl bg-[#20673A] py-4 font-semibold text-white transition duration-300 hover:bg-[#027F3B] disabled:opacity-50"
      >
        {{ loading ? 'Updating...' : 'Set New Password' }}
      </button>

      <button
        type="button"
        :disabled="loading"
        @click="signOut"
        class="text-sm font-medium text-gray-500 underline-offset-4 hover:text-gray-700 hover:underline disabled:opacity-50"
      >
        Sign out instead
      </button>
    </form>
  </div>
</template>
