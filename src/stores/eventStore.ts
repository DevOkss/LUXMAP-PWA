import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api'
import { db } from '@/services/db'
import type { Event } from '@/types'

export const useEventStore = defineStore('event', () => {
  const events = ref<Event[]>([])
  const loading = ref(false)

  async function fetchEvents(params?: Record<string, string>) {
    loading.value = true
    try {
      const response = await api.get('/events', { params })
      const data = response.data.data || response.data.events || []
      events.value = data
      await db.cacheEvents(data)
    } finally {
      loading.value = false
    }
  }

  async function fetchEvent(id: string) {
    const response = await api.get(`/events/${id}`)
    return response.data.data as Event
  }

  async function createDraft(payload: Record<string, unknown>) {
    const response = await api.post('/events/draft/store', payload)
    return response.data.data as Event
  }

  async function updateEvent(id: string, payload: Record<string, unknown>) {
    const response = await api.put(`/events/${id}`, payload)
    return response.data.data as Event
  }

  async function publishEvent(id: string) {
    const response = await api.post(`/events/${id}/publish`)
    return response.data.data as Event
  }

  async function unpublishEvent(id: string) {
    const response = await api.post(`/events/${id}/unpublish`)
    return response.data.data as Event
  }

  async function completeEvent(id: string) {
    const response = await api.post(`/events/${id}/complete`)
    return response.data.data as Event
  }

  async function deleteEvent(id: string) {
    await api.delete(`/events/${id}`)
  }

  async function loadCached() {
    const cached = await db.getCachedEvents()
    if (cached.length > 0) {
      events.value = cached as unknown as Event[]
    }
  }

  return {
    events,
    loading,
    fetchEvents,
    fetchEvent,
    createDraft,
    updateEvent,
    publishEvent,
    unpublishEvent,
    completeEvent,
    deleteEvent,
    loadCached,
  }
})
