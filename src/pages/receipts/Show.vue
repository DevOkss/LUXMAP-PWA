<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/services/api'
import type { Receipt } from '@/types'
import { numberToWords } from '@/utils/amountWords'

const route = useRoute()
const receipt = ref<Receipt | null>(null)
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const response = await api.get(`/receipts/${route.params.id}`)
    receipt.value = response.data.data || response.data.receipt
  } finally {
    loading.value = false
  }
})

const total = computed(() => {
  if (!receipt.value) return 0
  if (receipt.value.total != null) return Number(receipt.value.total)
  if (receipt.value.payment) return Number(receipt.value.payment.amount)
  return 0
})
const items = computed(() => receipt.value?.items || [])

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function statusLabel(status: string): string {
  if (status === 'paid') return 'Paid'
  if (status === 'exempted') return 'Exempted'
  return status
}

function itemLabel(item: { fee?: { name?: string } | null; event?: { title?: string } | null; fee_type?: string }): string {
  if (item.fee?.name) return item.fee.name
  if (item.event?.title) return item.event.title
  return item.fee_type === 'penalty' ? 'Penalty' : 'Fee'
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-bold text-gray-900">Receipt</h2>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="w-9 h-9 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
    </div>

    <div v-else-if="!receipt" class="bg-white border border-gray-200 rounded-xl p-6 text-center">
      <p class="text-gray-600 text-sm">Receipt not found.</p>
    </div>

    <div v-else class="bg-white border border-gray-200 rounded-xl p-6">
      <div class="text-center border-b border-gray-200 pb-4 mb-4">
        <p class="text-lg font-bold text-gray-900">{{ receipt.receipt_number }}</p>
        <p class="text-xs text-gray-500">{{ fmtDate(receipt.issued_at) }}</p>
        <p v-if="receipt.batch_id" class="text-[10px] text-gray-400 font-mono mt-1">Batch {{ receipt.batch_id.slice(0, 8).toUpperCase() }}</p>
      </div>

      <div v-if="receipt.payment" class="space-y-3 text-sm">
        <!-- Breakdown table: one receipt → many fees (requirement §3 & §5) -->
        <div v-if="items.length" class="rounded-xl bg-gray-50 p-3 space-y-2">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Fee Breakdown</p>
          <div v-for="item in items" :key="item.id ?? item.fee?.name ?? item.event?.title" class="flex items-center justify-between text-sm">
            <span class="text-gray-700">{{ itemLabel(item) }}</span>
            <span class="font-semibold text-gray-900">₱{{ Number(item.amount).toFixed(2) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm border-t border-gray-200 pt-2 font-bold">
            <span>Total</span><span>₱{{ total.toFixed(2) }}</span>
          </div>
        </div>
        <div v-else class="flex justify-between">
          <span class="text-gray-500">Amount</span>
          <span class="text-gray-900 font-bold">₱{{ total.toFixed(2) }}</span>
        </div>

        <p class="text-xs italic text-gray-500">{{ numberToWords(total) }} Only</p>

        <div v-if="receipt.issued_by || receipt.payment.processedBy || receipt.payment.verifiedBy || receipt.payment.exemptedBy" class="flex justify-between">
          <span class="text-gray-500">Processed by</span>
          <span class="text-gray-900 font-medium">{{ (receipt.issued_by || receipt.payment.processedBy || receipt.payment.verifiedBy || receipt.payment.exemptedBy)?.name || '—' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Status</span>
          <span class="text-gray-900 font-medium">{{ statusLabel(receipt.payment.status) }}</span>
        </div>
        <div v-if="receipt.payment.organization" class="flex justify-between">
          <span class="text-gray-500">Organization</span>
          <span class="text-gray-900 font-medium">{{ receipt.payment.organization.name }}</span>
        </div>
        <div v-if="receipt.payment.paid_at" class="flex justify-between">
          <span class="text-gray-500">Paid</span>
          <span class="text-gray-900 font-medium">{{ fmtDate(receipt.payment.paid_at) }}</span>
        </div>
        <div v-if="receipt.payment.user" class="flex justify-between">
          <span class="text-gray-500">Student</span>
          <span class="text-gray-900 font-medium">{{ receipt.payment.user.name }}</span>
        </div>
      </div>
      <p v-else class="text-sm text-gray-500">Receipt details unavailable.</p>
    </div>
  </div>
</template>
