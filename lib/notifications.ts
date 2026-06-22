/**
 * Sistema de notificaciones push locales (Notification API).
 * Frontend-only — no requiere backend.
 */

export type NotificationType = "stock-bajo" | "pedido-cancelado" | "resumen-ventas" | "nuevo-pedido" | "info"

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  timestamp: string
  read: boolean
}

const NOTIF_KEY = "pos-osaka-notifications"
const NOTIFIED_STOCK_KEY = "pos-osaka-notified-stock"
const DAILY_SUMMARY_KEY = "pos-osaka-daily-summary-date"

// ── Permisos ──

export function getPermissionStatus(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported"
  return Notification.permission
}

export async function requestPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false
  if (Notification.permission === "granted") return true
  if (Notification.permission === "denied") return false
  const result = await Notification.requestPermission()
  return result === "granted"
}

// ── Enviar notificación nativa ──

function getBusinessLogo(): string {
  if (typeof window === "undefined") return "/icon-192.png"
  try {
    return localStorage.getItem("pos-osaka-logo") || "/icon-192.png"
  } catch {
    return "/icon-192.png"
  }
}

export function sendNativeNotification(title: string, body: string, icon?: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return

  const logoIcon = icon || getBusinessLogo()
  const tag = `osaka-${Date.now()}`

  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        const opts: NotificationOptions & Record<string, unknown> = {
          body,
          icon: logoIcon,
          badge: "/icon-192.png",
          tag,
          data: { url: "/pedidos" },
        }
        // vibrate y renotify son válidos en la Web API pero no en los tipos TS
        opts.vibrate = [200, 100, 200]
        opts.renotify = true
        reg.showNotification(title, opts)
      })
    } else {
      new Notification(title, {
        body,
        icon: logoIcon,
        tag,
      })
    }
  } catch {
    // Fallback silencioso
  }
}

// ── Historial de notificaciones (localStorage) ──

export function getNotifications(): AppNotification[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(NOTIF_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveNotifications(notifs: AppNotification[]): void {
  if (typeof window === "undefined") return
  // Mantener máximo 50 notificaciones
  const trimmed = notifs.slice(0, 50)
  localStorage.setItem(NOTIF_KEY, JSON.stringify(trimmed))
}

export function addNotification(type: NotificationType, title: string, body: string): AppNotification {
  const notif: AppNotification = {
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    title,
    body,
    timestamp: new Date().toISOString(),
    read: false,
  }
  const all = getNotifications()
  all.unshift(notif)
  saveNotifications(all)

  // También enviar push nativa
  sendNativeNotification(title, body)

  return notif
}

export function markAsRead(id: string): void {
  const all = getNotifications()
  const idx = all.findIndex((n) => n.id === id)
  if (idx !== -1) {
    all[idx].read = true
    saveNotifications(all)
  }
}

export function markAllAsRead(): void {
  const all = getNotifications()
  all.forEach((n) => (n.read = true))
  saveNotifications(all)
}

export function getUnreadCount(): number {
  return getNotifications().filter((n) => !n.read).length
}

export function clearNotifications(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(NOTIF_KEY)
}

// ── Stock bajo — control anti-spam ──

interface NotifiedStockRecord {
  [itemId: string]: number // timestamp de última notificación
}

function getNotifiedStock(): NotifiedStockRecord {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(NOTIFIED_STOCK_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveNotifiedStock(record: NotifiedStockRecord): void {
  if (typeof window === "undefined") return
  localStorage.setItem(NOTIFIED_STOCK_KEY, JSON.stringify(record))
}

const ONE_HOUR = 60 * 60 * 1000

/**
 * Notifica stock bajo para un item específico.
 * No repite la notificación si ya se notificó en la última hora.
 */
export function notifyLowStock(itemId: string, itemName: string, stock: number, minStock: number, unit: string): void {
  const record = getNotifiedStock()
  const lastNotified = record[itemId] || 0
  if (Date.now() - lastNotified < ONE_HOUR) return

  record[itemId] = Date.now()
  saveNotifiedStock(record)

  addNotification(
    "stock-bajo",
    "⚠️ Stock bajo",
    `${itemName}: ${stock} ${unit} (mínimo: ${minStock} ${unit})`
  )
}

/**
 * Revisa un array de items de inventario y notifica los que están bajo mínimo.
 */
export function checkInventoryStock(items: { id: string; name: string; stock: number; minStock: number; unit: string }[]): void {
  items.forEach((item) => {
    if (item.stock <= item.minStock) {
      notifyLowStock(item.id, item.name, item.stock, item.minStock, item.unit)
    }
  })
}

/**
 * Notifica que un pedido fue cancelado.
 */
export function notifyOrderCancelled(orderId: string, clientName: string): void {
  addNotification(
    "pedido-cancelado",
    "❌ Pedido cancelado",
    `Pedido ${orderId} de ${clientName} fue cancelado`
  )
}

// ── Resumen diario de ventas ──

/**
 * Verifica si ya pasó la hora de cierre (por defecto 23:00) y envía
 * una notificación con el resumen de ventas del día.
 * Solo se envía una vez por día.
 */
export async function checkDailySalesSummary(closingHour = 23): Promise<void> {
  if (typeof window === "undefined") return

  const now = new Date()
  const currentHour = now.getHours()
  if (currentHour < closingHour) return

  const todayStr = now.toISOString().slice(0, 10)
  const lastSummary = localStorage.getItem(DAILY_SUMMARY_KEY)
  if (lastSummary === todayStr) return

  try {
    const { getTodaySales } = await import("@/lib/supabase-orders")
    const { total, count } = await getTodaySales()

    localStorage.setItem(DAILY_SUMMARY_KEY, todayStr)

    const totalFmt = total.toLocaleString("es-CL")
    addNotification(
      "resumen-ventas",
      "📊 Resumen del día",
      count > 0
        ? `Hoy se realizaron ${count} pedido${count !== 1 ? "s" : ""} por un total de $${totalFmt}`
        : "No hubo ventas registradas hoy"
    )
  } catch {
    // Si falla Supabase, no bloquear
  }
}
