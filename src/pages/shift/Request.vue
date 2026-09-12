<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { createShiftRequest, fetchMyShiftRequests, type ShiftRequest } from '@/services/shift'

const router = useRouter()
const authStore = useAuthStore()

const institute = ref('')
const program = ref('')
const reason = ref('')
const error = ref('')
const success = ref('')
const submitting = ref(false)
const loading = ref(true)
const history = ref<ShiftRequest[]>([])

const institutes = computed(() => Object.entries(authStore.onboardingData?.institutes || {}))
const programs = computed(() => authStore.onboardingData?.programs?.[institute.value] || [])

const hasPending = computed(() => history.value.some((r) => r.status === 'pending'))

onMounted(async () => {
  try {
    await authStore.fetchOnboarding()
  } catch {}
  try {
    history.value = await fetchMyShiftRequests()
  } catch {
    history.value = []
  } finally {
    loading.value = false
  }
})

function onInstituteChange() {
  program.value = ''
}

async function submit() {
  error.value = ''
  success.value = ''
  if (hasPending.value) {
    error.value = 'You already have a pending shift request. Please wait for review.'
    return
  }
  if (!institute.value || !program.value) {
    error.value = 'Please select institute and program.'
    return
  }
  submitting.value = true
  try {
    await createShiftRequest({
      requested_institute: institute.value,
      requested_program: program.value,
      reason: reason.value || null,
    })
    success.value = 'Shift request submitted. Superadmin will review it.'
    institute.value = ''
    program.value = ''
    reason.value = ''
    history.value = await fetchMyShiftRequests()
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
    const first = Object.values(ax.response?.data?.errors || {})[0]?.[0]
    error.value = first || ax.response?.data?.message || 'Failed to submit request.'
  } finally {
    submitting.value = false
  }
}

function statusColor(s: ShiftRequest['status']) {
  if (s === 'approved') return 'bg-emerald-100 text-emerald-700'
  if (s === 'rejected') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-3xl bg-white p-5 shadow-sm">
      <h2 class="text-lg font-bold text-gray-900">Request Shift</h2>
      <p class="mt-1 text-sm text-gray-500">
        Request to move to a different institute or program. Superadmin will review and approve.
        Your current: <span class="font-semibold">{{ authStore.user?.institute || '—' }} / {{ authStore.user?.program || '—' }}</span>
      </p>
    </div>

    <div v-if="loading" class="rounded-2xl bg-white p-8 text-center text-sm text-gray-400">Loading...</div>

    <template v-else>
      <div class="rounded-3xl bg-white p-5 shadow-sm">
        <h3 class="text-sm font-bold text-gray-900">New Request</h3>
        <div v-if="error" class="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{{ error }}</div>
        <div v-if="success" class="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{{ success }}</div>
        <div v-if="hasPending" class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          You have a pending request. You cannot submit another until it is reviewed.
        </div>

        <form @submit.prevent="submit" class="mt-4 space-y-4">
          <div class="grid gap-2">
            <label class="text-sm font-semibold text-gray-700">Requested Institute</label>
            <select
              v-model="institute"
              :disabled="hasPending"
              required
              @change="onInstituteChange"
              class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-600 disabled:bg-gray-100"
            >
              <option value="" disabled>Select institute</option>
              <option v-for="[code, name] in institutes" :key="code" :value="code">{{ name }} ({{ code }})</option>
            </select>
          </div>

          <div class="grid gap-2">
            <label class="text-sm font-semibold text-gray-700">Requested Program</label>
            <select
              v-model="program"
              :disabled="!institute || hasPending"
              required
              class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-600 disabled:bg-gray-100"
            >
              <option value="" disabled>{{ institute ? 'Select program' : 'Select institute first' }}</option>
              <option v-for="code in programs" :key="code" :value="code">{{ code }}</option>
            </select>
          </div>

          <div class="grid gap-2">
            <label class="text-sm font-semibold text-gray-700">Reason (optional)</label>
            <textarea
              v-model="reason"
              :disabled="hasPending"
              rows="3"
              placeholder="Why do you want to shift?"
              class="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary-600 disabled:bg-gray-100"
            ></textarea>
          </div>

          <button
            type="submit"
            :disabled="submitting || hasPending"
            class="w-full rounded-xl bg-primary-700 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {{ submitting ? 'Submitting...' : 'Submit Request' }}
          </button>

          <button type="button" @click="router.push({ name: 'profile' })" class="w-full rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-600">
            Back to Profile
          </button>
        </form>
      </div>

      <div class="rounded-3xl bg-white p-5 shadow-sm">
        <h3 class="text-sm font-bold text-gray-900">My Requests ({{ history.length }})</h3>
        <div v-if="history.length === 0" class="mt-3 py-6 text-center text-sm text-gray-400">No shift requests yet.</div>
        <div v-else class="mt-3 space-y-3">
          <div v-for="r in history" :key="r.id" class="rounded-2xl border p-4">
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold">{{ r.requested.institute }} / {{ r.requested.program }}</span>
              <span class="rounded-full px-2 py-1 text-xs font-medium" :class="statusColor(r.status)">{{ r.status }}</span>
            </div>
            <p class="mt-1 text-xs text-gray-500">From {{ r.current.institute }} / {{ r.current.program }}</p>
            <p v-if="r.reason" class="mt-2 text-sm text-gray-700">Reason: {{ r.reason }}</p>
            <p v-if="r.remarks" class="mt-1 text-xs text-gray-500">Remarks: {{ r.remarks }}</p>
            <p class="mt-1 text-xs text-gray-400">{{ new Date(r.created_at).toLocaleString() }}</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
