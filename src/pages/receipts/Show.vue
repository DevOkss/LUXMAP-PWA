<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
      </div>

      <div v-if="receipt.payment" class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-500">Amount</span>
          <span class="text-gray-900 font-bold">₱{{ Number(receipt.payment.amount).toFixed(2) }}</span>
        </div>
        <p class="text-xs italic text-gray-500">{{ numberToWords(Number(receipt.payment.amount)) }} Only</p>
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