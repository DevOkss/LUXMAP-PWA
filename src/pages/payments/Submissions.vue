<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePaymentStore } from '@/stores/paymentStore'
import { paymentChannelLabel as channelLabel } from '@/utils/paymentChannel'
import { resolveImageUrl } from '@/utils/imageUrl'

const router = useRouter()
const paymentStore = usePaymentStore()

onMounted(() => {
  paymentStore.fetchSubmissions()
})

function fmtCurrency(value: number): string {
  return `₱${(Number(value) || 0).toFixed(2)}`
}

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
  if (status === 'approved') return 'bg-green-100 text-green-700'
  if (status === 'rejected') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

function statusLabel(status: string): string {
  if (status === 'approved') return 'Verified'
  if (status === 'rejected') return 'Rejected'
  return 'Pending Verification'
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-gray-900">Pending Verification</h2>
      <button
        @click="paymentStore.fetchSubmissions()"
        class="text-sm text-primary-600 font-medium"
      >
        Refresh
      </button>
    </div>

    <div v-if="paymentStore.loading" class="flex justify-center py-16">
      <div class="w-9 h-9 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
    </div>

    <div v-else-if="paymentStore.submissions.length === 0" class="bg-white border border-gray-200 rounded-xl p-6 text-center space-y-3">
      <p class="text-gray-600 text-sm">You have no payment submissions yet.</p>
      <router-link :to="{ name: 'payments-create' }" class="inline-block text-sm font-medium text-primary-600">
        Make a payment
      </router-link>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="group in paymentStore.submissions"
        :key="group.group_key"
        class="bg-white border border-gray-200 rounded-xl p-4 space-y-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900">{{ group.organization?.name }}</p>
            <p class="text-xs text-gray-500">
              {{ group.academic_term || '—' }} · Submitted {{ fmtDate(group.submitted_at) }}
            </p>
            <p class="text-xs text-gray-400 mt-0.5">Ref: {{ group.reference_number || '—' }}</p>
          </div>
          <span class="text-xs font-medium px-2 py-0.5 rounded-full shrink-0" :class="statusStyle(group.status)">
            {{ statusLabel(group.status) }}
          </span>
        </div>

        <div class="rounded-xl bg-gray-50 p-3 space-y-1.5">
          <p v-for="(item, idx) in group.items" :key="idx" class="flex items-center justify-between text-sm">
            <span class="text-gray-700">
              {{ item.fee_type === 'penalty' ? (item.event?.title || 'Penalty') : (item.fee?.name || 'Fee') }}
            </span>
            <span class="font-semibold text-gray-900">{{ fmtCurrency(item.amount) }}</span>
          </p>
          <p class="flex items-center justify-between text-sm border-t border-gray-200 pt-1.5">
            <span class="text-gray-500">{{ channelLabel(group.payment_channel) }}</span>
            <span class="font-bold text-gray-900">{{ fmtCurrency(group.items.reduce((s, i) => s + i.amount, 0)) }}</span>
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

        <p v-if="group.status === 'approved' && group.verified_at" class="text-xs text-green-600">
          Verified {{ fmtDate(group.verified_at) }} — payment recorded.
        </p>

        <div v-if="group.status === 'rejected'" class="rounded-xl bg-red-50 border border-red-100 p-3">
          <p class="text-xs font-semibold text-red-700">Rejected</p>
          <p class="text-xs text-red-600 mt-0.5">{{ group.rejection_reason || 'No reason provided.' }}</p>
          <router-link
            :to="{ name: 'payments-create' }"
            class="inline-block mt-2 text-xs font-semibold text-red-700 underline"
          >
            Resubmit payment
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>