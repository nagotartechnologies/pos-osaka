"use client"

import { useState, useEffect, useRef } from "react"
import { Bell, AlertTriangle, XCircle, Info, Check, Trash2, BarChart3, ShoppingBag } from "lucide-react"
import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  clearNotifications,
  requestPermission,
  checkInventoryStock,
  checkDailySalesSummary,
  type AppNotification,
} from "@/lib/notifications"
import { getInventory, peekInventoryCache } from "@/lib/supabase-inventory"

const ICON_MAP: Record<string, typeof AlertTriangle> = {
  "stock-bajo": AlertTriangle,
  "pedido-cancelado": XCircle,
  "resumen-ventas": BarChart3,
  "nuevo-pedido": ShoppingBag,
  info: Info,
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  "stock-bajo": { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/20" },
  "pedido-cancelado": { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/20" },
  "resumen-ventas": { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/20" },
  "nuevo-pedido": { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/20" },
  info: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/20" },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Ahora"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const refresh = () => {
    setNotifications(getNotifications())
    setUnread(getUnreadCount())
  }

  useEffect(() => {
    // Pedir permiso de notificaciones al montar
    requestPermission()
    refresh()

    // Refrescar cada 5 segundos para ver nuevas notificaciones
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [])

  // Chequeo de stock bajo. Reutiliza el cache de inventario si ya está cargado
  // (0 egress); solo descarga como fallback. Intervalo de 15 min en lugar de 5
  // para reducir el tráfico de salida que Supabase factura.
  useEffect(() => {
    const checkStock = async () => {
      try {
        const items = peekInventoryCache() ?? await getInventory()
        if (items.length > 0) {
          checkInventoryStock(items.map((i) => ({
            id: i.id,
            name: i.name,
            stock: i.stock,
            minStock: i.min_stock,
            unit: i.unit,
          })))
          refresh()
        }
      } catch {}
    }

    checkStock()

    const interval = setInterval(checkStock, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Chequeo de resumen diario de ventas (cada 10 minutos)
  useEffect(() => {
    const checkSummary = async () => {
      await checkDailySalesSummary()
      refresh()
    }
    checkSummary()
    const interval = setInterval(checkSummary, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleOpen = () => {
    setOpen(!open)
    if (!open) {
      markAllAsRead()
      setTimeout(refresh, 100)
    }
  }

  const handleClear = () => {
    clearNotifications()
    refresh()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-card border border-border shadow-sm hover:bg-accent transition-colors"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-bold text-card-foreground">Notificaciones</h3>
            {notifications.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                Limpiar
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">Sin notificaciones</p>
              </div>
            ) : (
              notifications.slice(0, 20).map((notif) => {
                const Icon = ICON_MAP[notif.type] || Info
                const colors = COLOR_MAP[notif.type] || COLOR_MAP.info
                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors ${
                      !notif.read ? "bg-accent/30" : ""
                    }`}
                  >
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${colors.bg} ${colors.border} border`}>
                      <Icon className={`h-4 w-4 ${colors.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-card-foreground">{notif.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{notif.body}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(notif.timestamp)}</p>
                    </div>
                    {!notif.read && (
                      <div className="flex-shrink-0 mt-1">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
