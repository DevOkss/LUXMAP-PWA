import api from '@/services/api'

interface PushSubscriptionLike {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return new Uint8Array(outputArray.buffer)
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null

function ensureRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!registrationPromise) {
    registrationPromise = (async () => {
      if (!('serviceWorker' in navigator)) {
        return null
      }

      // registerSW() (main.ts) registers the service worker on page load in
      // both dev and production — prefer it over a manual /sw.js registration.
      for (let attempt = 0; attempt < 4; attempt++) {
        const existing = await navigator.serviceWorker.getRegistration()
        if (existing) {
          return existing
        }
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      try {
        return await navigator.serviceWorker.register('/sw.js')
      } catch (error) {
        console.warn('Service worker registration failed', error)
        return null
      }
    })()
  }
  return registrationPromise
}

function waitForActive(
  registration: ServiceWorkerRegistration | null,
  timeoutMs = 8000,
): Promise<ServiceWorkerRegistration | null> {
  if (!registration) {
    return Promise.resolve(null)
  }

  if (registration.active) {
    return Promise.resolve(registration)
  }

  const started = Date.now()

  return new Promise<ServiceWorkerRegistration | null>((resolve) => {
    const check = () => {
      if (registration.active) {
        resolve(registration)
        return
      }

      if (Date.now() - started >= timeoutMs) {
        resolve(null)
        return
      }

      setTimeout(check, 100)
    }

    check()
  })
}

export interface PushState {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
  loading: boolean
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) {
    return { supported: false, permission: 'unsupported', subscribed: false, loading: false }
  }

  const permission = Notification.permission

  try {
    const registration = await waitForActive(await ensureRegistration())
    const subscription = registration ? await registration.pushManager.getSubscription() : null
    return { supported: true, permission, subscribed: !!subscription, loading: false }
  } catch {
    return { supported: true, permission, subscribed: false, loading: false }
  }
}

export async function subscribeToPush(): Promise<boolean> {
  if (!pushSupported() || !VAPID_PUBLIC_KEY) {
    return false
  }

  try {
    const registration = await waitForActive(await ensureRegistration())

    if (!registration) {
      return false
    }

    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          VAPID_PUBLIC_KEY,
        ) as Uint8Array<ArrayBuffer>,
      })
    }

    if (subscription) {
      await sendSubscriptionToServer(subscription.toJSON() as unknown as PushSubscriptionLike)
      return true
    }

    return false
  } catch (error) {
    console.warn('Push subscription failed', error)
    return false
  }
}

async function sendSubscriptionToServer(subscription: PushSubscriptionLike): Promise<void> {
  await api.put('/notifications/push-token', {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
  })
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!pushSupported()) {
    return false
  }

  try {
    const registration = await waitForActive(await ensureRegistration())

    if (!registration) {
      return true
    }

    const subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      return true
    }

    const endpoint = subscription.endpoint

    try {
      await api.delete('/notifications/push-subscription', { data: { endpoint } })
    } catch {
      /* ignore server sync failures; still unsubscribe locally */
    }

    await subscription.unsubscribe()
    return true
  } catch (error) {
    console.warn('Push unsubscribe failed', error)
    return false
  }
}
