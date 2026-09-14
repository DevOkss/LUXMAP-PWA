<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePaymentStore } from '@/stores/paymentStore'
import { paymentChannelLabel as channelLabel } from '@/utils/paymentChannel'
import { resolveImageUrl } from '@/utils/imageUrl'
import type { Payment } from '@/types'

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

// Group payments by batch_id → one record per transaction (requirement §4)
interface PaymentGroup {
  batch_id: string
  uuid: string | null
  payments: Payment[]
  total: number
  paid_at: string | null
  created_at: string | null
  status: string
  isExempted: boolean
  payment_method: string | null
  reference_number: string | null
  academic_term: string | null
  organization: { id: number; name: string } | null
  receipt: Payment['receipt'] | null
  count: number
}

const groupedPayments = computed<PaymentGroup[]>(() => {
  const map = new Map<string, Payment[]>()
  for (const p of paymentStore.payments) {
    const key = (p as unknown as { batch_id?: string }).batch_id || `p-${p.id}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(p)
  }
  const groups: PaymentGroup[] = []
  for (const [batchId, list] of map.entries()) {
    const sorted = [...list].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    const first = sorted[0]
    const total = sorted.reduce((s, p) => s + Number(p.amount), 0)
    // Find the batch receipt (one per transaction); after fix only first has it, but we scan all
    const receipt = sorted.find((p) => p.receipt)?.receipt || first.receipt || null
    const paidAt = sorted.reduce<string | null>((acc, p) => {
      const d = p.paid_at || (p as unknown as { created_at?: string }).created_at || null
      if (!d) return acc
      if (!acc) return d
      return new Date(d) > new Date(acc) ? d : acc
    }, null)
    const createdAt = (first as unknown as { created_at?: string }).created_at || paidAt
    const anyExempted = sorted.some((p) => p.isExempted || p.status === 'exempted')
    const status = anyExempted ? 'exempted' : sorted.every((p) => p.status === 'paid') ? 'paid' : (first.status as string)
    groups.push({
      batch_id: batchId,
      uuid: (first as unknown as { uuid?: string }).uuid || null,
      payments: sorted,
      total,
      paid_at: paidAt,
      created_at: createdAt as string | null,
      status,
      isExempted: anyExempted,
      payment_method: first.payment_method || null,
      reference_number: first.reference_number || null,
      academic_term: first.academic_term || null,
      organization: first.organization || null,
      receipt,
      count: sorted.length,
    })
  }
  // Newest first
  return groups.sort((a, b) => {
    const da = a.paid_at || a.created_at || ''
    const db = b.paid_at || b.created_at || ''
    return new Date(db).getTime() - new Date(da).getTime()
  })
})

const visibleGrouped = computed(() => {
  let list = groupedPayments.value
  if (statusFilter.value === 'paid') list = list.filter((g) => g.status === 'paid')
  else if (statusFilter.value === 'all') {
    // keep all, but "all" includes exempted too; original filter "paid" vs "all"
  }
  if (termFilter.value !== 'all') list = list.filter((g) => (g.academic_term || '') === termFilter.value)
  return list
})

const visibleSubmissions = computed(() => {
  let list = paymentStore.submissions.filter((s) => s.status === 'pending')
  if (termFilter.value !== 'all') list = list.filter((s) => (s.academic_term || '') === termFilter.value)
  return list
})

const isEmpty = computed(() =>
  showingPending.value ? visibleSubmissions.value.length === 0 : visibleGrouped.value.length === 0,
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

function goToReceipt(group: PaymentGroup) {
  if (group.receipt?.id) {
    router.push({ name: 'receipts-show', params: { id: group.receipt.id } })
  } else if (group.receipt?.receipt_number) {
    // fallback: go to receipts list if id missing
    router.push({ name: 'receipts' })
  } else {
    router.push({ name: 'receipts' })
  }
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

    <!-- Confirmed payments — ONE card per transaction (batch) -->
    <div v-else class="space-y-2">
      <div v-for="group in visibleGrouped" :key="group.batch_id" class="bg-white border border-gray-200 rounded-xl p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-900">
              Payment #{{ group.receipt?.receipt_number ? group.receipt.receipt_number.slice(-4) : group.batch_id.slice(0, 8).toUpperCase() }}
            </p>
            <p class="text-xs text-gray-500 mt-0.5">{{ group.organization?.name || 'Organization' }} <template v-if="group.academic_term">· {{ group.academic_term }}</template></p>
            <p class="text-xs text-gray-400 mt-1">Fees: {{ group.payments.map(itemName).join(', ') }}</p>
            <p class="text-sm font-bold text-gray-900 mt-1">Total: ₱{{ group.total.toFixed(2) }} <span v-if="group.count > 1" class="text-xs font-normal text-gray-500">· {{ group.count }} items</span></p>
            <p class="text-xs text-gray-400 mt-1">
              {{ fmtDate(group.paid_at || group.created_at) }} · {{ methodLabel(group.payment_method) }}
              <template v-if="group.receipt?.receipt_number"> · Receipt {{ group.receipt.receipt_number }}</template>
              <template v-if="group.reference_number"> · Ref {{ group.reference_number }}</template>
            </p>
          </div>
          <span class="text-xs font-medium px-2 py-0.5 rounded-full shrink-0" :class="statusStyle(group.status)">
            {{ statusLabel(group.status) }}
          </span>
        </div>
        <div class="mt-3 rounded-xl bg-gray-50 p-3 space-y-1.5">
          <p v-for="pay in group.payments" :key="pay.id" class="flex items-center justify-between text-sm">
            <span class="text-gray-700">{{ itemName(pay) }}</span>
            <span class="font-semibold text-gray-900">{{ `₱${Number(pay.amount).toFixed(2)}` }}</span>
          </p>
          <p class="flex items-center justify-between text-sm border-t border-gray-200 pt-1.5 font-bold">
            <span>Total</span><span>₱{{ group.total.toFixed(2) }}</span>
          </p>
        </div>
        <button
          v-if="group.receipt"
          @click="goToReceipt(group)"
          class="mt-3 text-xs font-semibold text-primary-600"
        >
          View receipt {{ group.receipt.receipt_number }}
        </button>
        <button
          v-else
          @click="goToReceipt(group)"
          class="mt-3 text-xs font-semibold text-gray-500"
        >
          Receipt pending (batch {{ group.batch_id.slice(0,8) }})
        </button>
      </div>
    </div>
  </div>
</template>
