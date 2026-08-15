import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute, Route } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

clientsClaim()

self.skipWaiting()

const manifestEntries = self.__WB_MANIFEST

precacheAndRoute(manifestEntries)

// In dev (devOptions.enabled) the precache manifest is empty, so 'index.html'
// is not precached and createHandlerBoundToURL would throw. Only install the
// navigation handler when 'index.html' is actually precached (production).
const hasIndex = (manifestEntries || []).some((entry) =>
  typeof entry === 'string' ? entry === 'index.html' : entry.url === 'index.html',
)

if (hasIndex) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))
}

registerRoute(
  new Route(
    ({ url }) => url.href.includes('/api/'),
    new NetworkFirst({
      cacheName: 'api-cache',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24,
        }),
      ],
      networkTimeoutSeconds: 5,
    }),
  ),
)

// Face-model weights only change with a new app version; cache them on first
// use so face verification keeps working offline.
registerRoute(
  new Route(
    ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/models/'),
    new CacheFirst({
      cacheName: 'face-models',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 20,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        }),
      ],
    }),
  ),
)

self.addEventListener('push', (event) => {
  if (!(self.Notification && self.Notification.permission === 'granted')) {
    return
  }

  let data: { title?: string; body?: string; icon?: string; badge?: string; url?: string } | null = null

  try {
    data = event.data ? event.data.json() : null
  } catch {
    data = null
  }

  const title = data?.title || 'LuxMap Notification'
  const options: NotificationOptions = {
    body: data?.body || '',
    icon: data?.icon || '/icons/icon.png',
    badge: data?.badge || '/icons/icon.png',
    data: { url: data?.url || '/notifications' },
    vibrate: [200, 100, 200],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/notifications'

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const windowClients = allClients as WindowClient[]

      for (const client of windowClients) {
        if ('focus' in client) {
          try {
            await client.navigate(url)
          } catch {
            /* navigation only works on same-origin pages */
          }
          return client.focus()
        }
      }

      await self.clients.openWindow(url)
    })(),
  )
})