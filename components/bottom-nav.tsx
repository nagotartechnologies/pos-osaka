"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { TrendingUp, ClipboardList, LayoutDashboard, BookOpen, Warehouse, DollarSign, Settings, LogOut, ShoppingBag, MessageCircle } from "lucide-react"
import { getUserRole, clearSession, type UserRole } from "@/lib/config-store"
import { useEffect, useState } from "react"
import { subscribeToOrders } from "@/lib/supabase-orders"
import { getAllConfig } from "@/lib/supabase-config"

const allNavItems = [
  { href: "/", label: "Ventas", icon: TrendingUp, roles: ["admin", "vendedor"] as UserRole[] },
  { href: "/pos", label: "Caja", icon: ShoppingBag, roles: ["admin", "vendedor"] as UserRole[] },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList, roles: ["admin", "vendedor"] as UserRole[] },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, roles: ["admin", "vendedor"] as UserRole[] },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] as UserRole[] },
  { href: "/menu", label: "Menú", icon: BookOpen, roles: ["admin"] as UserRole[] },
  { href: "/inventario", label: "Inventario", icon: Warehouse, roles: ["admin"] as UserRole[] },
  { href: "/finanzas", label: "Finanzas", icon: DollarSign, roles: ["admin"] as UserRole[] },
  { href: "/configuracion", label: "Config", icon: Settings, roles: ["admin"] as UserRole[] },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<UserRole>("admin")
  const [pendingOrders, setPendingOrders] = useState(0)

  useEffect(() => {
    setRole(getUserRole())
  }, [])

  // Estado del día (lastDayStart / lastDayClose)
  const [bizDayStart, setBizDayStart] = useState<string>("")
  const [dayIsOpen, setDayIsOpen] = useState(false)
  useEffect(() => {
    const loadDay = async () => {
      const cfg = await getAllConfig()
      const start = cfg.lastDayStart || ""
      const close = cfg.lastDayClose || ""
      setBizDayStart(start)
      setDayIsOpen(!!start && (!close || close <= start))
    }
    loadDay()
    const onStorage = (e: StorageEvent) => {
      if (e.key === "pos-osaka-config-invalidate") loadDay()
    }
    window.addEventListener("storage", onStorage)
    // Poll espaciado (3 min): el estado del día cambia ~2 veces al día y los
    // cambios locales ya llegan por el evento `storage`. Antes era cada 30s, lo
    // que multiplicaba el egress de Supabase (getAllConfig) sin necesidad.
    const interval = setInterval(loadDay, 180_000)
    return () => { window.removeEventListener("storage", onStorage); clearInterval(interval) }
  }, [])

  // Realtime: contar pedidos recibidos del día activo
  useEffect(() => {
    const unsub = subscribeToOrders((orders) => {
      if (!dayIsOpen || !bizDayStart) { setPendingOrders(0); return }
      const count = orders.filter((o) => o.status === "recibido" && o.created_at >= bizDayStart).length
      setPendingOrders(count)
    })
    return () => unsub()
  }, [dayIsOpen, bizDayStart])

  const navItems = allNavItems.filter(item => item.roles.includes(role))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-border bg-card/95 backdrop-blur-lg safe-area-bottom">
      <div className="flex items-center justify-around px-1 py-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 min-w-0 flex-1 transition-all duration-200 ease-out ${
                isActive
                  ? "text-primary scale-[1.08]"
                  : "text-muted-foreground active:scale-95 active:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 transition-all duration-200 ${isActive ? "stroke-[2.5] drop-shadow-sm" : ""}`} />
                {item.href === "/pedidos" && pendingOrders > 0 && (
                  <span className="absolute -top-1 -right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-black text-white animate-pulse">
                    {pendingOrders}
                  </span>
                )}
              </div>
              <span className={`text-[10px] leading-tight truncate transition-all duration-200 ${isActive ? "font-bold" : "font-medium"}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
        <button
          onClick={() => { clearSession(); router.replace("/login") }}
          className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 min-w-0 flex-1 transition-all duration-200 ease-out text-muted-foreground active:scale-95 active:text-red-500"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-[10px] leading-tight font-medium">Salir</span>
        </button>
      </div>
    </nav>
  )
}
