"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  X,
  Search,
  Trash2,
  Calendar,
  Receipt,
  Wallet,
  PiggyBank,
  CreditCard,
  Banknote,
  ShoppingBag,
  Package,
  Pencil,
  FileDown,
} from "lucide-react"
import { getTransactions, addTransaction, deleteTransaction, type DbTransaction } from "@/lib/supabase-finanzas"
import { subscribeToOrders, type SupabaseOrder } from "@/lib/supabase-orders"
import { getMovementsWithItems, getInventory, type MovementWithItem } from "@/lib/supabase-inventory"
import { downloadFinanzasReport, downloadInventarioReport, type ReportTransaction } from "@/lib/receipt-pdf"
import { loadBusinessName } from "@/lib/config-store"

type TransactionType = "ingreso" | "egreso"
type PaymentMethod = "efectivo" | "tarjeta" | "transferencia"
type TransactionSource = "venta" | "inventario" | "manual"

interface Transaction {
  id: string
  type: TransactionType
  category: string
  description: string
  amount: number
  date: string
  paymentMethod: PaymentMethod
  source: TransactionSource
}

const MANUAL_INCOME_CATEGORIES = [
  "Catering",
  "Eventos",
  "Propinas",
  "Otros Ingresos",
]

const MANUAL_EXPENSE_CATEGORIES = [
  "Sueldos y Salarios",
  "Arriendo",
  "Servicios Básicos",
  "Marketing",
  "Mantenimiento",
  "Impuestos",
  "Equipamiento",
  "Transporte",
  "Otros Gastos",
]

export default function FinanzasPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<"all" | TransactionType>("all")
  const [filterPeriod, setFilterPeriod] = useState<"today" | "week" | "month" | "all">("today")
  const [showModal, setShowModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [downloadingReport, setDownloadingReport] = useState<"finanzas" | "inventario" | null>(null)

  // Cargar datos reales: pedidos (Realtime), movimientos inventario (egresos) y manuales (one-shot)
  useEffect(() => {
    async function loadStaticData() {
      const [movements, manualTx] = await Promise.all([
        getMovementsWithItems(),
        getTransactions(),
      ])
      return { movements, manualTx }
    }

    let cachedStatic: { movements: MovementWithItem[]; manualTx: DbTransaction[] } | null = null

    function buildTransactions(orders: SupabaseOrder[], movements: MovementWithItem[], manualTx: DbTransaction[]) {

      const allTx: Transaction[] = []

      // 1. Ingresos automáticos: pedidos entregados
      orders
        .filter((o) => o.status === "entregado")
        .forEach((o) => {
          allTx.push({
            id: `order-${o.id}`,
            type: "ingreso",
            category: o.delivery_type === "delivery" ? "Delivery" : "Ventas POS",
            description: `Pedido #${o.id.slice(0, 8)} — ${o.client_name || "Cliente"}`,
            amount: Number(o.total),
            date: o.created_at.split("T")[0],
            paymentMethod: o.payment_method as PaymentMethod,
            source: "venta",
          })
        })

      // 2. Egresos automáticos: entradas de inventario (compras de insumos)
      movements
        .filter((m) => m.type === "entrada")
        .forEach((m) => {
          const cost = Number(m.quantity) * m.cost_per_unit
          if (cost > 0) {
            allTx.push({
              id: `mov-${m.id}`,
              type: "egreso",
              category: "Insumos / Materia Prima",
              description: `Compra: ${m.item_name} (${m.quantity} uds)`,
              amount: cost,
              date: m.created_at.split("T")[0],
              paymentMethod: "transferencia",
              source: "inventario",
            })
          }
        })

      // 3. Transacciones manuales
      manualTx.forEach((t) => {
        allTx.push({
          id: t.id,
          type: t.type,
          category: t.category,
          description: t.description,
          amount: Number(t.amount),
          date: t.date,
          paymentMethod: t.payment_method,
          source: "manual",
        })
      })

      return allTx
    }

    loadStaticData().then((staticData) => {
      cachedStatic = staticData
    })

    const timeout = setTimeout(() => setPageLoading(false), 4000)
    let latestOrders: SupabaseOrder[] = []

    const unsub = subscribeToOrders(async (orders) => {
      clearTimeout(timeout)
      latestOrders = orders
      if (!cachedStatic) {
        cachedStatic = await loadStaticData()
      }
      const { movements, manualTx } = cachedStatic!
      const allTx = buildTransactions(orders, movements, manualTx)
      setTransactions(allTx)
      setPageLoading(false)
    })

    // Refrescar datos estáticos cuando la pestaña vuelve a foco
    const handleVisibility = async () => {
      if (document.visibilityState === "visible" && latestOrders.length > 0) {
        cachedStatic = await loadStaticData()
        const allTx = buildTransactions(latestOrders, cachedStatic.movements, cachedStatic.manualTx)
        setTransactions(allTx)
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => { unsub(); clearTimeout(timeout); document.removeEventListener("visibilitychange", handleVisibility) }
  }, [])

  const [form, setForm] = useState({
    type: "ingreso" as TransactionType,
    category: "Ventas POS",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "efectivo" as PaymentMethod,
  })

  const filteredTransactions = useMemo(() => {
    let result = transactions

    // Filtro por período
    if (filterPeriod !== "all") {
      const now = new Date()
      const cutoff = new Date()
      if (filterPeriod === "today") {
        cutoff.setHours(0, 0, 0, 0)
      } else if (filterPeriod === "week") {
        cutoff.setDate(now.getDate() - 7)
      } else {
        cutoff.setMonth(now.getMonth() - 1)
      }
      result = result.filter((t) => new Date(t.date) >= cutoff)
    }

    if (filterType !== "all") result = result.filter((t) => t.type === filterType)
    if (searchQuery) {
      result = result.filter((t) =>
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [transactions, filterType, filterPeriod, searchQuery])

  const stats = useMemo(() => {
    const periodTx = filteredTransactions
    const ingresos = periodTx.filter((t) => t.type === "ingreso").reduce((s, t) => s + t.amount, 0)
    const egresos = periodTx.filter((t) => t.type === "egreso").reduce((s, t) => s + t.amount, 0)
    const balance = ingresos - egresos
    const margin = ingresos > 0 ? ((balance / ingresos) * 100).toFixed(1) : "0"

    // Por método de pago
    const byMethod = {
      efectivo: periodTx.filter((t) => t.type === "ingreso" && t.paymentMethod === "efectivo").reduce((s, t) => s + t.amount, 0),
      tarjeta: periodTx.filter((t) => t.type === "ingreso" && t.paymentMethod === "tarjeta").reduce((s, t) => s + t.amount, 0),
      transferencia: periodTx.filter((t) => t.type === "ingreso" && t.paymentMethod === "transferencia").reduce((s, t) => s + t.amount, 0),
    }

    // Top categorías de gasto
    const expenseByCategory: Record<string, number> = {}
    periodTx.filter((t) => t.type === "egreso").forEach((t) => {
      expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount
    })
    const topExpenses = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5)

    return { ingresos, egresos, balance, margin, byMethod, topExpenses }
  }, [filteredTransactions])

  const handleSave = async () => {
    if (!form.description || !form.amount) return
    const result = await addTransaction({
      type: form.type,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      date: form.date,
      payment_method: form.paymentMethod,
    })
    if (result) {
      setTransactions((prev) => [{
        id: result.id,
        type: result.type,
        category: result.category,
        description: result.description,
        amount: Number(result.amount),
        date: result.date,
        paymentMethod: result.payment_method,
        source: "manual" as TransactionSource,
      }, ...prev])
    }
    setShowModal(false)
    setForm({ type: "ingreso", category: "Catering", description: "", amount: "", date: new Date().toISOString().split("T")[0], paymentMethod: "efectivo" })
  }

  const handleDelete = async (id: string) => {
    // Solo se pueden eliminar transacciones manuales
    const tx = transactions.find((t) => t.id === id)
    if (tx?.source === "manual") {
      const ok = await deleteTransaction(id)
      if (ok) setTransactions((prev) => prev.filter((t) => t.id !== id))
    }
    setDeleteConfirm(null)
  }

  const formatCurrency = (n: number) => `$ ${n.toLocaleString("es-CL")}`

  const openCreate = (type: TransactionType) => {
    setForm({
      type,
      category: type === "ingreso" ? MANUAL_INCOME_CATEGORIES[0] : MANUAL_EXPENSE_CATEGORIES[0],
      description: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      paymentMethod: "efectivo",
    })
    setShowModal(true)
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-foreground">Finanzas</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Ingresos, gastos y rentabilidad</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          <button
            onClick={async () => {
              if (downloadingReport) return
              setDownloadingReport("finanzas")
              try {
                const periodLabel = filterPeriod === "week" ? "Semana" : filterPeriod === "month" ? "Mes" : "Todo"
                const reportTx: ReportTransaction[] = filteredTransactions.map((t) => ({
                  date: t.date,
                  type: t.type,
                  category: t.category,
                  description: t.description,
                  paymentMethod: t.paymentMethod,
                  amount: t.amount,
                }))
                await downloadFinanzasReport(reportTx, periodLabel, loadBusinessName() || undefined)
              } finally { setDownloadingReport(null) }
            }}
            disabled={!!downloadingReport}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shadow-sm disabled:opacity-50"
          >
            {downloadingReport === "finanzas" ? <div className="h-3.5 w-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Reporte finanzas</span>
          </button>
          <button
            onClick={async () => {
              if (downloadingReport) return
              setDownloadingReport("inventario")
              try {
                const items = await getInventory()
                await downloadInventarioReport(items, loadBusinessName() || undefined)
              } finally { setDownloadingReport(null) }
            }}
            disabled={!!downloadingReport}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shadow-sm disabled:opacity-50"
          >
            {downloadingReport === "inventario" ? <div className="h-3.5 w-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Reporte inventario</span>
          </button>
          <button onClick={() => openCreate("ingreso")}
            className="flex items-center gap-1 sm:gap-2 rounded-full bg-emerald-600 px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm">
            <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Ingreso</span><span className="sm:hidden">+</span>
          </button>
          <button onClick={() => openCreate("egreso")}
            className="flex items-center gap-1 sm:gap-2 rounded-full bg-red-500 px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-red-600 transition-colors shadow-sm">
            <ArrowDownRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Egreso</span><span className="sm:hidden">-</span>
          </button>
        </div>
      </div>

      {/* Tarjetas Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="rounded-2xl bg-card p-3 sm:p-5 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-500/10">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Ingresos</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-card-foreground">{formatCurrency(stats.ingresos)}</p>
          <p className="text-xs text-muted-foreground mt-1">{filteredTransactions.filter((t) => t.type === "ingreso").length} transacciones</p>
        </div>

        <div className="rounded-2xl bg-card p-3 sm:p-5 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-red-500/10">
              <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
            </div>
            <span className="text-[10px] font-medium text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">Egresos</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-card-foreground">{formatCurrency(stats.egresos)}</p>
          <p className="text-xs text-muted-foreground mt-1">{filteredTransactions.filter((t) => t.type === "egreso").length} transacciones</p>
        </div>

        <div className="rounded-2xl bg-card p-3 sm:p-5 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-primary/10">
              <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${stats.balance >= 0 ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" : "text-red-500 bg-red-500/10"}`}>
              {stats.balance >= 0 ? "Positivo" : "Negativo"}
            </span>
          </div>
          <p className={`text-lg sm:text-2xl font-bold ${stats.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
            {formatCurrency(stats.balance)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Balance neto</p>
        </div>

        <div className="rounded-2xl bg-card p-3 sm:p-5 shadow-sm border border-border">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-amber-500/10">
              <PiggyBank className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">Margen</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-card-foreground">{stats.margin}%</p>
          <p className="text-xs text-muted-foreground mt-1">Margen de ganancia</p>
        </div>
      </div>

      {/* Resumen por método de pago + Top gastos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
        {/* Ingresos por método */}
        <div className="rounded-2xl bg-card p-3 sm:p-5 shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-card-foreground mb-3 sm:mb-4">Ingresos por Método de Pago</h3>
          <div className="space-y-3">
            {([
              ["efectivo", "Efectivo", Banknote, "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"],
              ["tarjeta", "Tarjeta", CreditCard, "bg-blue-500/10 text-blue-600 dark:text-blue-400"],
              ["transferencia", "Transferencia", ArrowUpRight, "bg-purple-500/10 text-purple-600 dark:text-purple-400"],
            ] as const).map(([key, label, Icon, cls]) => {
              const val = stats.byMethod[key]
              const pct = stats.ingresos > 0 ? (val / stats.ingresos) * 100 : 0
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cls}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-card-foreground">{label}</span>
                      <span className="text-xs font-bold text-card-foreground">{formatCurrency(val)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top gastos */}
        <div className="rounded-2xl bg-card p-5 shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Top Categorías de Gasto</h3>
          {stats.topExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin gastos en este período</p>
          ) : (
            <div className="space-y-3">
              {stats.topExpenses.map(([cat, amount], i) => {
                const pct = stats.egresos > 0 ? (amount / stats.egresos) * 100 : 0
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/10 text-[10px] font-bold text-red-500">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-card-foreground">{cat}</span>
                        <span className="text-xs font-bold text-card-foreground">{formatCurrency(amount)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 shadow-sm border border-border min-w-[240px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Buscar transacción..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="border-none bg-transparent text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none w-full" />
        </div>
        <div className="flex items-center gap-1 bg-card rounded-xl p-1 border border-border">
          {([["all", "Todos"], ["ingreso", "Ingresos"], ["egreso", "Egresos"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilterType(val as any)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filterType === val ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-card rounded-xl p-1 border border-border">
          {([["today", "Hoy"], ["week", "7 días"], ["month", "30 días"], ["all", "Todo"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilterPeriod(val as any)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filterPeriod === val ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Transacciones */}
      <div className="rounded-2xl bg-card shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Descripción</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Categoría</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Origen</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Método</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Monto</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <Receipt className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  No hay transacciones
                </td></tr>
              ) : filteredTransactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{new Date(tx.date).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tx.type === "ingreso" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                        {tx.type === "ingreso" ? <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}
                      </div>
                      <p className="text-sm font-medium text-card-foreground">{tx.description}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{tx.category}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                      tx.source === "venta" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : tx.source === "inventario" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                    }`}>
                      {tx.source === "venta" ? <><ShoppingBag className="h-3 w-3" /> Venta</>
                      : tx.source === "inventario" ? <><Package className="h-3 w-3" /> Inventario</>
                      : <><Pencil className="h-3 w-3" /> Manual</>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                      tx.paymentMethod === "efectivo" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : tx.paymentMethod === "tarjeta" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                    }`}>
                      {tx.paymentMethod === "efectivo" ? "Efectivo" : tx.paymentMethod === "tarjeta" ? "Tarjeta" : "Transfer."}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-bold ${tx.type === "ingreso" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                      {tx.type === "ingreso" ? "+" : "-"} {formatCurrency(tx.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {tx.source === "manual" ? (
                      <button onClick={() => setDeleteConfirm(tx.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors ml-auto">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : <div className="h-8 w-8" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nueva Transacción */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-card shadow-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${form.type === "ingreso" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                  {form.type === "ingreso" ? <ArrowUpRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> : <ArrowDownRight className="h-5 w-5 text-red-500" />}
                </div>
                <h3 className="text-sm font-semibold text-card-foreground">
                  Nuevo {form.type === "ingreso" ? "Ingreso" : "Egreso"}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Tipo toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setForm((p) => ({ ...p, type: "ingreso", category: MANUAL_INCOME_CATEGORIES[0] }))}
                  className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-colors ${form.type === "ingreso" ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-border text-muted-foreground"}`}>
                  Ingreso
                </button>
                <button onClick={() => setForm((p) => ({ ...p, type: "egreso", category: MANUAL_EXPENSE_CATEGORIES[0] }))}
                  className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-colors ${form.type === "egreso" ? "border-red-500/50 bg-red-500/10 text-red-500" : "border-border text-muted-foreground"}`}>
                  Egreso
                </button>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Categoría</label>
                <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                  {(form.type === "ingreso" ? MANUAL_INCOME_CATEGORIES : MANUAL_EXPENSE_CATEGORIES).map((c: string) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Descripción *</label>
                <input type="text" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Detalle de la transacción..."
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Monto *</label>
                  <input type="number" min={0} value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0"
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Fecha</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Método de Pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {([["efectivo", "Efectivo"], ["tarjeta", "Tarjeta"], ["transferencia", "Transfer."]] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setForm((p) => ({ ...p, paymentMethod: val }))}
                      className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition-colors ${form.paymentMethod === val ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button onClick={() => setShowModal(false)} className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-card-foreground hover:bg-accent transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={!form.description || !form.amount}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${form.type === "ingreso" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-500 hover:bg-red-600"}`}>
                Registrar {form.type === "ingreso" ? "Ingreso" : "Egreso"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card shadow-xl border border-border p-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 mb-4">
                <Trash2 className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-1">Eliminar Transacción</h3>
              <p className="text-sm text-muted-foreground mb-6">¿Estás seguro? Esta acción no se puede deshacer.</p>
              <div className="flex items-center gap-3 w-full">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover:bg-accent transition-colors">Cancelar</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors">Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
