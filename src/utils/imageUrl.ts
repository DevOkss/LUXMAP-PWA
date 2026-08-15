export function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url

  const apiBase = import.meta.env.VITE_API_URL as string | undefined
  if (apiBase) {
    const origin = apiBase.replace(/\/api\/?$/, '')
    return origin + url
  }

  return url
}