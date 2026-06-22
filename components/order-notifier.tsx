"use client"

import { useEffect } from "react"
import { subscribeToOrderEvents } from "@/lib/supabase-orders"
import { addNotification, requestPermission } from "@/lib/notifications"
import { isAuthenticated } from "@/lib/config-store"

/**
 * Componente global que escucha Supabase Realtime para nuevos pedidos
 * y envía notificaciones push nativas al dispositivo.
 * Se monta en el layout para funcionar en todas las páginas.
 */
export function OrderNotifier() {
  useEffect(() => {
    if (!isAuthenticated()) return

    // Pedir permisos de notificación al montar
    requestPermission()

    // Reusa el canal Realtime compartido de orders (sin abrir uno adicional).
    const unsub = subscribeToOrderEvents((event, newRow) => {
      if (!newRow) return

      if (event === "INSERT") {
        const order = newRow as {
          client_name: string
          total: number
          delivery_type: string
          items: { quantity: number }[]
        }
        const itemCount = Array.isArray(order.items)
          ? order.items.reduce((s, i) => s + (i.quantity || 1), 0)
          : 0
        const deliveryLabel = order.delivery_type === "delivery" ? "🛵 Delivery" : "🏪 Retiro"
        const totalFmt = Number(order.total).toLocaleString("es-CL")
        addNotification(
          "nuevo-pedido",
          "🔔 Nuevo pedido",
          `${order.client_name} — ${itemCount} producto${itemCount !== 1 ? "s" : ""} · $${totalFmt} · ${deliveryLabel}`
        )
      } else if (event === "UPDATE") {
        const order = newRow as { client_name: string; total: number; status: string }
        if (order.status === "preparando") {
          const totalFmt = Number(order.total).toLocaleString("es-CL")
          addNotification(
            "info",
            "👨‍🍳 Pedido en preparación",
            `${order.client_name} — $${totalFmt} está siendo preparado`
          )
        }
      }
    })

    return () => unsub()
  }, [])

  return <></>
}
