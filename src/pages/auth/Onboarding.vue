<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useSecurityStore } from '@/stores/securityStore'

const router = useRouter()
const authStore = useAuthStore()
const securityStore = useSecurityStore()

const institute = ref('')
const program = ref('')
const error = ref('')
const loading = ref(true)
const submitting = ref(false)

const institutes = computed(() => Object.entries(authStore.onboardingData?.institutes || {}))
const programs = computed(() => authStore.onboardingData?.programs?.[institute.value] || [])

onMounted(async () => {
  try {
    await authStore.fetchOnboarding()
  } catch (e: unknown) {
    const axiosError = e as { response?: { data?: { message?: string } } }
    error.value = axiosError.response?.data?.message || 'Failed to load onboarding options.'
  } finally {
    loading.value = false
  }
})

function onInstituteChange() {
  program.value = ''
}

async function submit() {
  error.value = ''
  submitting.value = true
  try {
    await authStore.completeOnboarding({ institute: institute.value, program: program.value })
    // Route through the security gate so the first required step runs first
    // (face enrollment, then device binding).
    const userId = authStore.user?.id ?? 0
    const info = await securityStore.resolve(userId, { force: true })
    console.log('[Onboarding] gate after onboarding:', info.decision, info)
    if (info.decision === 'proceed') {
      router.push({ name: 'dashboard' })
    } else if (info.decision === 'enroll-face') {
      router.push({ name: 'security-face-enroll' })
    } else {
      router.push({ name: 'security-setup' })
    }
  } catch (e: unknown) {
    const axiosError = e as {
      response?: { data?: { message?: string; errors?: Record<string, string[]> } }
    }
    const firstError = Object.values(axiosError.response?.data?.errors || {})[0]?.[0]
    error.value = firstError || axiosError.response?.data?.message || 'Failed to save your information.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <h2 class="text-4xl font-bold text-[#20673A] sm:text-5xl">Almost there!</h2>

    <div class="mt-3 mb-6 h-1 w-20 rounded-full bg-[#FFA808]"></div>

    <p class="mb-6 text-gray-500 sm:mb-10">
      Confirm your institute and program to finish setting up your account.
    </p>

    <form @submit.prevent="submit" class="flex flex-col gap-5 sm:gap-6">
      <div
        v-if="error"
        class="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-left text-sm text-red-600"
      >
        {{ error }}
      </div>

      <div v-if="loading" class="py-8 text-center text-sm text-gray-400">Loading options...</div>

      <template v-else>
        <div class="grid gap-2">
          <label for="institute" class="text-sm font-semibold text-gray-700">Institute</label>
          <select
            id="institute"
            v-model="institute"
            required
            @change="onInstituteChange"
            class="w-full rounded-xl border border-gray-300 px-5 py-4 text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#20673A]"
          >
            <option value="" disabled>Select your institute</option>
            <option v-for="[code, name] in institutes" :key="code" :value="code">
              {{ name }}
            </option>
          </select>
        </div>

        <div class="grid gap-2">
          <label for="program" class="text-sm font-semibold text-gray-700">Program</label>
          <select
            id="program"
            v-model="program"
            required
            :disabled="!institute"
            class="w-full rounded-xl border border-gray-300 px-5 py-4 text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#20673A] disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="" disabled>{{ institute ? 'Select your program' : 'Select institute first' }}</option>
            <option v-for="code in programs" :key="code" :value="code">
              {{ code }}
            </option>
          </select>
        </div>
      </template>

      <button
        type="submit"
        :disabled="submitting || loading"
        class="w-full rounded-xl bg-[#20673A] py-4 font-semibold text-white transition duration-300 hover:bg-[#027F3B] disabled:opacity-50"
      >
        {{ submitting ? 'Saving...' : 'Finish' }}
      </button>
    </form>
  </div>
</template>
