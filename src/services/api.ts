import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Device binding/face endpoints identify the calling device via this header.
  // (Dynamic import avoids a circular dependency between api.ts and device.ts.)
  try {
    const { getDeviceFingerprint } = await import('@/services/device')
    const fingerprint = await getDeviceFingerprint()
    if (fingerprint) {
      config.headers['X-Device-Fingerprint'] = fingerprint
    }
  } catch {
    /* header is optional on non-device requests */
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type')
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user')
        localStorage.removeItem('current_workspace')
        localStorage.removeItem('workspaces')
        // Let the app reset in-memory state and redirect to the login screen.
        window.dispatchEvent(new CustomEvent('soms:session-expired'))
        return Promise.reject(error)
      } finally {
        isRefreshing = false
        processQueue(null)
      }
    }

    return Promise.reject(error)
  },
)

export default api
