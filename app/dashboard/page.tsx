"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import dynamic from "next/dynamic"
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CalendarDays,
} from "lucide-react"
import { subscribeToOrders, getOrdersByDateRange, type SupabaseOrder } from "@/lib/supabase-orders"

const DashboardCharts = dynamic(() => import("./charts"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-4">
        <div className="lg:col-span-2 h-[300px] rounded-2xl bg-card border border-border animate-pulse" />
        <div className="h-[300px] rounded-2xl bg-card border border-border animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-4">
        <div className="lg:col-span-2 h-[300px] rounded-2xl bg-card border border-border animate-pulse" />
        <div className="h-[300px] rounded-2xl bg-card border border-border animate-pulse" />
      </div>
      <div className="h-[340px] rounded-2xl bg-card border border-border animate-pulse" />
    </div>
  ),
})

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"]

type Period = "hoy" | "semana" | "mes" | "todo"

function getPeriodRange(period: Period): { start: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date()
  const start = new Date(now)
  const prevStart = new Date(now)
  const prevEnd = new Date(now)

  if (period === "hoy") {
    start.setHours(0, 0, 0, 0)
    prevEnd.setHours(0, 0, 0, 0)
    prevStart.setDate(prevStart.getDate() - 1)
    prevStart.setHours(0, 0, 0, 0)
  } else if (period === "semana") {
    start.setDate(now.getDate() - 7)
    start.setHours(0, 0, 0, 0)
    prevEnd.setDate(now.getDate() - 7)
    prevEnd.setHours(0, 0, 0, 0)
    prevStart.setDate(now.getDate() - 14)
    prevStart.setHours(0, 0, 0, 0)
  } else if (period === "mes") {
    start.setDate(now.getDate() - 30)
    start.setHours(0, 0, 0, 0)
    prevEnd.setDate(now.getDate() - 30)
    prevEnd.setHours(0, 0, 0, 0)
    prevStart.setDate(now.getDate() - 60)
    prevStart.setHours(0, 0, 0, 0)
  } else {
    start.setFullYear(2000)
    prevStart.setFullYear(2000)
    prevEnd.setFullYear(2000)
  }
  return { start, prevStart, prevEnd }
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<SupabaseOrder[]>([])
  const [allTimeOrders, setAllTimeOrders] = useState<SupabaseOrder[] | null>(null)
  const [period, setPeriod] = useState<Period>("semana")

  useEffect(() => {
    const unsub = subscribeToOrders((data) => setOrders(data))
    return () => unsub()
  }, [])

  // Cargar historial de 90 días solo cuando se selecciona "todo"
  useEffect(() => {
    if (period !== "todo" || allTimeOrders) return
    getOrdersByDateRange(90).then(setAllTimeOrders)
  }, [period, allTimeOrders])

  const effectiveOrders = period === "todo" && allTimeOrders ? allTimeOrders : orders
  const completedOrders = useMemo(() => effectiveOrders.filter((o) => o.status === "entregado"), [effectiveOrders])

  const { filteredCompleted, prevCompleted } = useMemo(() => {
    if (period === "todo") return { filteredCompleted: completedOrders, prevCompleted: [] as SupabaseOrder[] }
    const { start, prevStart, prevEnd } = getPeriodRange(period)
    const startISO = start.toISOString()
    const prevStartISO = prevStart.toISOString()
    const prevEndISO = prevEnd.toISOString()
    return {
      filteredCompleted: completedOrders.filter((o) => o.created_at >= startISO),
      prevCompleted: completedOrders.filter((o) => o.created_at >= prevStartISO && o.created_at < prevEndISO),
    }
  }, [completedOrders, period])

  const filteredOrders = useMemo(() => {
    if (period === "todo") return effectiveOrders
    const { start } = getPeriodRange(period)
    const startISO = start.toISOString()
    return effectiveOrders.filter((o) => o.created_at >= startISO)
  }, [effectiveOrders, period])

  const calcChange = useCallback((current: number, prev: number) => {
    if (prev === 0) return current > 0 ? "+100%" : "0%"
    const pct = ((current - prev) / prev) * 100
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`
  }, [])

  // Calcular estadísticas
  const stats = useMemo(() => {
    const totalVentas = filteredCompleted.reduce((sum, o) => sum + Number(o.total), 0)
    const totalPedidos = filteredCompleted.length
    const ticketPromedio = totalPedidos > 0 ? totalVentas / totalPedidos : 0
    const todayStr = new Date().toISOString().split("T")[0]
    const pedidosHoy = orders.filter((o) => o.created_at.startsWith(todayStr)).length

    const prevVentas = prevCompleted.reduce((sum, o) => sum + Number(o.total), 0)
    const prevPedidos = prevCompleted.length
    const prevTicket = prevPedidos > 0 ? prevVentas / prevPedidos : 0

    return {
      totalVentas, totalPedidos, ticketPromedio, pedidosHoy,
      changeVentas: calcChange(totalVentas, prevVentas),
      changePedidos: calcChange(totalPedidos, prevPedidos),
      changeTicket: calcChange(ticketPromedio, prevTicket),
    }
  }, [filteredCompleted, prevCompleted, orders, calcChange])

  // Ventas por día (últimos 7 días)
  const ventasPorDia = useMemo(() => {
    const result: { dia: string; ventas: number; pedidos: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split("T")[0]
      const label = d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
      const ordenesDia = completedOrders.filter((o) => o.created_at.startsWith(dateStr))
      result.push({
        dia: label,
        ventas: parseFloat(ordenesDia.reduce((sum, o) => sum + Number(o.total), 0).toFixed(0)),
        pedidos: ordenesDia.length,
      })
    }
    return result
  }, [completedOrders])

  // Productos más vendidos
  const productosMasVendidos = useMemo(() => {
    const conteo: Record<string, { nombre: string; cantidad: number; ingresos: number }> = {}
    filteredCompleted.forEach((order) => {
      order.items.forEach((item: any) => {
        if (!conteo[item.id]) {
          conteo[item.id] = { nombre: item.name, cantidad: 0, ingresos: 0 }
        }
        conteo[item.id].cantidad += item.quantity
        conteo[item.id].ingresos += item.price * item.quantity
      })
    })
    return Object.values(conteo)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 6)
  }, [filteredCompleted])

  // Distribución por método de pago
  const metodosPago = useMemo(() => {
    const conteo: Record<string, number> = {}
    filteredCompleted.forEach((o) => {
      const label =
        o.payment_method === "efectivo"
          ? "Efectivo"
          : o.payment_method === "tarjeta"
          ? "Tarjeta"
          : "Transferencia"
      conteo[label] = (conteo[label] || 0) + Number(o.total)
    })
    return Object.entries(conteo).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(0)),
    }))
  }, [filteredCompleted])

  // Distribución por tipo de orden
  const tiposOrden = useMemo(() => {
    const delivery = filteredOrders.filter((o) => o.delivery_type === "delivery").length
    const retiro = filteredOrders.filter((o) => o.delivery_type === "retiro").length
    return [
      { name: "Delivery", value: delivery },
      { name: "Retiro", value: retiro },
    ]
  }, [filteredOrders])

  // Ingresos acumulados por día (últimos 7 días)
  const ingresosAcumulados = useMemo(() => {
    const result: { dia: string; acumulado: number }[] = []
    let acumulado = 0
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split("T")[0]
      const label = d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" })
      const ordenesDia = completedOrders.filter((o) => o.created_at.startsWith(dateStr))
      acumulado += ordenesDia.reduce((sum, o) => sum + Number(o.total), 0)
      result.push({ dia: label, acumulado: parseFloat(acumulado.toFixed(0)) })
    }
    return result
  }, [completedOrders])

  // Últimos pedidos
  const ultimosPedidos = useMemo(() => {
    return orders.slice(0, 5)
  }, [orders])

  const formatHora = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Resumen general de ventas y rendimiento</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
          {(["hoy", "semana", "mes", "todo"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex items-center gap-1 rounded-lg px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {p === "hoy" && <CalendarDays className="h-3 w-3 hidden sm:block" />}
              {p === "hoy" ? "Hoy" : p === "semana" ? "7 días" : p === "mes" ? "30 días" : "Todo"}
            </button>
          ))}
        </div>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <StatCard
          title="Ventas Totales"
          value={`$ ${stats.totalVentas.toLocaleString("es-CL")}`}
          change={stats.changeVentas}
          positive={stats.changeVentas.startsWith("+")}
          icon={<DollarSign className="h-5 w-5" />}
          hideBadge={period === "todo"}
        />
        <StatCard
          title="Total Pedidos"
          value={stats.totalPedidos.toString()}
          change={stats.changePedidos}
          positive={stats.changePedidos.startsWith("+")}
          icon={<ShoppingBag className="h-5 w-5" />}
          hideBadge={period === "todo"}
        />
        <StatCard
          title="Ticket Promedio"
          value={`$ ${stats.ticketPromedio.toLocaleString("es-CL", { maximumFractionDigits: 0 })}`}
          change={stats.changeTicket}
          positive={stats.changeTicket.startsWith("+")}
          icon={<TrendingUp className="h-5 w-5" />}
          hideBadge={period === "todo"}
        />
        <StatCard
          title="Pedidos Hoy"
          value={stats.pedidosHoy.toString()}
          change=""
          positive
          icon={<CreditCard className="h-5 w-5" />}
          hideBadge
        />
      </div>

      {filteredCompleted.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 sm:p-12 flex flex-col items-center justify-center text-center mb-4 sm:mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
            <ShoppingBag className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-card-foreground mb-1">Sin ventas en este período</h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            {period === "hoy" ? "Aún no hay pedidos entregados hoy." : period === "semana" ? "No hay ventas en los últimos 7 días." : period === "mes" ? "No hay ventas en los últimos 30 días." : "No hay pedidos entregados registrados."}
            {" "}Los datos se actualizan en tiempo real.
          </p>
        </div>
      )}

      {/* Gráficos lazy — se cargan después de las tarjetas y la tabla */}
      <DashboardCharts
        ventasPorDia={ventasPorDia}
        metodosPago={metodosPago}
        ingresosAcumulados={ingresosAcumulados}
        tiposOrden={tiposOrden}
        productosMasVendidos={productosMasVendidos}
      />

      <div className="grid grid-cols-1 gap-2 sm:gap-4 mt-4 sm:mt-6">
        <div className="rounded-2xl bg-card p-3 sm:p-5 shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-card-foreground mb-3 sm:mb-4">Últimos Pedidos</h3>
          <div className="space-y-3">
            {ultimosPedidos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin pedidos aún</p>
            ) : ultimosPedidos.map((pedido) => (
              <div
                key={pedido.id}
                className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{pedido.client_name || pedido.id.slice(0, 8)}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {pedido.items.reduce((s: number, i: any) => s + i.quantity, 0)} productos
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className={`text-xs font-medium ${
                        pedido.delivery_type === "delivery" ? "text-amber-500 dark:text-amber-400" : "text-emerald-500 dark:text-emerald-400"
                      }`}>
                        {pedido.delivery_type === "delivery" ? "Delivery" : "Retiro"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-card-foreground">$ {Number(pedido.total).toLocaleString("es-CL")}</p>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span className="text-xs">{formatHora(pedido.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


function StatCard({
  title,
  value,
  change,
  positive,
  icon,
  hideBadge = false,
}: {
  title: string
  value: string
  change: string
  positive: boolean
  icon: React.ReactNode
  hideBadge?: boolean
}) {
  return (
    <div className="rounded-2xl bg-card p-3 sm:p-5 shadow-sm border border-border">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-primary/10 text-primary [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5">
          {icon}
        </div>
        {!hideBadge && change && (
          <div
            className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
              positive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 text-red-500 dark:text-red-400"
            }`}
          >
            {positive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {change}
          </div>
        )}
      </div>
      <p className="text-lg sm:text-2xl font-bold text-card-foreground">{value}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{title}</p>
    </div>
  )
}
