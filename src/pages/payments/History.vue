<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePaymentStore } from '@/stores/paymentStore'
import { paymentChannelLabel as channelLabel } from '@/utils/paymentChannel'
import { resolveImageUrl } from '@/utils/imageUrl'

const router = useRouter()
const paymentStore = usePaymentStore()

const statusFilter = ref<'all' | 'paid' | 'pending'>('all')
const termFilter = ref('all')

onMounted(async () => {
  await Promise.all([paymentStore.fetchHistory(), paymentStore.fetchSubmissions()])
})

const termOptions = computed(() => {
  const terms = new Set<string>()
  for (const p of paymentStore.payments) if (p.academic_term) terms.add(p.academic_term)
  for (const s of paymentStore.submissions) if (s.academic_term) terms.add(s.academic_term)
  return [...terms].sort((a, b) => a.localeCompare(b))
})

const showingPending = computed(() => statusFilter.value === 'pending')

const visiblePayments = computed(() => {
  let list = paymentStore.payments
  if (statusFilter.value === 'paid') list = list.filter((p) => p.status === 'paid')
  if (termFilter.value !== 'all') list = list.filter((p) => (p.academic_term || '') === termFilter.value)
  return list
})

const visibleSubmissions = computed(() => {
  let list = paymentStore.submissions.filter((s) => s.status === 'pending')
  if (termFilter.value !== 'all') list = list.filter((s) => (s.academic_term || '') === termFilter.value)
  return list
})

const isEmpty = computed(() =>
  showingPending.value ? visibleSubmissions.value.length === 0 : visiblePayments.value.length === 0,
)

const loading = computed(() => paymentStore.loading)

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function statusStyle(status: string): string {
  if (status === 'paid') return 'bg-green-100 text-green-700'
  if (status === 'exempted') return 'bg-purple-100 text-purple-700'
  if (status === 'refunded') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

function statusLabel(status: string): string {
  if (status === 'paid') return 'Paid'
  if (status === 'exempted') return 'Exempted'
  if (status === 'refunded') return 'Refunded'
  if (status === 'pending') return 'Pending Verification'
  return status
}

function methodLabel(method: string | null): string {
  if (!method) return '—'
  if (method === 'cashless') return 'E-payment'
  if (method === 'cash') return 'Cash'
  if (method === 'exemption') return 'Exemption'
  return method
}

function itemName(payment: { fee?: { name?: string } | null; event?: { title?: string } | null; fee_type?: string }): string {
  if (payment.fee?.name) return payment.fee.name
  if (payment.event?.title) return payment.event.title
  return payment.fee_type === 'penalty' ? 'Penalty' : 'Fee'
}

function submissionItemLabel(item: { fee?: { name?: string } | null; event?: { title?: string } | null; fee_type?: string }): string {
  if (item.fee?.name) return item.fee.name
  if (item.event?.title) return item.event.title
  return item.fee_type === 'penalty' ? 'Penalty' : 'Fee'
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-gray-900">Payment History</h2>
      <router-link :to="{ name: 'receipts' }" class="text-sm text-primary-600 font-medium">Receipts</router-link>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <select
        v-model="statusFilter"
        class="w-full rounded-xl border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
      >
        <option value="all">All</option>
        <option value="paid">Paid</option>
        <option value="pending">Pending</option>
      </select>
      <select
        v-model="termFilter"
        class="w-full rounded-xl border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
      >
        <option value="all">All terms</option>
        <option v-for="term in termOptions" :key="term" :value="term">{{ term }}</option>
      </select>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="w-9 h-9 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
    </div>

    <div
      v-else-if="isEmpty"
      class="bg-white border border-gray-200 rounded-xl p-6 text-center space-y-3"
    >
      <p class="text-gray-600 text-sm">
        {{ showingPending ? 'No pending verifications for this filter.' : 'No payments found for this filter.' }}
      </p>
      <router-link
        v-if="!showingPending"
        :to="{ name: 'payments-create' }"
        class="inline-block text-sm font-medium text-primary-600"
      >
        Make a payment
      </router-link>
      <router-link v-else :to="{ name: 'payments-submissions' }" class="inline-block text-sm font-medium text-primary-600">
        View all submissions
      </router-link>
    </div>

    <!-- Pending verification submissions -->
    <div v-else-if="showingPending" class="space-y-2">
      <div v-for="group in visibleSubmissions" :key="group.group_key" class="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900">{{ group.organization?.name }}</p>
            <p class="text-xs text-gray-500 mt-0.5">
              <template v-if="group.academic_term">{{ group.academic_term }} · </template>
              submitted {{ fmtDate(group.submitted_at) }}
            </p>
            <p v-if="group.reference_number" class="text-xs text-gray-400 mt-0.5">Ref {{ group.reference_number }}</p>
          </div>
          <span class="text-xs font-medium px-2 py-0.5 rounded-full shrink-0" :class="statusStyle(group.status)">
            {{ statusLabel(group.status) }}
          </span>
        </div>

        <div class="rounded-xl bg-gray-50 p-3 space-y-1.5">
          <p v-for="(item, idx) in group.items" :key="idx" class="flex items-center justify-between text-sm">
            <span class="text-gray-700">{{ submissionItemLabel(item) }}</span>
            <span class="font-semibold text-gray-900">{{ `₱${Number(item.amount).toFixed(2)}` }}</span>
          </p>
          <p class="flex items-center justify-between text-sm border-t border-gray-200 pt-1.5">
            <span class="text-gray-500">{{ channelLabel(group.payment_channel) }}</span>
            <span class="font-bold text-gray-900">{{ `₱${group.items.reduce((s, i) => s + Number(i.amount), 0).toFixed(2)}` }}</span>
          </p>
        </div>

        <div v-if="group.receipt_image_url" class="flex items-center gap-2">
          <span class="text-xs text-gray-500">Receipt:</span>
          <a
            :href="resolveImageUrl(group.receipt_image_url)"
            target="_blank"
            rel="noopener"
            class="text-xs font-medium text-primary-600"
          >
            View uploaded receipt
          </a>
        </div>
      </div>
    </div>

    <!-- Confirmed payments -->
    <div v-else class="space-y-2">
      <div v-for="payment in visiblePayments" :key="payment.id" class="bg-white border border-gray-200 rounded-xl p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900">{{ itemName(payment) }}</p>
            <p class="text-xs text-gray-500 mt-0.5">{{ payment.organization?.name }}</p>
            <p class="text-sm font-bold text-gray-900 mt-1">{{ `₱${Number(payment.amount).toFixed(2)}` }}</p>
            <p class="text-xs text-gray-400 mt-1">
              {{ fmtDate(payment.paid_at || payment.created_at) }} · {{ methodLabel(payment.payment_method) }}
              <template v-if="payment.reference_number"> · Ref {{ payment.reference_number }}</template>
            </p>
          </div>
          <span class="text-xs font-medium px-2 py-0.5 rounded-full shrink-0" :class="statusStyle(payment.status)">
            {{ statusLabel(payment.status) }}
          </span>
        </div>
        <button
          v-if="payment.receipt"
          @click="router.push({ name: 'receipts' })"
          class="mt-3 text-xs font-semibold text-primary-600"
        >
          View receipt {{ payment.receipt.receipt_number }}
        </button>
      </div>
    </div>
  </div>
</template>
