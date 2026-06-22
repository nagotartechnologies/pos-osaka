import { getSharedClient } from "@/lib/supabase"

const supabase = getSharedClient()

// ─── Tipos ───

export interface InventoryItem {
  id: string
  name: string
  category: string
  unit: string
  stock: number
  min_stock: number
  cost_per_unit: number
  supplier: string
  last_restocked: string | null
  created_at: string
}

export interface StockMovement {
  id: string
  item_id: string
  type: "entrada" | "salida" | "ajuste"
  quantity: number
  note: string
  created_at: string
}

// ─── Inventario CRUD ───

export async function getInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .order("name", { ascending: true })
  if (error) { console.error("getInventory error:", error); return [] }
  return data || []
}

export async function addInventoryItem(
  item: Omit<InventoryItem, "created_at">
): Promise<InventoryItem | null> {
  const { data, error } = await supabase
    .from("inventory")
    .insert(item)
    .select()
    .single()
  if (error) { console.error("addInventoryItem error:", error); return null }
  return data
}

export async function updateInventoryItem(
  id: string,
  updates: Partial<Omit<InventoryItem, "id" | "created_at">>
): Promise<InventoryItem | null> {
  const { data, error } = await supabase
    .from("inventory")
    .update(updates)
    .eq("id", id)
    .select()
    .single()
  if (error) { console.error("updateInventoryItem error:", error); return null }
  return data
}

export async function deleteInventoryItem(id: string): Promise<boolean> {
  // Primero eliminar movimientos asociados
  const { error: movError } = await supabase
    .from("stock_movements")
    .delete()
    .eq("item_id", id)
  if (movError) console.error("deleteMovements error:", movError)

  const { error } = await supabase.from("inventory").delete().eq("id", id)
  if (error) { console.error("deleteInventoryItem error:", error); return false }
  return true
}

// ─── Movimientos de Stock ───

export async function getMovements(): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) { console.error("getMovements error:", error); return [] }
  return data || []
}

export async function addMovement(
  mov: Omit<StockMovement, "created_at">
): Promise<StockMovement | null> {
  const { data, error } = await supabase
    .from("stock_movements")
    .insert(mov)
    .select()
    .single()
  if (error) { console.error("addMovement error:", error); return null }
  return data
}

// ─── Movimientos con datos del item (para finanzas) ───

export interface MovementWithItem extends StockMovement {
  item_name: string
  cost_per_unit: number
}

export async function getMovementsWithItems(): Promise<MovementWithItem[]> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*, inventory(name, cost_per_unit)")
    .order("created_at", { ascending: false })
    .limit(500)
  if (error) { console.error("getMovementsWithItems error:", error); return [] }
  return (data || []).map((m: any) => ({
    ...m,
    item_name: m.inventory?.name || "Item eliminado",
    cost_per_unit: Number(m.inventory?.cost_per_unit || 0),
  }))
}

// ─── Realtime: suscripción a cambios de inventario ───

type InventoryListener = (items: InventoryItem[]) => void

let _invListeners: Set<InventoryListener> = new Set()
let _cachedInventory: InventoryItem[] = []
let _invLoaded = false
let _invChannelActive = false

function _broadcastInventory(items: InventoryItem[]) {
  _cachedInventory = items
  _invLoaded = true
  _invListeners.forEach((fn) => fn(items))
}

// Aplica un cambio Realtime de forma incremental sobre la cache, sin refetch.
function _applyInventoryChange(event: string, newRow: any, oldRow: any) {
  if (event === "DELETE") {
    const id = oldRow?.id
    if (!id) return
    _broadcastInventory(_cachedInventory.filter((i) => i.id !== id))
    return
  }
  if (!newRow) return
  const incoming = newRow as InventoryItem
  const idx = _cachedInventory.findIndex((i) => i.id === incoming.id)
  let next: InventoryItem[]
  if (idx === -1) {
    next = [..._cachedInventory, incoming]
  } else {
    next = _cachedInventory.slice()
    next[idx] = incoming
  }
  next.sort((a, b) => a.name.localeCompare(b.name))
  _broadcastInventory(next)
}

function _ensureInventoryChannel() {
  if (_invChannelActive) return
  _invChannelActive = true

  // Carga inicial
  getInventory().then((data) => {
    _broadcastInventory(data)
  }).catch(() => {
    _invLoaded = true
    _invChannelActive = false
    _invListeners.forEach((fn) => fn([]))
  })

  supabase.channel("inventory-global")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "inventory" },
      (payload: any) => {
        // Aplicar el cambio incrementalmente — sin refetch completo (ahorra egress)
        _applyInventoryChange(payload.eventType, payload.new, payload.old)
      }
    )
    .subscribe()
}

export function subscribeToInventory(onUpdate: InventoryListener): () => void {
  _invListeners.add(onUpdate)
  if (_invLoaded) {
    onUpdate(_cachedInventory)
  }
  _ensureInventoryChannel()
  return () => {
    _invListeners.delete(onUpdate)
  }
}

/**
 * Devuelve el inventario en cache SOLO si ya está cargado. No abre canal ni
 * hace fetch (0 egress). Útil para chequeos oportunistas (ej. stock bajo) que
 * no deben descargar la tabla si ya la tenemos en memoria.
 */
export function peekInventoryCache(): InventoryItem[] | null {
  return _invLoaded ? _cachedInventory : null
}

// ─── Alerta de stock bajo por WhatsApp al admin ───

export async function checkAndNotifyLowStock(): Promise<void> {
  const items = _invLoaded ? _cachedInventory : await getInventory()
  const lowItems = items.filter((i) => i.stock <= i.min_stock && i.min_stock > 0)
  if (lowItems.length === 0) return

  const lines = lowItems.map((i) => `• *${i.name}*: ${i.stock} ${i.unit} (mín: ${i.min_stock})`).join("\n")
  const message = `⚠️ *Alerta de Stock Bajo*\n\n${lowItems.length} producto(s) por debajo del mínimo:\n\n${lines}\n\nRevisa el inventario para reabastecer.`

  try {
    await fetch("/api/whatsapp/notify-admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
      body: JSON.stringify({ message }),
    })
  } catch (err) {
    console.error("Error notificando stock bajo:", err)
  }
}

// ─── Seed: migrar datos hardcoded si tabla vacía ───

export async function seedInventoryIfEmpty(
  defaults: { id: string; name: string; category: string; unit: string; stock: number; minStock: number; costPerUnit: number; supplier: string; lastRestocked: string }[]
): Promise<void> {
  const { count } = await supabase
    .from("inventory")
    .select("*", { count: "exact", head: true })

  if ((count ?? 0) === 0 && defaults.length > 0) {
    const rows = defaults.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      unit: d.unit,
      stock: d.stock,
      min_stock: d.minStock,
      cost_per_unit: d.costPerUnit,
      supplier: d.supplier,
      last_restocked: d.lastRestocked,
    }))
    await supabase.from("inventory").insert(rows)
    console.log(`Seeded ${rows.length} inventory items`)
  }
}
