<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useFeeStore } from '@/stores/feeStore'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const feeStore = useFeeStore()
const authStore = useAuthStore()

const expanded = ref(false)
const expandedPenalty = ref<number | null>(null)

onMounted(() => {
  if (authStore.user?.id) {
    feeStore.fetchSummary(authStore.user.id).catch(() => {})
  }
})

function fmtCurrency(value: number): string {
  return `₱${(Number(value) || 0).toFixed(2)}`
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })
}

function fmtTime(t: string | null): string {
  if (!t) return '—'
  const [h, m] = t.split(':')
  const hour = Number(h)
  const period = hour >= 12 ? 'PM' : 'AM'
  const hr = hour % 12 === 0 ? 12 : hour % 12
  return `${hr}:${m} ${period}`
}

function qrTypeLabel(type: string | null): string {
  if (type === 'time_in') return 'Time In'
  if (type === 'time_out') return 'Time Out'
  return type || 'QR check-in'
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-xl font-bold text-gray-900">Fees &amp; Penalties</h2>

    <div v-if="feeStore.loading" class="flex justify-center py-16">
      <div class="w-9 h-9 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
    </div>

    <template v-else>
      <!-- Hero summary card -->
      <button
        class="w-full text-left bg-gradient-to-br from-primary-700 to-primary-900 rounded-3xl shadow-md p-5 flex items-center justify-between"
        @click="expanded = !expanded"
      >
        <div class="flex items-center gap-4 min-w-0">
          <span class="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path d="M3 7a2 2 0 012-2h13a1 1 0 011 1v3M3 7v11a2 2 0 002 2h14a2 2 0 002-2v-8a1 1 0 00-1-1h-4a2 2 0 100 4h5"/>
            </svg>
          </span>
          <div class="min-w-0">
            <p class="text-primary-100 text-sm">Total Fees</p>
            <p class="text-white text-2xl font-extrabold leading-tight">{{ fmtCurrency(feeStore.totalCombined) }}</p>
            <p class="text-primary-100 text-xs">
              {{ feeStore.dueFees.length }} fee{{ feeStore.dueFees.length !== 1 ? 's' : '' }} ·
              {{ feeStore.absences }} absence{{ feeStore.absences !== 1 ? 's' : '' }}
            </p>
          </div>
        </div>
        <span class="shrink-0">
          <svg
            class="w-5 h-5 text-white transition-transform duration-300"
            :class="expanded ? 'rotate-180' : ''"
            fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </span>
      </button>

      <!-- Accordion detail -->
      <Transition name="accordion">
        <div v-if="expanded" class="bg-white rounded-3xl shadow-sm overflow-hidden">
          <!-- Fees breakdown -->
          <div class="p-5 pb-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-bold text-gray-900">Fees</h3>
              <span class="text-xs font-medium text-gray-500">{{ fmtCurrency(feeStore.totalFees) }}</span>
            </div>

            <div v-if="feeStore.dueFees.length" class="divide-y divide-gray-100">
              <div v-for="fee in feeStore.dueFees" :key="fee.id" class="py-3 first:pt-0">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-semibold text-gray-900 text-sm">{{ fee.name }}</p>
                    <p class="text-xs text-gray-400 mt-0.5">
                      <template v-if="fee.organization?.name">{{ fee.organization.name }}</template>
                      <template v-if="fee.academic_term || fee.term"><span v-if="fee.organization?.name"> · </span>{{ fee.academic_term || fee.term }}</template>
                    </p>
                    <p v-if="fee.due_date" class="text-xs text-gray-500 mt-0.5">Due {{ fmtDate(fee.due_date) }}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-sm font-bold text-gray-900">{{ fmtCurrency(fee.amount) }}</p>
                    <span
                      class="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      :class="feeStore.isPending(fee.obligation_key) ? 'bg-amber-100 text-amber-700' : 'bg-amber-50 text-amber-600'"
                    >
                      {{ feeStore.isPending(fee.obligation_key) ? 'Pending Verification' : 'Pending' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-gray-400 py-2">No outstanding fees.</p>
          </div>

          <!-- Divider -->
          <div class="h-2 bg-gray-50 border-y border-gray-100"></div>

          <!-- Penalties -->
          <div class="p-5 pb-4">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <span class="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                  <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                  </svg>
                </span>
                <h3 class="font-bold text-gray-900">Penalties</h3>
              </div>
              <span class="text-xs font-medium text-gray-500">{{ fmtCurrency(feeStore.totalPenalties) }}</span>
            </div>
            <p class="text-xs text-red-500 font-medium mb-3">
              {{ feeStore.absences }} absence{{ feeStore.absences !== 1 ? 's' : '' }} recorded
            </p>

            <div v-if="feeStore.penalties.length" class="divide-y divide-gray-100">
              <div v-for="penalty in feeStore.penalties" :key="penalty.id" class="py-3 first:pt-0">
                <button class="w-full text-left" @click="expandedPenalty = expandedPenalty === penalty.id ? null : penalty.id">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="font-semibold text-gray-900 text-sm">{{ penalty.event?.title || 'Required event' }}</p>
                      <p v-if="penalty.event?.organization?.name" class="text-xs text-gray-400 mt-0.5">
                        {{ penalty.event.organization.name }}
                      </p>
                      <p v-if="penalty.event?.event_date" class="text-xs text-gray-500 mt-0.5">
                        {{ fmtDate(penalty.event.event_date) }}
                      </p>
                      <p v-if="penalty.absences" class="text-xs text-red-500 font-medium mt-0.5">
                        {{ penalty.absences }} missing scan{{ penalty.absences !== 1 ? 's' : '' }}
                      </p>
                    </div>
                    <div class="text-right shrink-0">
                      <p class="text-sm font-bold text-red-600">{{ fmtCurrency(penalty.amount) }}</p>
                      <span
                        class="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        :class="feeStore.isPending(penalty.obligation_key) ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'"
                      >
                        {{ feeStore.isPending(penalty.obligation_key) ? 'Pending Verification' : 'Unpaid' }}
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 mt-2 text-xs text-gray-400">
                    <span>View absent details</span>
                    <svg
                      class="w-3.5 h-3.5 transition-transform duration-200"
                      :class="expandedPenalty === penalty.id ? 'rotate-180' : ''"
                      fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </div>
                </button>

                <Transition name="accordion">
                  <div v-if="expandedPenalty === penalty.id" class="mt-3 rounded-xl bg-gray-50 p-3">
                    <p class="text-xs font-semibold text-gray-600 mb-2">Missing attendance</p>
                    <ul v-if="penalty.missing_qr_configurations?.length" class="space-y-1.5">
                      <li v-for="(qr, idx) in penalty.missing_qr_configurations" :key="qr.id" class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </span>
                        <span class="text-xs text-gray-700">
                          {{ qrTypeLabel(qr.type) }}
                          <template v-if="qr.valid_from"> · {{ fmtTime(qr.valid_from) }}–{{ fmtTime(qr.valid_until) }}</template>
                        </span>
                      </li>
                    </ul>
                    <p v-else class="text-xs text-gray-500">No missing QR configurations.</p>
                  </div>
                </Transition>
              </div>
            </div>
            <p v-else class="text-sm text-gray-400 py-2">No pending penalties. Good job!</p>
          </div>

          <!-- Pay action -->
          <div class="p-5 pt-0 space-y-2">
            <button
              v-if="feeStore.totalCombined > 0"
              @click="router.push({ name: 'payments-create' })"
              class="w-full rounded-xl bg-primary-700 py-3.5 text-sm font-semibold text-white hover:bg-primary-800 transition-colors"
            >
              Pay {{ fmtCurrency(feeStore.totalCombined) }}
            </button>
            <router-link
              :to="{ name: 'payments-submissions' }"
              class="w-full rounded-xl border border-gray-200 py-3.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              Pending Verifications
              <span v-if="feeStore.pendingVerification.length" class="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {{ feeStore.pendingVerification.length }}
              </span>
            </router-link>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.accordion-enter-active,
.accordion-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.accordion-enter-from,
.accordion-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
