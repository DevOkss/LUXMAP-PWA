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
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-900">{{ receipt.receipt_number }}</p>
            <p class="text-xs text-gray-500">
              {{ fmtDate(receipt.issued_at) }}
              <template v-if="receipt.payment"> · ₱{{ Number(receipt.payment.amount).toFixed(2) }}</template>
            </p>
          </div>
          <button @click="router.push({ name: 'receipts-show', params: { id: receipt.id } })" class="text-sm text-primary-600 font-medium">View</button>
        </div>
      </div>
    </div>
  </div>
</template>