"use client"

import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { LayoutDashboard, TrendingUp, Settings, UtensilsCrossed, BookOpen, Sun, Moon, Warehouse, DollarSign, LogOut, ClipboardList, ShoppingBag, MessageCircle } from "lucide-react"
import { loadLogoForTheme, clearSession, getUserRole, type UserRole } from "@/lib/config-store"
import { LiveClock } from "@/components/live-clock"
import { subscribeToOrders } from "@/lib/supabase-orders"
import { getAllConfig } from "@/lib/supabase-config"
import { getUnreadCounts, subscribeToChatMessages, type ChatMessage } from "@/lib/supabase-chat"

const allNavItems = [
  { href: "/", label: "Ventas", icon: TrendingUp, roles: ["admin", "vendedor"] as UserRole[] },
  { href: "/pos", label: "Caja", icon: ShoppingBag, roles: ["admin", "vendedor"] as UserRole[] },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList, roles: ["admin", "vendedor"] as UserRole[] },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, roles: ["admin", "vendedor"] as UserRole[] },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] as UserRole[] },
  { href: "/menu", label: "Menú", icon: BookOpen, roles: ["admin"] as UserRole[] },
  { href: "/inventario", label: "Inventario", icon: Warehouse, roles: ["admin"] as UserRole[] },
  { href: "/finanzas", label: "Finanzas", icon: DollarSign, roles: ["admin"] as UserRole[] },
  { href: "/configuracion", label: "Configuración", icon: Settings, roles: ["admin"] as UserRole[] },
]

export function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [logo, setLogo] = useState("")
  const [pendingOrders, setPendingOrders] = useState(0)
  const [unreadChats, setUnreadChats] = useState(0)
  const [role, setRole] = useState<UserRole>("admin")

  // Cargar logo: primero localStorage (rápido), luego Supabase config como fallback
  const refreshLogo = useCallback(async () => {
    const localLogo = loadLogoForTheme(resolvedTheme)
    if (localLogo) {
      setLogo(localLogo)
      return
    }
    // Fallback: usar la URL pública del logo (liviana). El base64 ya no viene
    // en getAllConfig para no inflar el egress.
    const cfg = await getAllConfig()
    const supaLogo = cfg.logoPublicUrl
    if (supaLogo) setLogo(supaLogo)
  }, [resolvedTheme])

  useEffect(() => {
    setMounted(true)
    setRole(getUserRole())
    refreshLogo()

    const handleStorage = () => refreshLogo()
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [refreshLogo])

  // Actualizar logo cuando cambia el tema
  useEffect(() => {
    if (mounted) refreshLogo()
  }, [resolvedTheme, mounted, refreshLogo])

  // Cargar estado del día (lastDayStart / lastDayClose)
  const [bizDayStart, setBizDayStart] = useState<string>("")
  const [dayIsOpen, setDayIsOpen] = useState(false)
  useEffect(() => {
    const loadDay = async () => {
      const cfg = await getAllConfig()
      const start = cfg.lastDayStart || ""
      const close = cfg.lastDayClose || ""
      const open = !!start && (!close || close <= start)
      setBizDayStart(start)
      setDayIsOpen(open)
    }
    loadDay()
    // Re-cargar cuando OTRA pestaña invalida la config (al iniciar/cerrar día)
    const onStorage = (e: StorageEvent) => {
      if (e.key === "pos-osaka-config-invalidate") loadDay()
    }
    // Re-cargar cuando la MISMA pestaña cambia la config (sin polling)
    const onConfigChanged = () => loadDay()
    window.addEventListener("storage", onStorage)
    window.addEventListener("pos-osaka-config-changed", onConfigChanged)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("pos-osaka-config-changed", onConfigChanged)
    }
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

  // Realtime: contar chats no leídos del día activo
  useEffect(() => {
    if (!dayIsOpen || !bizDayStart) { setUnreadChats(0); return }
    getUnreadCounts(bizDayStart).then((counts) => {
      setUnreadChats(Object.values(counts).reduce((a, b) => a + b, 0))
    })
    const channel = subscribeToChatMessages((msg: ChatMessage) => {
      if (msg.direction === "incoming" && msg.created_at >= bizDayStart) {
        setUnreadChats((prev) => prev + 1)
      }
    })
    return () => { channel.unsubscribe() }
  }, [dayIsOpen, bizDayStart])

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <nav className="fixed left-0 top-0 bottom-0 z-40 hidden md:flex w-[72px] flex-col items-center bg-card border-r border-border py-4 gap-2">
      {/* Logo */}
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-4 overflow-hidden">
        {logo ? (
          <Image
            src={logo}
            alt="Logo"
            width={48}
            height={48}
            className="h-full w-full object-contain p-1"
          />
        ) : (
          <UtensilsCrossed className="h-6 w-6" />
        )}
      </div>

      {/* Rol badge */}
      <div className={`flex items-center justify-center rounded-lg px-2 py-1 mb-1 text-[8px] font-bold uppercase tracking-wider ${
        role === "admin" ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"
      }`}>
        {role === "admin" ? "Admin" : "Venta"}
      </div>

      {/* Reloj */}
      <LiveClock className="mb-2" />

      {/* Nav Items */}
      <div className="flex flex-1 flex-col items-center gap-1">
        {allNavItems.filter(item => item.roles.includes(role)).map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href === "/pedidos" && pendingOrders === 0 && unreadChats > 0 ? "/pedidos?tab=chats" : item.href}
              className={`group flex flex-col items-center gap-1 rounded-xl p-2.5 w-[60px] transition-all duration-200 ease-out ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md scale-[1.04]"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] active:scale-95"
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 transition-transform duration-200 ${isActive ? "" : "group-hover:scale-110"}`} />
                {item.href === "/pedidos" && pendingOrders > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-black text-white shadow-sm animate-pulse">
                    {pendingOrders}
                  </span>
                )}
                {item.href === "/pedidos" && pendingOrders === 0 && unreadChats > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[8px] font-black text-white shadow-sm animate-pulse">
                    {unreadChats}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-medium leading-tight text-center">{item.label}</span>
            </Link>
          )
        })}
      </div>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="flex flex-col items-center gap-1 rounded-xl p-2.5 transition-all duration-200 ease-out w-[60px] text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] active:scale-95"
        aria-label="Cambiar tema"
      >
        {mounted ? (
          resolvedTheme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )
        ) : (
          <Sun className="h-5 w-5" />
        )}
        <span className="text-[9px] font-medium leading-tight text-center">
          {mounted ? (resolvedTheme === "dark" ? "Claro" : "Oscuro") : "Tema"}
        </span>
      </button>

      {/* Cerrar sesión */}
      <button
        onClick={() => { clearSession(); router.replace("/login") }}
        className="flex flex-col items-center gap-1 rounded-xl p-2.5 transition-all duration-200 ease-out w-[60px] text-muted-foreground hover:bg-red-500/10 hover:text-red-500 hover:scale-[1.02] active:scale-95"
        aria-label="Cerrar sesión"
      >
        <LogOut className="h-5 w-5" />
        <span className="text-[9px] font-medium leading-tight text-center">Salir</span>
      </button>
    </nav>
  )
}
