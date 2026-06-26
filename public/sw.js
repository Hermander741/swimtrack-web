import { precacheAndRoute } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'Mermaids', {
      body: data.body,
      icon: data.icon || '/mermaids-logo.svg',
      badge: data.badge || '/mermaids-logo.svg',
      data: data.data,
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const channelId = event.notification.data?.channelId
  const url = channelId ? `/chat?channel=${channelId}` : '/chat'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const focused = clientList.find(c => c.visibilityState === 'visible') ?? clientList[0]
      if (focused) {
        focused.navigate(url)
        return focused.focus()
      }
      return clients.openWindow(url)
    })
  )
})
