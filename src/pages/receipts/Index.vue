<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'
import type { Receipt } from '@/types'

const router = useRouter()
const receipts = ref<Receipt[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const response = await api.get('/receipts')
    receipts.value = response.data.data || response.data.receipts || []
  } finally {
    loading.value = false
  }
})

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function receiptTotal(r: Receipt): number {
  if (r.total != null) return Number(r.total)
  if (r.payment) return Number(r.payment.amount)
  return 0
}
function itemLabel(item: { fee?: { name?: string } | null; event?: { title?: string } | null; fee_type?: string }): string {
  if (item.fee?.name) return item.fee.name
  if (item.event?.title) return item.event.title
  return item.fee_type === 'penalty' ? 'Penalty' : 'Fee'
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-bold text-gray-900">Receipts</h2>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="w-9 h-9 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
    </div>

    <div v-else-if="receipts.length === 0" class="bg-white border border-gray-200 rounded-xl p-6 text-center">
      <p class="text-gray-600 text-sm">No receipts yet.</p>
    </div>

    <div v-else class="space-y-2">
      <div v-for="receipt in receipts" :key="receipt.id" class="bg-white border border-gray-200 rounded-xl p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900">{{ receipt.receipt_number }}</p>
            <p class="text-xs text-gray-500">
              {{ fmtDate(receipt.issued_at) }}
              · Total ₱{{ receiptTotal(receipt).toFixed(2) }}
              <template v-if="receipt.payment?.organization"> · {{ receipt.payment.organization.name }}</template>
            </p>
            <div v-if="receipt.items && receipt.items.length" class="mt-1.5 rounded-lg bg-gray-50 p-2 space-y-1">
              <p v-for="it in receipt.items" :key="it.id ?? it.fee?.name ?? it.event?.title" class="flex items-center justify-between text-xs">
                <span class="text-gray-600">{{ itemLabel(it) }}</span>
                <span class="font-medium text-gray-900">₱{{ Number(it.amount).toFixed(2) }}</span>
              </p>
            </div>
            <p v-else-if="receipt.payment" class="text-xs text-gray-400 mt-1">Single item · ₱{{ Number(receipt.payment.amount).toFixed(2) }}</p>
          </div>
          <button @click="router.push({ name: 'receipts-show', params: { id: receipt.id } })" class="text-sm text-primary-600 font-medium shrink-0">View</button>
        </div>
      </div>
    </div>
  </div>
</template>
