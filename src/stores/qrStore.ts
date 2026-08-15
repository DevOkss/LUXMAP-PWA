import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api'
import type { QrConfiguration } from '@/types'

export const useQrStore = defineStore('qr', () => {
  const configs = ref<QrConfiguration[]>([])
  const loading = ref(false)

  async function fetchConfigs(eventId: string) {
    loading.value = true
    try {
      const res = await api.get(`/events/${eventId}/qr-configurations`)
      configs.value = res.data.data || []
    } finally {
      loading.value = false
    }
  }

  async function getLast(eventId: string): Promise<QrConfiguration | null> {
    const res = await api.get(`/events/${eventId}/qr-configurations/last`)
    return res.data.data || null
  }

  async function createConfig(eventId: string, payload: Record<string, unknown>) {
    const res = await api.post(`/events/${eventId}/qr-configurations`, payload)
    return res.data.data as QrConfiguration
  }

  async function updateConfig(eventId: string, configId: number, payload: Record<string, unknown>) {
    const res = await api.put(`/events/${eventId}/qr-configurations/${configId}`, payload)
    return res.data.data as QrConfiguration
  }

  async function generateQr(eventId: string, configId: number) {
    const res = await api.post(`/events/${eventId}/qr-configurations/${configId}/generate`)
    return res.data.data as { config: QrConfiguration; qr_svg: string }
  }

  async function deleteConfig(eventId: string, configId: number) {
    await api.delete(`/events/${eventId}/qr-configurations/${configId}`)
  }

  return { configs, loading, fetchConfigs, getLast, createConfig, updateConfig, generateQr, deleteConfig }
})
