<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFeeStore } from '@/stores/feeStore'
import { usePaymentStore } from '@/stores/paymentStore'
import { paymentChannelForProvider, paymentChannelLabel } from '@/utils/paymentChannel'
import { resolveImageUrl } from '@/utils/imageUrl'

const router = useRouter()
const feeStore = useFeeStore()
const paymentStore = usePaymentStore()

const selectedOrgId = ref<number | null>(null)
const selectedKeys = ref<Set<string>>(new Set())
const referenceNumber = ref('')
const receiptFile = ref<File | null>(null)
const error = ref('')
const submitted = ref(false)
const qrViewOpen = ref(false)

onMounted(async () => {
  await feeStore.fetchSummary().catch(() => {})
  const first = orgOptions.value[0]
  if (first) selectedOrgId.value = first.id
})

const orgOptions = computed(() => {
  const byOrg = new Map<
    number,
    {
      id: number
      name: string
      type: string
      fees: typeof feeStore.fees
      penalties: typeof feeStore.penalties
    }
  >()
  for (const f of feeStore.dueFees) {
    const orgId = f.organization?.id ?? f.org_id ?? f.organization_id
    if (!orgId) continue
    const entry =
      byOrg.get(orgId) ||
      {
        id: orgId,
        name: f.organization?.name ?? 'Organization',
        type: f.organization?.type ?? '',
        fees: [],
        penalties: [],
      }
    entry.fees = [...entry.fees, f]
    byOrg.set(orgId, entry)
  }
  for (const p of feeStore.penalties) {
    const orgId = p.event?.organization?.id
    if (!orgId) continue
    const entry =
      byOrg.get(orgId) ||
      {
        id: orgId,
        name: p.event?.organization?.name ?? 'Organization',
        type: p.event?.organization?.type ?? '',
        fees: [],
        penalties: [],
      }
    entry.penalties = [...entry.penalties, p]
    byOrg.set(orgId, entry)
  }
  return [...byOrg.values()]
})

const activeOrg = computed(() =>
  orgOptions.value.find((o) => o.id === selectedOrgId.value),
)

const paymentAccount = computed(() =>
  feeStore.paymentAccounts.find(
    (a) => a.organization_id === selectedOrgId.value,
  ),
)

const paymentChannel = computed(() =>
  paymentAccount.value
    ? paymentChannelForProvider(paymentAccount.value.account_provider)
    : null,
)

function totals(fee: {
  academic_term?: string | null
  term?: string | null
}): string | undefined {
  const label = fee.academic_term || fee.term
  return label || undefined
}

const selectedAmount = computed(() =>
  (() => {
    if (!activeOrg.value) return 0
    return [...activeOrg.value.fees, ...activeOrg.value.penalties]
      .filter((o) => selectedKeys.value.has(o.obligation_key))
      .reduce((sum, o) => sum + (Number(o.amount) || 0), 0)
  })(),
)

const paid = computed(() => selectedKeys.value.size > 0 && !submitted.value)

function isSelected(obligationKey: string | undefined): boolean {
  return !!obligationKey && feeStore.isPending(obligationKey)
}

function toggle(key: string) {
  const next = new Set(selectedKeys.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  selectedKeys.value = next
}

function pickOrg(id: number) {
  selectedOrgId.value = id
  selectedKeys.value = new Set()
  error.value = ''
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  receiptFile.value = input.files?.[0] || null
}

async function submit() {
  error.value = ''
  const org = activeOrg.value
  if (!org) {
    error.value = 'Select an organization to pay for.'
    return
  }
  if (selectedKeys.value.size === 0) {
    error.value = 'Select at least one obligation to pay.'
    return
  }
  if (!referenceNumber.value.trim()) {
    error.value = 'The payment reference number is required.'
    return
  }
  if (!receiptFile.value) {
    error.value = 'Attach a screenshot or photo of your payment receipt.'
    return
  }
  if (!paymentAccount.value) {
    error.value = `No official payment account is set up for ${org.name} yet. Please check back later.`
    return
  }
  if (!paymentChannel.value) {
    error.value = 'No payment channel is available for this organization yet.'
    return
  }

  const feeIds = org.fees
    .filter((f) => selectedKeys.value.has(f.obligation_key))
    .map((f) => f.id)
  const eventIds = org.penalties
    .filter((p) => selectedKeys.value.has(p.obligation_key))
    .map((p) => p.event_id ?? p.id)

  submitted.value = true
  try {
    await paymentStore.submitPayment({
      organization_id: org.id,
      fee_ids: feeIds,
      event_ids: eventIds,
      reference_number: referenceNumber.value.trim(),
      payment_channel: paymentChannel.value,
      receipt_image: receiptFile.value,
    })
    router.push({ name: 'payments-submissions' })
  } catch (e: unknown) {
    const err = e as {
      response?: {
        data?: { message?: string; errors?: Record<string, string[]> }
      }
    }
    const errors = err.response?.data?.errors
    const firstError =
      errors && Object.keys(errors).length
        ? Object.values(errors)[0][0]
        : err.response?.data?.message
    error.value = firstError || 'Payment submission failed. Please try again.'
    submitted.value = false
  }
}

function fmtCurrency(value: number): string {
  return `₱${(Number(value) || 0).toFixed(2)}`
}
const hasAmount = computed(() => selectedAmount.value > 0)
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-bold text-gray-900">Make Payment</h2>

    <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
      {{ error }}
    </div>

    <div v-if="feeStore.loading" class="flex justify-center py-16">
      <div class="w-9 h-9 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
    </div>

    <template v-else>
      <div v-if="orgOptions.length === 0" class="bg-white border border-gray-200 rounded-xl p-6 text-center space-y-3">
        <p class="text-gray-600 text-sm">You have no outstanding fees or penalties to pay right now.</p>
        <router-link :to="{ name: 'fees' }" class="inline-block text-sm font-medium text-primary-600">Back to Fees</router-link>
      </div>

      <template v-else>
        <!-- Organization picker -->
        <div v-if="orgOptions.length > 1">
          <label class="block text-sm font-medium text-gray-700 mb-2">Organization</label>
          <div class="space-y-2">
            <button
              v-for="org in orgOptions"
              :key="org.id"
              @click="pickOrg(org.id)"
              class="w-full text-left flex items-center justify-between p-3 rounded-xl border bg-white"
              :class="org.id === selectedOrgId ? 'border-primary-500 bg-primary-50' : 'border-gray-200'"
            >
              <div>
                <p class="text-sm font-semibold text-gray-900">{{ org.name }}</p>
                <p class="text-xs text-gray-500">{{ org.type.toUpperCase() }}</p>
              </div>
              <span
                class="w-5 h-5 rounded-full border flex items-center justify-center shrink-0"
                :class="org.id === selectedOrgId ? 'border-primary-500' : 'border-gray-300'"
              >
                <span v-if="org.id === selectedOrgId" class="w-2.5 h-2.5 rounded-full bg-primary-600"></span>
              </span>
            </button>
          </div>
        </div>

        <template v-if="activeOrg">
          <!-- Payment account -->
          <div v-if="paymentAccount" class="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p class="text-sm font-semibold text-gray-900">Pay to: {{ paymentAccount.organization_name || activeOrg.name }}</p>
            <div class="flex items-center gap-3">
              <div class="flex-1 space-y-1">
                <p class="text-sm font-medium text-gray-800">{{ paymentAccount.account_name }}</p>
                <p class="text-xs text-gray-500">{{ paymentAccount.account_provider || 'Payment account' }}</p>
                <p class="text-sm font-semibold text-primary-700 tracking-wide">{{ paymentAccount.account_number }}</p>
              </div>
              <button
                v-if="paymentAccount.qr_code_image_url"
                type="button"
                class="shrink-0"
                aria-label="View payment QR image"
                @click="qrViewOpen = true"
              >
                <img
                  :src="resolveImageUrl(paymentAccount.qr_code_image_url)"
                  alt="Payment QR"
                  class="w-20 h-20 rounded-lg border border-gray-100 object-contain"
                />
              </button>
              <div v-else class="shrink-0 w-20 h-20 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
                <span class="text-[10px] text-gray-400 px-1 text-center">No QR set</span>
              </div>
            </div>
          </div>
          <p v-else class="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            No official payment account is set up for {{ activeOrg.name }} yet. Please check back later.
          </p>

          <!-- Obligations -->
          <div class="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
            <div class="flex items-center justify-between">
              <label class="block text-sm font-medium text-gray-700">Select obligations</label>
              <span class="text-xs font-bold text-gray-900">{{ fmtCurrency(selectedAmount) }}</span>
            </div>

            <div v-if="activeOrg.fees.length" class="space-y-1">
              <p class="text-xs font-semibold text-gray-400 uppercase">Fees</p>
              <button
                v-for="fee in activeOrg.fees"
                :key="fee.obligation_key"
                :disabled="isSelected(fee.obligation_key)"
                @click="toggle(fee.obligation_key)"
                class="w-full text-left flex items-start justify-between gap-3 p-3 rounded-xl border"
                :class="selectedKeys.has(fee.obligation_key) ? 'border-primary-500 bg-primary-50' : 'border-gray-200'"
              >
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-900">{{ fee.name }}</p>
                  <p class="text-xs text-gray-500 mt-0.5">
                    {{ fee.organization?.name }}<template v-if="totals(fee)"> · {{ totals(fee) }}</template>
                    <template v-if="fee.due_date"> · due {{ new Date(fee.due_date).toLocaleDateString() }}</template>
                  </p>
                  <p v-if="isSelected(fee.obligation_key)" class="text-xs text-amber-600 font-medium mt-1">Pending verification</p>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-sm font-semibold text-gray-900">{{ fmtCurrency(fee.amount) }}</p>
                  <span
                    class="inline-flex w-5 h-5 rounded-full border items-center justify-center mt-1"
                    :class="selectedKeys.has(fee.obligation_key) ? 'border-primary-500' : 'border-gray-300'"
                  >
                    <span v-if="selectedKeys.has(fee.obligation_key)" class="w-2.5 h-2.5 rounded-full bg-primary-600"></span>
                  </span>
                </div>
              </button>
            </div>

            <div v-if="activeOrg.penalties.length" class="space-y-1">
              <p class="text-xs font-semibold text-gray-400 uppercase">Penalties</p>
              <button
                v-for="penalty in activeOrg.penalties"
                :key="penalty.obligation_key"
                :disabled="isSelected(penalty.obligation_key)"
                @click="toggle(penalty.obligation_key)"
                class="w-full text-left rounded-xl border p-3"
                :class="selectedKeys.has(penalty.obligation_key) ? 'border-primary-500 bg-primary-50' : 'border-gray-200'"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-gray-900">{{ penalty.event?.title || 'Required event' }}</p>
                    <p class="text-xs text-gray-500 mt-0.5">{{ penalty.event?.organization?.name }}</p>
                    <p class="text-xs text-red-500 font-medium mt-0.5">
                      {{ penalty.absences || 0 }} missing scan{{ penalty.absences !== 1 ? 's' : '' }}
                    </p>
                    <p v-if="isSelected(penalty.obligation_key)" class="text-xs text-amber-600 font-medium mt-1">Pending verification</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-sm font-semibold text-red-600">{{ fmtCurrency(penalty.amount) }}</p>
                    <span
                      class="inline-flex w-5 h-5 rounded-full border items-center justify-center mt-1"
                      :class="selectedKeys.has(penalty.obligation_key) ? 'border-primary-500' : 'border-gray-300'"
                    >
                      <span v-if="selectedKeys.has(penalty.obligation_key)" class="w-2.5 h-2.5 rounded-full bg-primary-600"></span>
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Payment details -->
          <div class="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Payment reference number</label>
            <input
              v-model="referenceNumber"
              type="text"
              placeholder="e.g. GCASH-1234567890"
              class="w-full rounded-xl border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            />

            <div v-if="paymentChannel">
              <label class="block text-sm font-medium text-gray-700 mb-1">Payment channel</label>
              <div class="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
                {{ paymentChannelLabel(paymentChannel) }}
              </div>
              <p class="text-xs text-gray-400 mt-1">Channel comes from the organization's official payment account.</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Receipt screenshot/photo</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                @change="onFileChange"
                class="w-full text-sm text-gray-600 file:mr-3 file:rounded-xl file:border-0 file:bg-primary-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-primary-700"
              />
              <p class="text-xs text-gray-400 mt-1">JPG, PNG or WEBP, up to 5MB.</p>
            </div>
          </div>

          <button
            @click="submit"
            :disabled="submitted || !hasAmount || !paymentAccount"
            class="w-full bg-primary-700 text-white rounded-xl px-4 py-3.5 text-sm font-semibold hover:bg-primary-800 disabled:opacity-50"
          >
            {{ submitted ? 'Submitting...' : `Pay ${fmtCurrency(selectedAmount)} & Submit` }}
          </button>

          <router-link :to="{ name: 'payments-submissions' }" class="block text-center text-sm font-medium text-gray-400 hover:text-gray-600">
            View my pending verifications
          </router-link>

          <p v-if="!hasAmount" class="text-center text-xs text-gray-400">
            No obligations selected yet — your total updates as you tick obligations.
          </p>
        </template>
      </template>
    </template>
  </div>

  <Teleport to="body">
    <div v-if="qrViewOpen" class="fixed inset-0 z-[3000] flex items-center justify-center p-6">
      <div class="absolute inset-0 bg-black/70" @click="qrViewOpen = false"></div>
      <div class="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <button
          type="button"
          @click="qrViewOpen = false"
          aria-label="Close"
          class="absolute right-3 top-3 text-2xl leading-none text-gray-400 hover:text-gray-600"
        >&times;</button>
        <p class="text-sm font-semibold text-gray-900">
          Scan to pay {{ paymentAccount?.organization_name || activeOrg?.name }}
        </p>
        <div class="mt-3 flex justify-center">
          <img
            v-if="paymentAccount?.qr_code_image_url"
            :src="resolveImageUrl(paymentAccount.qr_code_image_url)"
            alt="Payment QR"
            class="max-h-[65vh] w-auto max-w-full rounded-lg border border-gray-200 object-contain"
          />
        </div>
        <p class="mt-3 text-center text-sm font-medium text-gray-800">{{ paymentAccount?.account_name }}</p>
        <p class="text-center text-xs text-gray-500">
          {{ paymentAccount?.account_provider || 'Payment account' }} · {{ paymentAccount?.account_number }}
        </p>
        <a
          v-if="paymentAccount?.qr_code_image_url"
          :href="resolveImageUrl(paymentAccount.qr_code_image_url)"
          target="_blank"
          rel="noopener"
          class="mt-3 block text-center text-xs font-medium text-primary-600 underline"
        >Open image</a>
      </div>
    </div>
  </Teleport>
</template>