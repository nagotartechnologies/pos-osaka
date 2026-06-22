"use client"

import { useState, useEffect, useMemo } from "react"
import { DollarSign, TrendingUp, Clock, Banknote, CreditCard, ArrowRightLeft, CheckCircle2, XCircle, Truck, Store, Package, Users, Share2, ShoppingBag, AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, FileDown, Send, LogOut, PlayCircle } from "lucide-react"
import { subscribeToOrders, getOrdersByDate, type SupabaseOrder } from "@/lib/supabase-orders"
import { loadBusinessName, isAuthenticated } from "@/lib/config-store"
import { getConfigValue, setConfigValue } from "@/lib/supabase-config"

function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export default function VentasPage() {
  const todayStr = useMemo(() => toLocalDateString(new Date()), [])

  const [allOrders, setAllOrders] = useState<SupabaseOrder[]>([])
  const [dateOrders, setDateOrders] = useState<SupabaseOrder[]>([])
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateString(new Date()))
  const [loadingDate, setLoadingDate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [businessName, setBusinessName] = useState("")
  const [cartaCode, setCartaCode] = useState("")
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [sendingWa, setSendingWa] = useState(false)
  const [waStatus, setWaStatus] = useState<"idle" | "ok" | "error">("idle")
  const [dayStart, setDayStart] = useState<string>("")
  const [openHour, setOpenHour] = useState<number>(0)
  const [dayClose, setDayClose] = useState<string>("")
  const [showStartConfirm, setShowStartConfirm] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [startingDay, setStartingDay] = useState(false)
  const [closingDay, setClosingDay] = useState(false)

  const isDayOpen = !!dayStart && (!dayClose || dayStart > dayClose)

  const isToday = selectedDate === todayStr

  useEffect(() => {
    if (!isAuthenticated()) return
    setBusinessName(loadBusinessName() || "Osaka")
    Promise.all([
      getConfigValue("cartaCode"),
      getConfigValue("lastDayStart"),
      getConfigValue("lastDayClose"),
      getConfigValue("horaApertura"),
    ]).then(([code, lastStart, lastClose, horaApertura]) => {
      if (code) setCartaCode(code)
      if (lastStart) setDayStart(lastStart)
      if (lastClose && lastStart && lastClose > lastStart) setDayClose(lastClose)
      if (horaApertura) {
        const [hh] = horaApertura.split(":").map(Number)
        setOpenHour(hh)
      }
    })
    const timeout = setTimeout(() => setLoading(false), 3000)
    const unsub = subscribeToOrders((data) => {
      clearTimeout(timeout)
      setAllOrders(data)
      setDataLoaded(true)
      setLoading(false)
    })
    return () => { unsub(); clearTimeout(timeout) }
  }, [])

  useEffect(() => {
    if (isToday) return
    setLoadingDate(true)
    getOrdersByDate(selectedDate, openHour).then((data) => {
      setDateOrders(data)
      setLoadingDate(false)
    })
  }, [selectedDate, isToday, openHour])

  const displayOrders = useMemo(() => {
    if (isToday) {
      // Solo mostrar pedidos cuando el día está abierto (iniciado y no cerrado)
      if (isDayOpen && dayStart) {
        return allOrders.filter(o => o.created_at >= dayStart)
      }
      // Día cerrado o no iniciado → empezar en 0
      return []
    }
    return dateOrders
  }, [isToday, allOrders, dateOrders, dayStart, isDayOpen])

  const completedOrders = useMemo(() => displayOrders.filter(o => o.status === "entregado"), [displayOrders])
  const activeOrders = useMemo(() => displayOrders.filter(o => o.status !== "entregado" && o.status !== "cancelado"), [displayOrders])
  const cancelledOrders = useMemo(() => displayOrders.filter(o => o.status === "cancelado"), [displayOrders])

  const stats = useMemo(() => {
    const totalVentas = completedOrders.reduce((s, o) => s + Number(o.total), 0)
    const ticketPromedio = completedOrders.length > 0 ? totalVentas / completedOrders.length : 0
    const totalItems = completedOrders.reduce((s, o) => s + o.items.reduce((si: number, i: any) => si + i.quantity, 0), 0)
    const byMethod = { efectivo: 0, transferencia: 0, tarjeta: 0 }
    completedOrders.forEach(o => { byMethod[o.payment_method as keyof typeof byMethod] += Number(o.total) })
    const byDelivery = { delivery: 0, retiro: 0 }
    displayOrders.forEach(o => { byDelivery[o.delivery_type as keyof typeof byDelivery]++ })
    return { totalVentas, ticketPromedio, totalItems, byMethod, byDelivery }
  }, [completedOrders, displayOrders])

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + "T12:00:00")
    d.setDate(d.getDate() + delta)
    const next = toLocalDateString(d)
    if (next <= todayStr) setSelectedDate(next)
  }

  const handleStartDay = async () => {
    setStartingDay(true)
    const now = new Date().toISOString()
    const ok = await setConfigValue("lastDayStart", now)
    if (ok) {
      setDayStart(now)
      setDayClose("")
      // Enviar mensajes post-venta a clientes de ayer
      fetch("/api/whatsapp/post-venta", {
        method: "POST",
        headers: { "x-internal-token": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" },
      }).catch(() => {})
    }
    setStartingDay(false)
    setShowStartConfirm(false)
  }

  const handleCloseDay = async () => {
    setClosingDay(true)
    const now = new Date().toISOString()
    const ok = await setConfigValue("lastDayClose", now)
    if (ok) {
      setDayClose(now)
      fetch("/api/whatsapp/daily-summary", { method: "POST", headers: { "x-internal-token": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" } }).catch(() => {})
    }
    setClosingDay(false)
    setShowCloseConfirm(false)
  }

  const handleShareCarta = () => {
    const url = `${window.location.origin}/carta/${cartaCode}`
    const msg = encodeURIComponent(`🍣 ¡Mira nuestra carta digital!\n\n👉 ${url}\n\n¡Te esperamos!`)
    window.open(`https://wa.me/?text=${msg}`, "_blank")
  }

  const buildPdfDoc = async () => {
    const { jsPDF } = await import("jspdf")
      const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      const doc = new jsPDF({ unit: "mm", format: "a4" })
      const W = 210
      const mg = 15
      const cw = W - mg * 2
      let y = 20

      doc.setFont("helvetica", "bold")
      doc.setFontSize(18)
      doc.text(businessName || "Osaka", W / 2, y, { align: "center" })
      y += 8
      doc.setFont("helvetica", "normal")
      doc.setFontSize(11)
      doc.text("Reporte de Ventas", W / 2, y, { align: "center" })
      y += 6
      doc.setFontSize(9)
      doc.setTextColor(100)
      doc.text(dateLabel, W / 2, y, { align: "center" })
      doc.setTextColor(0)
      y += 10
      doc.setDrawColor(200)
      doc.setLineWidth(0.5)
      doc.line(mg, y, W - mg, y)
      y += 8

      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.text("Resumen", mg, y)
      y += 6
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      const statsRows: [string, string][] = [
        ["Total Ventas", `$${stats.totalVentas.toLocaleString("es-CL")}`],
        ["Pedidos Entregados", `${completedOrders.length}`],
        ["Pedidos Activos", `${activeOrders.length}`],
        ["Pedidos Cancelados", `${cancelledOrders.length}`],
        ["Total Pedidos", `${displayOrders.length}`],
        ["Ticket Promedio", `$${stats.ticketPromedio.toLocaleString("es-CL", { maximumFractionDigits: 0 })}`],
        ["Productos Vendidos", `${stats.totalItems}`],
      ]
      statsRows.forEach(([label, value]) => {
        doc.text(label, mg + 2, y)
        doc.text(value, W - mg - 2, y, { align: "right" })
        y += 5.5
      })

      y += 4
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.text("Por Método de Pago", mg, y)
      y += 6
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      const payRows: [string, string][] = [
        ["Efectivo", `$${stats.byMethod.efectivo.toLocaleString("es-CL")}`],
        ["Transferencia", `$${stats.byMethod.transferencia.toLocaleString("es-CL")}`],
        ["Tarjeta", `$${stats.byMethod.tarjeta.toLocaleString("es-CL")}`],
      ]
      payRows.forEach(([label, value]) => {
        doc.text(label, mg + 2, y)
        doc.text(value, W - mg - 2, y, { align: "right" })
        y += 5.5
      })

      y += 4
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.text("Por Tipo de Entrega", mg, y)
      y += 6
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      const delivRows: [string, string][] = [
        ["Delivery", `${stats.byDelivery.delivery} pedidos`],
        ["Retiro en Local", `${stats.byDelivery.retiro} pedidos`],
      ]
      delivRows.forEach(([label, value]) => {
        doc.text(label, mg + 2, y)
        doc.text(value, W - mg - 2, y, { align: "right" })
        y += 5.5
      })

      y += 6
      doc.setDrawColor(200)
      doc.line(mg, y, W - mg, y)
      y += 8

      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.text("Detalle de Pedidos", mg, y)
      y += 6
      doc.setFillColor(240, 240, 240)
      doc.rect(mg, y - 4, cw, 7, "F")
      doc.setFontSize(8)
      doc.text("ID", mg + 2, y)
      doc.text("Cliente", mg + 35, y)
      doc.text("Estado", mg + 95, y)
      doc.text("Pago", mg + 125, y)
      doc.text("Total", W - mg - 2, y, { align: "right" })
      y += 6
      doc.setFont("helvetica", "normal")
      displayOrders.forEach((order, i) => {
        if (y > 270) { doc.addPage(); y = 20 }
        if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(mg, y - 3.5, cw, 6, "F") }
        doc.setFontSize(7)
        doc.text(order.id.slice(0, 18), mg + 2, y)
        doc.text(order.client_name.slice(0, 24), mg + 35, y)
        const sl = order.status === "entregado" ? "Entregado" : order.status === "cancelado" ? "Cancelado" : order.status === "preparando" ? "Preparando" : order.status === "en-camino" ? "En Camino" : "Recibido"
        doc.text(sl, mg + 95, y)
        const pl = order.payment_method === "efectivo" ? "Efectivo" : order.payment_method === "transferencia" ? "Transfer." : "Tarjeta"
        doc.text(pl, mg + 125, y)
        doc.text(`$${Number(order.total).toLocaleString("es-CL")}`, W - mg - 2, y, { align: "right" })
        y += 6
      })

      y += 6
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.text(`Generado el ${new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })} a las ${new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`, W / 2, y, { align: "center" })

    return doc
  }

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true)
    try {
      const doc = await buildPdfDoc()
      doc.save(`ventas-${selectedDate}.pdf`)
    } catch (e) {
      console.error("Error generando PDF:", e)
    } finally {
      setGeneratingPdf(false)
    }
  }

  const handleSendWhatsApp = async () => {
    setSendingWa(true)
    setWaStatus("idle")
    try {
      const doc = await buildPdfDoc()
      const base64 = doc.output("datauristring").split(",")[1]
      const fileName = `ventas-${selectedDate}.pdf`
      const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })
      const caption = `📊 Reporte de Ventas — ${dateLabel}\n💰 Total: $${stats.totalVentas.toLocaleString("es-CL")} (${completedOrders.length} pedidos entregados)`
      const res = await fetch("/api/whatsapp/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-token": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" },
        body: JSON.stringify({ fileBase64: base64, fileName, caption }),
      })
      if (res.ok) {
        setWaStatus("ok")
        setTimeout(() => setWaStatus("idle"), 3000)
      } else {
        const err = await res.json()
        console.error("send-report error:", JSON.stringify(err, null, 2))
        console.error("send-report HTTP status:", res.status)
        setWaStatus("error")
        setTimeout(() => setWaStatus("idle"), 4000)
      }
    } catch (e) {
      console.error("Error enviando PDF por WhatsApp:", e)
      setWaStatus("error")
      setTimeout(() => setWaStatus("idle"), 4000)
    } finally {
      setSendingWa(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  const selectedDateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-foreground">{isToday ? "Ventas del Día" : "Ventas"}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground capitalize">{selectedDateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPdf}
            disabled={generatingPdf || sendingWa || displayOrders.length === 0}
            className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{generatingPdf ? "Generando..." : "Descargar PDF"}</span>
          </button>
          <button
            onClick={handleSendWhatsApp}
            disabled={sendingWa || generatingPdf || displayOrders.length === 0}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              waStatus === "ok"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : waStatus === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-500"
                : "bg-green-600/10 border-green-600/20 text-green-600 dark:text-green-400 hover:bg-green-600/20"
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {sendingWa ? "Enviando..." : waStatus === "ok" ? "¡Enviado!" : waStatus === "error" ? "Error" : "WhatsApp"}
            </span>
          </button>
          {isToday && !isDayOpen && (
            <button
              onClick={() => setShowStartConfirm(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Iniciar Día</span>
            </button>
          )}
          {isToday && isDayOpen && (
            <button
              onClick={() => activeOrders.length === 0 ? setShowCloseConfirm(true) : null}
              disabled={activeOrders.length > 0}
              title={activeOrders.length > 0 ? `Hay ${activeOrders.length} pedido(s) activos sin entregar` : "Cerrar el día"}
              className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cerrar Día</span>
            </button>
          )}
          <button
            onClick={handleShareCarta}
            className="flex items-center gap-2 rounded-xl bg-emerald-600/10 border border-emerald-600/20 px-4 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/20 transition-colors"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Compartir Carta</span>
            <span className="sm:hidden">Carta</span>
          </button>
        </div>
      </div>

      {/* Banner de estado del día */}
      {isToday && !isDayOpen && !dayClose && (
        <div className="flex items-center gap-3 rounded-xl bg-muted/60 border border-border px-4 py-3 mb-4 sm:mb-5">
          <PlayCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground flex-1">El día laboral no ha sido iniciado. Presiona <span className="font-semibold text-foreground">Iniciar Día</span> para comenzar a recibir pedidos.</p>
        </div>
      )}
      {isToday && isDayOpen && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 px-4 py-2.5 mb-4 sm:mb-5">
          <Clock className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            Día iniciado a las{" "}
            <span className="font-semibold text-foreground">
              {new Date(dayStart).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
            </span>
            {activeOrders.length > 0 && (
              <span className="ml-2 text-amber-500 font-semibold">· {activeOrders.length} pedido(s) activo(s)</span>
            )}
          </p>
        </div>
      )}
      {isToday && dayClose && !isDayOpen && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 mb-4 sm:mb-5">
          <LogOut className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            Día cerrado a las{" "}
            <span className="font-semibold text-foreground">
              {new Date(dayClose).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
            </span>
            {" — Presiona Iniciar Día para comenzar el siguiente"}
          </p>
        </div>
      )}

      {/* Selector de fecha */}
      <div className="flex items-center justify-center gap-2 mb-4 sm:mb-6">
        <button
          onClick={() => changeDate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={selectedDate}
            max={todayStr}
            onChange={(e) => { if (e.target.value && e.target.value <= todayStr) setSelectedDate(e.target.value) }}
            className="bg-transparent text-sm font-medium text-foreground outline-none cursor-pointer"
          />
        </div>
        <button
          onClick={() => changeDate(1)}
          disabled={selectedDate >= todayStr}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        {!isToday && (
          <button
            onClick={() => setSelectedDate(todayStr)}
            className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            Hoy
          </button>
        )}
      </div>

      {/* Banner de conexión fallida */}
      {!dataLoaded && !loading && isToday && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 mb-4 sm:mb-6">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Conexión lenta o sin conexión</p>
            <p className="text-[10px] text-muted-foreground">No se pudieron cargar los datos. Intenta recargar la página.</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors flex-shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Spinner carga fecha */}
      {loadingDate && (
        <div className="flex items-center justify-center py-10">
          <div className="h-7 w-7 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      )}

      {!loadingDate && <>
      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-500/10">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
            </div>
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Total Ventas</span>
          </div>
          <p className="text-lg sm:text-2xl font-black text-card-foreground">$ {stats.totalVentas.toLocaleString("es-CL")}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{completedOrders.length} pedidos entregados</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-blue-500/10">
              <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
            </div>
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Pedidos del Día</span>
          </div>
          <p className="text-lg sm:text-2xl font-black text-card-foreground">{displayOrders.length}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{activeOrders.length} activos · {cancelledOrders.length} cancelados</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-amber-500/10">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
            </div>
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Ticket Prom.</span>
          </div>
          <p className="text-lg sm:text-2xl font-black text-card-foreground">$ {stats.ticketPromedio.toLocaleString("es-CL", { maximumFractionDigits: 0 })}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{stats.totalItems} productos vendidos</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-purple-500/10">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
            </div>
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Entregas</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-bold text-card-foreground">{stats.byDelivery.delivery}</span>
            </div>
            <div className="flex items-center gap-1">
              <Store className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-bold text-card-foreground">{stats.byDelivery.retiro}</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Delivery · Retiro</p>
        </div>
      </div>

      {/* Métodos de pago */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
            <Banknote className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Efectivo</p>
            <p className="text-lg font-black text-card-foreground">$ {stats.byMethod.efectivo.toLocaleString("es-CL")}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
            <ArrowRightLeft className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Transferencia</p>
            <p className="text-lg font-black text-card-foreground">$ {stats.byMethod.transferencia.toLocaleString("es-CL")}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
            <CreditCard className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tarjeta</p>
            <p className="text-lg font-black text-card-foreground">$ {stats.byMethod.tarjeta.toLocaleString("es-CL")}</p>
          </div>
        </div>
      </div>

      {/* Listado de pedidos */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-card-foreground">Pedidos del Día</h2>
          <p className="text-xs text-muted-foreground">{displayOrders.length} pedidos registrados</p>
        </div>

        {displayOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Sin pedidos este día</p>
            <p className="text-xs text-muted-foreground mt-1">No hay pedidos registrados para esta fecha</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {displayOrders.map((order) => (
              <div key={order.id} className="px-3 sm:px-5 py-3 flex items-center gap-3 sm:gap-4 hover:bg-accent/30 transition-colors">
                {/* Estado */}
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                  order.status === "entregado" ? "bg-emerald-500/10" :
                  order.status === "cancelado" ? "bg-red-500/10" :
                  "bg-blue-500/10"
                }`}>
                  {order.status === "entregado" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
                   order.status === "cancelado" ? <XCircle className="h-4 w-4 text-red-500" /> :
                   <Clock className="h-4 w-4 text-blue-500" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono text-muted-foreground">{order.id}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      order.status === "recibido" ? "bg-blue-500/10 text-blue-500" :
                      order.status === "preparando" ? "bg-amber-500/10 text-amber-500" :
                      order.status === "en-camino" ? "bg-purple-500/10 text-purple-500" :
                      order.status === "entregado" ? "bg-emerald-500/10 text-emerald-500" :
                      "bg-red-500/10 text-red-500"
                    }`}>
                      {order.status === "recibido" ? "Recibido" :
                       order.status === "preparando" ? "Preparando" :
                       order.status === "en-camino" ? "En Camino" :
                       order.status === "entregado" ? "Entregado" : "Cancelado"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-card-foreground truncate">{order.client_name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{order.items.length} productos</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      {order.delivery_type === "delivery" ? <Truck className="h-2.5 w-2.5" /> : <Store className="h-2.5 w-2.5" />}
                      {order.delivery_type === "delivery" ? "Delivery" : "Retiro"}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      {order.payment_method === "efectivo" ? <Banknote className="h-2.5 w-2.5" /> :
                       order.payment_method === "transferencia" ? <ArrowRightLeft className="h-2.5 w-2.5" /> :
                       <CreditCard className="h-2.5 w-2.5" />}
                      {order.payment_method === "efectivo" ? "Efectivo" :
                       order.payment_method === "transferencia" ? "Transferencia" : "Tarjeta"}
                    </span>
                  </div>
                </div>

                {/* Total + hora */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black text-card-foreground">$ {Number(order.total).toLocaleString("es-CL")}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(order.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>}

      {/* Modal confirmación inicio de día */}
      {showStartConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 mx-auto mb-4">
              <PlayCircle className="h-6 w-6 text-emerald-500" />
            </div>
            <h2 className="text-base font-bold text-card-foreground text-center mb-1">¿Iniciar el día?</h2>
            <p className="text-xs text-muted-foreground text-center mb-5">
              Los pedidos comenzarán a contarse desde este momento. La carta estará disponible para recibir pedidos.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowStartConfirm(false)}
                disabled={startingDay}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleStartDay}
                disabled={startingDay}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {startingDay ? (
                  <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Iniciando...</>
                ) : (
                  <>Iniciar Día</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación cierre de día */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 mx-auto mb-4">
              <LogOut className="h-6 w-6 text-red-500" />
            </div>
            <h2 className="text-base font-bold text-card-foreground text-center mb-1">¿Cerrar el día?</h2>
            <p className="text-xs text-muted-foreground text-center mb-1">
              Las ventas del día actual quedarán registradas hasta este momento.
            </p>
            <p className="text-xs text-muted-foreground text-center mb-5">
              Los nuevos pedidos se contarán a partir de ahora como el próximo día laboral.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseConfirm(false)}
                disabled={closingDay}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleCloseDay}
                disabled={closingDay}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {closingDay ? (
                  <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Cerrando...</>
                ) : (
                  <>Cerrar Día</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
