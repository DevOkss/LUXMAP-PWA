import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api'
import type { Payment, PaymentSubmissionGroup } from '@/types'

export const usePaymentStore = defineStore('payment', () => {
  const payments = ref<Payment[]>([])
  const submissions = ref<PaymentSubmissionGroup[]>([])
  const loading = ref(false)
  const submitting = ref(false)

  async function fetchHistory() {
    loading.value = true
    try {
      const response = await api.get('/payments')
      payments.value = response.data.data || response.data.payments || []
    } finally {
      loading.value = false
    }
  }

  async function fetchSubmissions() {
    loading.value = true
    try {
      const response = await api.get('/payments/submissions')
      submissions.value = response.data.data || []
    } finally {
      loading.value = false
    }
  }

  async function submitPayment(payload: {
    organization_id: number
    fee_ids: number[]
    event_ids: number[]
    reference_number: string
    payment_channel: string | null
    receipt_image: File | null
  }) {
    submitting.value = true
    try {
      const form = new FormData()
      form.append('organization_id', String(payload.organization_id))
      for (const id of payload.fee_ids) form.append('fee_ids[]', String(id))
      for (const id of payload.event_ids) form.append('event_ids[]', String(id))
      form.append('reference_number', payload.reference_number)
      if (payload.payment_channel) {
        form.append('payment_channel', payload.payment_channel)
      }
      if (payload.receipt_image) {
        form.append('receipt_image', payload.receipt_image)
      }
      const response = await api.post('/payments/submissions', form)
      return response.data
    } finally {
      submitting.value = false
    }
  }

  return {
    payments,
    submissions,
    loading,
    submitting,
    fetchHistory,
    fetchSubmissions,
    submitPayment,
  }
})