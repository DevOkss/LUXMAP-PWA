import { API_URL } from '@/config/app'

export function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url

  if (API_URL && API_URL !== '/api') {
    const origin = API_URL.replace(/\/api\/?$/, '')
    return origin + url
  }

  return url
}