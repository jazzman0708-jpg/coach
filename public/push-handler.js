// 서비스워커에 붙는 푸시 처리. vite.config.ts의 workbox.importScripts로 sw.js에서 불러온다.
// 아이폰은 푸시를 받으면 반드시 알림을 보여줘야 하므로(안 보여주면 권한이 끊길 수 있음) 항상 표시한다.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || '코치'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || 'coach',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { url: data.url || './' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || './', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target).catch(() => undefined)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
