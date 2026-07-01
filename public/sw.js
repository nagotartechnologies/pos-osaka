const CACHE_NAME = "osaka-pos-v3"

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim())
})

// Manejar click en notificación — abrir/enfocar la app
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  // Determinar URL según el tag de la notificación
  const url = event.notification.data?.url || "/pedidos"

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una ventana abierta, enfocarla y navegar
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      // Si no hay ventana, abrir una nueva
      return clients.openWindow(url)
    })
  )
})

// Manejar push events (para futuro uso con push server)
self.addEventListener("push", (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()
    const options = {
      body: data.body || "",
      icon: data.icon || "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 100, 200],
      tag: data.tag || "osaka-notification",
      data: { url: data.url || "/pedidos" },
    }
    event.waitUntil(self.registration.showNotification(data.title || "Osaka POS", options))
  } catch (e) {
    // Fallback si no es JSON
    event.waitUntil(
      self.registration.showNotification("Osaka POS", {
        body: event.data.text(),
        icon: "/icon-192.png",
      })
    )
  }
})
