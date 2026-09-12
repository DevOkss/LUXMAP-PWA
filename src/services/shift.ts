import api from '@/services/api'

export interface ShiftRequest {
  id: number
  status: 'pending' | 'approved' | 'rejected'
  reason: string | null
  remarks: string | null
  current: { institute: string | null; program: string | null }
  requested: { institute: string | null; program: string | null }
  created_at: string
  reviewed_at: string | null
}

export async function fetchMyShiftRequests(): Promise<ShiftRequest[]> {
  const res = await api.get('/shift-requests')
  return res.data?.data ?? []
}

export async function createShiftRequest(payload: {
  requested_institute: string
  requested_program: string
  reason?: string | null
}): Promise<ShiftRequest> {
  const res = await api.post('/shift-requests', payload)
  return res.data?.data
}

export async function fetchShiftRequest(id: number): Promise<ShiftRequest> {
  const res = await api.get(`/shift-requests/${id}`)
  return res.data?.data
}
