/**
 * Central runtime configuration.
 *
 * Every value can be overridden per environment via Vite env vars
 * (VITE_API_URL, VITE_QR_KEY, VITE_VAPID_PUBLIC_KEY). The production
 * fallbacks point at the deployed LuxMap backend so a build without
 * configured env vars — e.g. a fresh Vercel deploy — still reaches the right
 * API instead of calling its own origin (static hosting answers /api with
 * 405 Method Not Allowed).
 *
 * Note: QR_KEY ships inside the client bundle by design — the PWA decrypts QR
 * payloads locally via Web Crypto — so it is not treated as a secret.
 */

const PROD_API_URL = 'https://luxmap.devokss.online/api'
const PROD_QR_KEY = '91877d9445d4dac3266d512bfaa5f2b5121560c685bc1c6ff400a6e6ca276161'
const PROD_VAPID_KEY =
  'BMl2vJLTjjmBuUyTM3k2RhQUWwNTx9tlC2mg6I-M9By47IOfErZpB2UA0QtPGWIpLk01xmCSc9NxLv5YqvtDVWQ'

export const API_URL: string =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? PROD_API_URL : '/api')

export const QR_KEY: string | undefined =
  import.meta.env.VITE_QR_KEY || (import.meta.env.PROD ? PROD_QR_KEY : undefined)

export const VAPID_PUBLIC_KEY: string | undefined =
  import.meta.env.VITE_VAPID_PUBLIC_KEY || (import.meta.env.PROD ? PROD_VAPID_KEY : undefined)
