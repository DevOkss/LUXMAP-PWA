import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'
import type { Fee, Penalty, PaymentAccount } from '@/types'

export const useFeeStore = defineStore('fee', () => {
  const fees = ref<Fee[]>([])
  const penalties = ref<Penalty[]>([])
  const unresolved = ref<string[]>([])
  const paymentAccounts = ref<PaymentAccount[]>([])
  const loading = ref(false)

  function normalizePenalty(p: Record<string, any>): Penalty {
    return {
      id: p.event_id ?? p.obligation_id ?? p.id,
      type: 'penalty',
      obligation_key: p.obligation_key,
      obligation_id: p.obligation_id,
      event_id: p.event_id,
      amount: Number(p.amount) || 0,
      unit_amount: p.unit_amount ? Number(p.unit_amount) : undefined,
      academic_term: p.academic_term,
      absences: p.absences,
      missing_qr_configurations: p.missing_qr_configurations,
      status: 'pending',
      isExempted: false,
      event: p.event,
    }
  }

  async function loadOutstanding(): Promise<{
    fees: any[]
    penalties: any[]
    unresolved: string[]
    payment_accounts: PaymentAccount[]
  }> {
    const response = await api.get('/payments/outstanding')
    const data = response.data || {}
    return {
      fees: data.fees || [],
      penalties: data.penalties || [],
      unresolved: data.unresolved || [],
      payment_accounts: data.payment_accounts || [],
    }
  }

  async function fetchFees() {
    loading.value = true
    try {
      const data = await loadOutstanding()
      fees.value = data.fees || []
      unresolved.value = data.unresolved
      paymentAccounts.value = data.payment_accounts
    } finally {
      loading.value = false
    }
  }

  async function fetchPenalties() {
    const data = await loadOutstanding()
    penalties.value = (data.penalties || []).map(normalizePenalty)
    unresolved.value = data.unresolved
    paymentAccounts.value = data.payment_accounts
  }

  async function fetchSummary(_userId?: number) {
    loading.value = true
    try {
      const data = await loadOutstanding()
      fees.value = data.fees || []
      penalties.value = (data.penalties || []).map(normalizePenalty)
      unresolved.value = data.unresolved
      paymentAccounts.value = data.payment_accounts
    } finally {
      loading.value = false
    }
  }

  const dueFees = computed(() =>
    fees.value.filter(
      (f) => f.obligation_status !== 'paid' && f.obligation_status !== 'exempted',
    ),
  )
  const totalFees = computed(() =>
    dueFees.value.reduce((sum, f) => sum + (Number(f.amount) || 0), 0),
  )
  const absences = computed(() =>
    penalties.value.reduce((sum, p) => sum + (Number(p.absences) || 0), 0),
  )
  const totalPenalties = computed(() =>
    penalties.value.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
  )
  const totalCombined = computed(() => totalFees.value + totalPenalties.value)

  const pendingVerification = computed(() =>
    [...dueFees.value, ...penalties.value].filter((o) =>
      unresolved.value.includes(o.obligation_key),
    ),
  )

  function isPending(key: string | undefined): boolean {
    return !!key && unresolved.value.includes(key)
  }

  return {
    fees,
    penalties,
    unresolved,
    paymentAccounts,
    loading,
    dueFees,
    totalFees,
    totalPenalties,
    absences,
    totalCombined,
    pendingVerification,
    isPending,
    fetchFees,
    fetchPenalties,
    fetchSummary,
  }
})