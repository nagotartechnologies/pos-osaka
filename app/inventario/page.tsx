"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Package,
  AlertTriangle,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  TrendingDown,
  CheckCircle2,
  Warehouse,
  History,
} from "lucide-react"
import { notifyLowStock } from "@/lib/notifications"
import {
  getInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem,
  getMovements, addMovement, seedInventoryIfEmpty, subscribeToInventory, checkAndNotifyLowStock,
  type InventoryItem as DbInventoryItem, type StockMovement as DbStockMovement,
} from "@/lib/supabase-inventory"

interface InventoryItem {
  id: string
  name: string
  category: string
  unit: string
  stock: number
  minStock: number
  costPerUnit: number
  supplier: string
  lastRestocked: string
}

interface StockMovement {
  id: string
  itemId: string
  type: "entrada" | "salida" | "ajuste"
  quantity: number
  date: string
  note: string
}

const UNITS = ["kg", "g", "lt", "ml", "unidad", "paquete", "caja", "botella"]

const defaultInventory = [
  { id: "1", name: "Salmón Fresco", category: "Pescados", unit: "kg", stock: 12, minStock: 5, costPerUnit: 15000, supplier: "Pesquera del Sur", lastRestocked: "2026-02-18" },
  { id: "2", name: "Arroz para Sushi", category: "Granos", unit: "kg", stock: 25, minStock: 10, costPerUnit: 3500, supplier: "Importadora Asia", lastRestocked: "2026-02-17" },
  { id: "3", name: "Alga Nori", category: "Algas", unit: "paquete", stock: 8, minStock: 15, costPerUnit: 4200, supplier: "Importadora Asia", lastRestocked: "2026-02-15" },
  { id: "4", name: "Vinagre de Arroz", category: "Condimentos", unit: "lt", stock: 6, minStock: 3, costPerUnit: 5800, supplier: "Importadora Asia", lastRestocked: "2026-02-16" },
  { id: "5", name: "Salsa de Soya", category: "Condimentos", unit: "lt", stock: 4, minStock: 5, costPerUnit: 3200, supplier: "Kikkoman Chile", lastRestocked: "2026-02-14" },
  { id: "6", name: "Wasabi", category: "Condimentos", unit: "g", stock: 500, minStock: 200, costPerUnit: 12, supplier: "Importadora Asia", lastRestocked: "2026-02-18" },
  { id: "7", name: "Jengibre Encurtido", category: "Condimentos", unit: "kg", stock: 2, minStock: 1, costPerUnit: 8500, supplier: "Importadora Asia", lastRestocked: "2026-02-17" },
  { id: "8", name: "Atún Fresco", category: "Pescados", unit: "kg", stock: 3, minStock: 4, costPerUnit: 18000, supplier: "Pesquera del Sur", lastRestocked: "2026-02-18" },
  { id: "9", name: "Camarón Jumbo", category: "Mariscos", unit: "kg", stock: 5, minStock: 3, costPerUnit: 22000, supplier: "Pesquera del Sur", lastRestocked: "2026-02-17" },
  { id: "10", name: "Aguacate Hass", category: "Vegetales", unit: "unidad", stock: 20, minStock: 10, costPerUnit: 1200, supplier: "Central de Abastos", lastRestocked: "2026-02-19" },
  { id: "11", name: "Queso Crema", category: "Lácteos", unit: "kg", stock: 3, minStock: 2, costPerUnit: 6500, supplier: "Distribuidora Láctea", lastRestocked: "2026-02-18" },
  { id: "12", name: "Cerveza Asahi", category: "Bebidas", unit: "caja", stock: 6, minStock: 4, costPerUnit: 18000, supplier: "Distribuidora Nippon", lastRestocked: "2026-02-16" },
]

export default function InventarioPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "low" | "ok">("all")
  const [showModal, setShowModal] = useState(false)
  const [showMovementModal, setShowMovementModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"inventario" | "movimientos">("inventario")
  const [sortBy, setSortBy] = useState<"name" | "stock" | "cost">("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const [form, setForm] = useState({
    name: "", category: "", unit: "unidad", stock: "", minStock: "", costPerUnit: "", supplier: "",
  })

  const [movForm, setMovForm] = useState({
    type: "entrada" as "entrada" | "salida" | "ajuste",
    quantity: "",
    note: "",
  })

  // Mapper para convertir formato DB a formato local
  const mapDbItem = useCallback((i: DbInventoryItem): InventoryItem => ({
    id: i.id, name: i.name, category: i.category, unit: i.unit,
    stock: Number(i.stock), minStock: Number(i.min_stock),
    costPerUnit: Number(i.cost_per_unit), supplier: i.supplier,
    lastRestocked: i.last_restocked || "",
  }), [])

  // Realtime: suscripción a cambios de inventario
  useEffect(() => {
    // Cargar movimientos (one-shot, no cambian en tiempo real desde otra pestaña)
    getMovements().then((movs) => {
      setMovements(movs.map((m) => ({
        id: m.id, itemId: m.item_id, type: m.type,
        quantity: Number(m.quantity), date: m.created_at, note: m.note || "",
      })))
    })

    const timeout = setTimeout(() => setPageLoading(false), 3000)
    const unsub = subscribeToInventory((items) => {
      clearTimeout(timeout)
      setInventory(items.map(mapDbItem))
      setPageLoading(false)
    })
    return () => { unsub(); clearTimeout(timeout) }
  }, [mapDbItem])

  const filteredInventory = useMemo(() => {
    let result = inventory
    if (searchQuery) {
      result = result.filter((i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.supplier.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    if (filterStatus === "low") result = result.filter((i) => i.stock <= i.minStock)
    if (filterStatus === "ok") result = result.filter((i) => i.stock > i.minStock)

    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortBy === "name") cmp = a.name.localeCompare(b.name)
      else if (sortBy === "stock") cmp = a.stock - b.stock
      else if (sortBy === "cost") cmp = a.costPerUnit * a.stock - b.costPerUnit * b.stock
      return sortDir === "asc" ? cmp : -cmp
    })
    return result
  }, [inventory, searchQuery, filterStatus, sortBy, sortDir])

  const stats = useMemo(() => {
    const total = inventory.length
    const lowStock = inventory.filter((i) => i.stock <= i.minStock).length
    const totalValue = inventory.reduce((sum, i) => sum + i.costPerUnit * i.stock, 0)
    const categories = new Set(inventory.map((i) => i.category)).size
    return { total, lowStock, totalValue, categories }
  }, [inventory])

  const openCreate = () => {
    setEditingItem(null)
    setForm({ name: "", category: "", unit: "unidad", stock: "", minStock: "", costPerUnit: "", supplier: "" })
    setShowModal(true)
  }

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setForm({
      name: item.name, category: item.category, unit: item.unit,
      stock: item.stock.toString(), minStock: item.minStock.toString(),
      costPerUnit: item.costPerUnit.toString(), supplier: item.supplier,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.stock || !form.costPerUnit) return
    if (editingItem) {
      const updates = {
        name: form.name, category: form.category, unit: form.unit,
        stock: parseFloat(form.stock), min_stock: parseFloat(form.minStock) || 0,
        cost_per_unit: parseFloat(form.costPerUnit), supplier: form.supplier,
      }
      const result = await updateInventoryItem(editingItem.id, updates)
      if (result) {
        setInventory((prev) => prev.map((i) => i.id === editingItem.id ? {
          ...i, name: form.name, category: form.category, unit: form.unit,
          stock: parseFloat(form.stock), minStock: parseFloat(form.minStock) || 0,
          costPerUnit: parseFloat(form.costPerUnit), supplier: form.supplier,
        } : i))
      }
    } else {
      const newId = Date.now().toString()
      const today = new Date().toISOString().split("T")[0]
      const result = await addInventoryItem({
        id: newId, name: form.name, category: form.category, unit: form.unit,
        stock: parseFloat(form.stock), min_stock: parseFloat(form.minStock) || 0,
        cost_per_unit: parseFloat(form.costPerUnit), supplier: form.supplier,
        last_restocked: today,
      })
      if (result) {
        setInventory((prev) => [...prev, {
          id: result.id, name: result.name, category: result.category, unit: result.unit,
          stock: Number(result.stock), minStock: Number(result.min_stock),
          costPerUnit: Number(result.cost_per_unit), supplier: result.supplier,
          lastRestocked: result.last_restocked || today,
        }])
      }
    }
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    const ok = await deleteInventoryItem(id)
    if (ok) setInventory((prev) => prev.filter((i) => i.id !== id))
    setDeleteConfirm(null)
  }

  const openMovement = (item: InventoryItem) => {
    setSelectedItem(item)
    setMovForm({ type: "entrada", quantity: "", note: "" })
    setShowMovementModal(true)
  }

  const handleMovement = async () => {
    if (!selectedItem || !movForm.quantity) return
    const qty = parseFloat(movForm.quantity)
    const movId = Date.now().toString()

    // Guardar movimiento en Supabase
    const movResult = await addMovement({
      id: movId, item_id: selectedItem.id, type: movForm.type,
      quantity: qty, note: movForm.note,
    })

    if (movResult) {
      setMovements((prev) => [{
        id: movResult.id, itemId: movResult.item_id, type: movResult.type,
        quantity: Number(movResult.quantity), date: movResult.created_at, note: movResult.note || "",
      }, ...prev])
    }

    // Calcular nuevo stock
    const item = inventory.find((i) => i.id === selectedItem.id)
    if (!item) return
    let newStock = item.stock
    if (movForm.type === "entrada") newStock += qty
    else if (movForm.type === "salida") newStock = Math.max(0, newStock - qty)
    else newStock = qty

    const today = new Date().toISOString().split("T")[0]
    const updates: any = { stock: newStock }
    if (movForm.type === "entrada") updates.last_restocked = today

    await updateInventoryItem(selectedItem.id, updates)

    // Notificar si el stock quedó bajo el mínimo
    if (newStock <= item.minStock) {
      notifyLowStock(item.id, item.name, newStock, item.minStock, item.unit)
      checkAndNotifyLowStock()
    }

    setInventory((prev) => prev.map((i) => {
      if (i.id !== selectedItem.id) return i
      return { ...i, stock: newStock, lastRestocked: movForm.type === "entrada" ? today : i.lastRestocked }
    }))
    setShowMovementModal(false)
  }

  const toggleSort = (col: "name" | "stock" | "cost") => {
    if (sortBy === col) setSortDir((d) => d === "asc" ? "desc" : "asc")
    else { setSortBy(col); setSortDir("asc") }
  }

  const formatCurrency = (n: number) => `$ ${n.toLocaleString("es-CL")}`

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
          <h1 className="text-lg sm:text-2xl font-bold text-foreground">Inventario</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Control de stock e insumos</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-primary px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nuevo Insumo</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="rounded-2xl bg-card p-3 sm:p-4 shadow-sm border border-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-primary/10">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-card-foreground">{stats.total}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Total Insumos</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-card p-3 sm:p-4 shadow-sm border border-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-red-500/10">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-card-foreground">{stats.lowStock}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Stock Bajo</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-card p-3 sm:p-4 shadow-sm border border-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-500/10">
              <Warehouse className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-card-foreground">{stats.categories}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Categorías</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-card p-3 sm:p-4 shadow-sm border border-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-amber-500/10">
              <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-card-foreground">{formatCurrency(stats.totalValue)}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Valor Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 sm:mb-6 bg-card rounded-xl p-1 border border-border w-fit">
        {(["inventario", "movimientos"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "inventario" ? "Inventario" : "Movimientos"}
          </button>
        ))}
      </div>

      {activeTab === "inventario" && (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 shadow-sm border border-border min-w-[240px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Buscar insumo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="border-none bg-transparent text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none w-full" />
            </div>
            <div className="flex items-center gap-1 bg-card rounded-xl p-1 border border-border">
              {([["all", "Todos"], ["low", "Stock Bajo"], ["ok", "OK"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => setFilterStatus(val as any)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filterStatus === val ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla */}
          <div className="rounded-2xl bg-card shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left">
                      <button onClick={() => toggleSort("name")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                        Insumo {sortBy === "name" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Categoría</th>
                    <th className="px-4 py-3 text-center">
                      <button onClick={() => toggleSort("stock")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground mx-auto">
                        Stock {sortBy === "stock" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Proveedor</th>
                    <th className="px-4 py-3 text-right">
                      <button onClick={() => toggleSort("cost")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground ml-auto">
                        Valor {sortBy === "cost" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => {
                    const isLow = item.stock <= item.minStock
                    const value = item.costPerUnit * item.stock
                    return (
                      <tr key={item.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold ${isLow ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"}`}>
                              {item.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-card-foreground">{item.name}</p>
                              <p className="text-[10px] text-muted-foreground">Últ. reposición: {item.lastRestocked}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{item.category}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center">
                            <span className={`text-sm font-bold ${isLow ? "text-red-500" : "text-card-foreground"}`}>
                              {item.stock} {item.unit}
                            </span>
                            <span className="text-[10px] text-muted-foreground">mín: {item.minStock}</span>
                            {isLow && (
                              <span className="mt-0.5 flex items-center gap-0.5 text-[9px] font-semibold text-red-500">
                                <AlertTriangle className="h-2.5 w-2.5" /> Bajo
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{item.supplier}</td>
                        <td className="px-4 py-3 text-right">
                          <p className="text-sm font-semibold text-card-foreground">{formatCurrency(value)}</p>
                          <p className="text-[10px] text-muted-foreground">{formatCurrency(item.costPerUnit)}/{item.unit}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openMovement(item)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Movimiento de stock">
                              <ArrowUpDown className="h-4 w-4" />
                            </button>
                            <button onClick={() => openEdit(item)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(item.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredInventory.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Package className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No se encontraron insumos</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === "movimientos" && (
        <div className="rounded-2xl bg-card shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Insumo</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Tipo</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Cantidad</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Nota</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    No hay movimientos registrados
                  </td></tr>
                ) : movements.map((mov) => {
                  const item = inventory.find((i) => i.id === mov.itemId)
                  return (
                    <tr key={mov.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(mov.date).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-4 py-3 text-sm font-medium text-card-foreground">{item?.name || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          mov.type === "entrada" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : mov.type === "salida" ? "bg-red-500/10 text-red-500"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}>
                          {mov.type === "entrada" ? "Entrada" : mov.type === "salida" ? "Salida" : "Ajuste"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-bold text-card-foreground">
                        {mov.type === "entrada" ? "+" : mov.type === "salida" ? "-" : ""}{mov.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{mov.note || "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Crear/Editar Insumo */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card shadow-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-card-foreground">{editingItem ? "Editar Insumo" : "Nuevo Insumo"}</h3>
              <button onClick={() => setShowModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nombre *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Salmón Fresco"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Categoría</label>
                  <input type="text" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="Ej: Pescados"
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Unidad</label>
                  <select value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Stock Actual *</label>
                  <input type="number" min={0} value={form.stock} onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Stock Mínimo</label>
                  <input type="number" min={0} value={form.minStock} onChange={(e) => setForm((p) => ({ ...p, minStock: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Costo/Unidad *</label>
                  <input type="number" min={0} value={form.costPerUnit} onChange={(e) => setForm((p) => ({ ...p, costPerUnit: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Proveedor</label>
                <input type="text" value={form.supplier} onChange={(e) => setForm((p) => ({ ...p, supplier: e.target.value }))} placeholder="Ej: Pesquera del Sur"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button onClick={() => setShowModal(false)} className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-card-foreground hover:bg-accent transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={!form.name || !form.stock || !form.costPerUnit}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {editingItem ? "Guardar Cambios" : "Crear Insumo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Movimiento de Stock */}
      {showMovementModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card shadow-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">Movimiento de Stock</h3>
                <p className="text-xs text-muted-foreground">{selectedItem.name} — Stock actual: {selectedItem.stock} {selectedItem.unit}</p>
              </div>
              <button onClick={() => setShowMovementModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo de Movimiento</label>
                <div className="grid grid-cols-3 gap-2">
                  {([["entrada", "Entrada", "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"], ["salida", "Salida", "bg-red-500/10 text-red-500 border-red-500/30"], ["ajuste", "Ajuste", "bg-amber-500/10 text-amber-600 border-amber-500/30"]] as const).map(([val, label, cls]) => (
                    <button key={val} onClick={() => setMovForm((p) => ({ ...p, type: val }))}
                      className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition-colors ${movForm.type === val ? cls : "border-border text-muted-foreground"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {movForm.type === "ajuste" ? "Nuevo Stock" : "Cantidad"} *
                </label>
                <input type="number" min={0} value={movForm.quantity} onChange={(e) => setMovForm((p) => ({ ...p, quantity: e.target.value }))}
                  placeholder={movForm.type === "ajuste" ? "Stock correcto" : "Cantidad"}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nota</label>
                <input type="text" value={movForm.note} onChange={(e) => setMovForm((p) => ({ ...p, note: e.target.value }))} placeholder="Motivo del movimiento..."
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button onClick={() => setShowMovementModal(false)} className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-card-foreground hover:bg-accent transition-colors">Cancelar</button>
              <button onClick={handleMovement} disabled={!movForm.quantity}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Confirmar
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
              <h3 className="text-lg font-semibold text-card-foreground mb-1">Eliminar Insumo</h3>
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
