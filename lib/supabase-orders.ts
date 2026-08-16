/**
 * CRUD de pedidos usando Supabase como backend.
 * Lee credenciales desde variables de entorno NEXT_PUBLIC_SUPABASE_*.
 */

import { getSharedClient } from "@/lib/supabase"
import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizePhone } from "@/lib/phone"

// ── Tipos ──────────────────────────────────────────────────────────
export type OrderStatus = "recibido" | "cotizado" | "preparando" | "en-camino" | "entregado" | "cancelado"
export type PaymentMethod = "efectivo" | "transferencia" | "tarjeta"
export type CardType = "debito" | "credito"
export type PaymentStatus = "na" | "pendiente" | "aprobado" | "rechazado"
export type DeliveryType = "delivery" | "retiro"

export interface OrderItemExtra {
  description: string
  price: number
}

export interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  notes?: string
  category?: string
  extras?: OrderItemExtra[]
  customBuild?: boolean
  customBuildNotes?: string
  quotedPrice?: number | null
}

export interface SupabaseOrder {
  id: string
  items: OrderItem[]
  total: number
  client_name: string
  client_phone: string
  delivery_type: DeliveryType
  address: string
  payment_method: PaymentMethod
  card_type?: CardType | null
  payment_status: PaymentStatus
  receipt_url: string | null
  cash_amount: number | null
  change_amount: number | null
  status: OrderStatus
  modification_fee: number
  original_total: number | null
  modification_notes: string | null
  discount?: number | null
  created_at: string
  updated_at: string
}

// ── Cliente Supabase (singleton compartido) ─────────────────────────
function getClient(): SupabaseClient {
  return getSharedClient()
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// ── Generador de ID ────────────────────────────────────────────────
function generateOrderId(): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  const seq = Math.floor(Math.random() * 900) + 100
  return `PED-${pad(now.getHours())}${pad(now.getMinutes())}-${seq}`
}

// ── CRUD ───────────────────────────────────────────────────────────

export async function getOrders(): Promise<SupabaseOrder[]> {
  const sb = getClient()
  if (!sb) return []
  const { data, error } = await sb
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000)
  if (error) { console.error("getOrders error:", error); return [] }
  return (data || []).map((o: any) => ({
    ...o,
    items: typeof o.items === "string" ? JSON.parse(o.items) : (o.items || []),
  }))
}

export async function countOrdersByStatus(status: OrderStatus): Promise<number> {
  const sb = getClient()
  if (!sb) return 0
  const { count, error } = await sb
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("status", status)
  if (error) { console.error("countOrdersByStatus error:", error); return 0 }
  return count || 0
}

export async function getAllOrders(): Promise<SupabaseOrder[]> {
  const sb = getClient()
  if (!sb) return []
  const { data, error } = await sb
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000)
  if (error) { console.error("getAllOrders error:", error); return [] }
  return (data || []).map((o: any) => ({
    ...o,
    items: typeof o.items === "string" ? JSON.parse(o.items) : (o.items || []),
  }))
}

export async function getOrdersByDateRange(days: number): Promise<SupabaseOrder[]> {
  const sb = getClient()
  if (!sb) return []
  const now = new Date()
  const chiNow = new Date(now.toLocaleString("sv-SE", { timeZone: "America/Santiago" }).replace(" ", "T") + "Z")
  const offsetMs = now.getTime() - chiNow.getTime()
  chiNow.setUTCHours(0, 0, 0, 0)
  const startDate = new Date(chiNow.getTime() + offsetMs)
  startDate.setDate(startDate.getDate() - days + 1)
  const { data, error } = await sb
    .from("orders")
    .select("*")
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: false })
  if (error) { console.error("getOrdersByDateRange error:", error); return [] }
  return (data || []).map((o: any) => ({
    ...o,
    items: typeof o.items === "string" ? JSON.parse(o.items) : (o.items || []),
  }))
}

export interface AddOrderData {
  items: OrderItem[]
  total: number
  clientName: string
  clientPhone: string
  deliveryType: DeliveryType
  address: string
  paymentMethod: PaymentMethod
  cardType?: CardType | null
  cashAmount: number | null
  change: number | null
  receiptUrl?: string | null
  discount?: number | null
}

// Ventana anti-duplicado: si llega un pedido idéntico (mismo teléfono, total y
// nº de ítems) dentro de este lapso, se considera doble-submit y se devuelve el
// pedido ya existente en vez de crear otro. Defensa en profundidad frente al
// doble-tap del cliente (la 1ª capa es el lock de UI en la carta).
const DEDUPE_WINDOW_MS = 20_000

export async function addOrder(data: AddOrderData): Promise<SupabaseOrder | null> {
  const sb = getClient()
  if (!sb) return null

  // ── Defensa anti-duplicado ──────────────────────────────────────
  // Solo aplica cuando hay teléfono (evita falsos positivos en pedidos sin
  // teléfono que podrían coincidir en total por casualidad).
  const phone = (data.clientPhone || "").trim()
  if (phone) {
    const sinceIso = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString()
    const { data: recent } = await sb
      .from("orders")
      .select("*")
      .eq("client_phone", phone)
      .eq("total", data.total)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5)
    const itemCount = (o: any) => {
      const its = typeof o.items === "string" ? JSON.parse(o.items || "[]") : (o.items || [])
      return Array.isArray(its) ? its.length : 0
    }
    const dup = (recent || []).find((o: any) => itemCount(o) === data.items.length)
    if (dup) {
      console.warn("addOrder: pedido duplicado detectado, devolviendo el existente:", dup.id)
      return _normalizeOrder(dup)
    }
  }

  const now = new Date().toISOString()
  const isTransfer = data.paymentMethod === "transferencia"

  const row: SupabaseOrder = {
    id: generateOrderId(),
    items: data.items,
    total: data.total,
    client_name: data.clientName,
    client_phone: data.clientPhone,
    delivery_type: data.deliveryType,
    address: data.address,
    payment_method: data.paymentMethod,
    card_type: data.cardType ?? null,
    payment_status: isTransfer ? "pendiente" : "na",
    receipt_url: data.receiptUrl || null,
    cash_amount: data.cashAmount,
    change_amount: data.change,
    status: "recibido",
    modification_fee: 0,
    original_total: null,
    modification_notes: null,
    discount: data.discount ?? null,
    created_at: now,
    updated_at: now,
  }

  const { data: inserted, error } = await sb
    .from("orders")
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error("addOrder error:", JSON.stringify(error, null, 2))
    console.error("addOrder row attempted:", JSON.stringify(row, null, 2))
    return null
  }
  return inserted
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<SupabaseOrder | null> {
  const sb = getClient()
  if (!sb) return null
  const { data, error } = await sb
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  if (error) { console.error("updateOrderStatus error:", error); return null }
  return data
}

export async function updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<SupabaseOrder | null> {
  const sb = getClient()
  if (!sb) return null
  const { data, error } = await sb
    .from("orders")
    .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  if (error) { console.error("updatePaymentStatus error:", error); return null }
  return data
}

export async function updateOrderReceiptUrl(id: string, receiptUrl: string | null): Promise<boolean> {
  const sb = getClient()
  if (!sb) return false
  const { error } = await sb
    .from("orders")
    .update({ receipt_url: receiptUrl, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) { console.error("updateOrderReceiptUrl error:", error); return false }
  return true
}

export async function deleteOrder(id: string): Promise<boolean> {
  const sb = getClient()
  if (!sb) return false
  const { error } = await sb.from("orders").delete().eq("id", id)
  if (error) { console.error("deleteOrder error:", error); return false }
  return true
}

export async function getDebitDeliveryCountSince(sinceIso: string): Promise<number> {
  const sb = getClient()
  if (!sb) return 0
  const { count, error } = await sb
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("delivery_type", "delivery")
    .eq("payment_method", "tarjeta")
    .eq("card_type", "debito")
    .gte("created_at", sinceIso)
    .neq("status", "cancelado")
  if (error) { console.error("getDebitDeliveryCountSince error:", error); return 0 }
  return count || 0
}

export async function getTodaySales(): Promise<{ total: number; count: number }> {
  const sb = getClient()
  if (!sb) return { total: 0, count: 0 }
  // Calcular medianoche en Santiago (no en UTC del servidor Vercel)
  const now = new Date()
  const chiNow = new Date(now.toLocaleString("sv-SE", { timeZone: "America/Santiago" }).replace(" ", "T") + "Z")
  const offsetMs = now.getTime() - chiNow.getTime() // ms de diferencia UTC↔Santiago
  chiNow.setUTCHours(0, 0, 0, 0)                   // medianoche Santiago (como UTC)
  const todayStart = new Date(chiNow.getTime() + offsetMs) // UTC real de medianoche Santiago
  const { data, error } = await sb
    .from("orders")
    .select("total")
    .gte("created_at", todayStart.toISOString())
    .neq("status", "cancelado")
  if (error) { console.error("getTodaySales error:", error); return { total: 0, count: 0 } }
  const orders = data || []
  const sum = orders.reduce((acc, o) => acc + (Number(o.total) || 0), 0)
  return { total: sum, count: orders.length }
}

export async function getOrdersByDate(dateInput: Date | string, openHour: number = 0): Promise<SupabaseOrder[]> {
  const sb = getClient()
  if (!sb) return []
  
  // Manejar tanto Date objects como strings YYYY-MM-DD
  let year: number, month: number, day: number
  
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('-').map(Number)
    year = parts[0]
    month = parts[1] - 1
    day = parts[2]
  } else {
    year = dateInput.getFullYear()
    month = dateInput.getMonth()
    day = dateInput.getDate()
  }

  // Calcular offset UTC↔Santiago dinámicamente
  const now = new Date()
  const chiStr = now.toLocaleString("sv-SE", { timeZone: "America/Santiago" }).replace(" ", "T")
  const chiNow = new Date(chiStr + "Z")
  const offsetMs = now.getTime() - chiNow.getTime()

  // Día laboral: desde openHour del día seleccionado hasta openHour del día siguiente (hora Santiago)
  const localStart = new Date(Date.UTC(year, month, day, openHour, 0, 0, 0))
  const localEnd   = new Date(Date.UTC(year, month, day + 1, openHour, 0, 0, 0))
  const dayStart = new Date(localStart.getTime() + offsetMs)
  const dayEnd   = new Date(localEnd.getTime() + offsetMs - 1)
  
  const { data, error } = await sb
    .from("orders")
    .select("*")
    .gte("created_at", dayStart.toISOString())
    .lte("created_at", dayEnd.toISOString())
    .neq("status", "cancelado")
    .order("created_at", { ascending: true })
  
  if (error) { console.error("getOrdersByDate error:", error); return [] }
  return (data || []).map((o: any) => ({
    ...o,
    items: typeof o.items === "string" ? JSON.parse(o.items) : (o.items || []),
  }))
}

export async function getTodayOrders(): Promise<SupabaseOrder[]> {
  return getOrdersByDate(new Date())
}

export interface UpdateOrderItemsData {
  items: OrderItem[]
  total: number
  modificationFee: number
  originalTotal: number
  modificationNotes: string
  deliveryType?: DeliveryType
  address?: string
  paymentMethod?: PaymentMethod
}

export async function quoteOrderItems(id: string, items: OrderItem[], total: number): Promise<SupabaseOrder | null> {
  const sb = getClient()
  if (!sb) return null
  const { data: updated, error } = await sb
    .from("orders")
    .update({ items, total, status: "cotizado", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  if (error) { console.error("quoteOrderItems error:", error); return null }
  return updated
}

export async function updateOrderItems(id: string, data: UpdateOrderItemsData): Promise<SupabaseOrder | null> {
  const sb = getClient()
  if (!sb) return null
  const { data: updated, error } = await sb
    .from("orders")
    .update({
      items: data.items,
      total: data.total,
      modification_fee: data.modificationFee,
      original_total: data.originalTotal,
      modification_notes: data.modificationNotes,
      ...(data.deliveryType !== undefined && { delivery_type: data.deliveryType }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.paymentMethod !== undefined && { payment_method: data.paymentMethod }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()
  if (error) { console.error("updateOrderItems error:", error); return null }
  return updated
}

export async function updateOrderDiscount(id: string, discount: number, currentTotal: number): Promise<SupabaseOrder | null> {
  const sb = getClient()
  if (!sb) return null
  const newTotal = Math.max(0, currentTotal - discount)
  const { data: updated, error } = await sb
    .from("orders")
    .update({ discount, total: newTotal, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  if (error) { console.error("updateOrderDiscount error:", error); return null }
  return updated
}

export async function clearDelivered(sinceIso?: string): Promise<boolean> {
  const sb = getClient()
  if (!sb) return false
  // Borrar solo los entregados desde el inicio del día laboral actual (o desde sinceIso si se pasa)
  // Si no se pasa fecha, usa medianoche de hoy en Santiago como límite inferior
  let cutoff = sinceIso
  if (!cutoff) {
    const now = new Date()
    const chiStr = now.toLocaleString("sv-SE", { timeZone: "America/Santiago" }).replace(" ", "T")
    const chiNow = new Date(chiStr + "Z")
    const offsetMs = now.getTime() - chiNow.getTime()
    chiNow.setUTCHours(0, 0, 0, 0)
    cutoff = new Date(chiNow.getTime() + offsetMs).toISOString()
  }
  const { error } = await sb
    .from("orders")
    .delete()
    .eq("status", "entregado")
    .gte("created_at", cutoff)
  if (error) { console.error("clearDelivered error:", error); return false }
  return true
}

// ── Contexto del cliente (para ChatPanel) ─────────────────────────
export interface ClientContext {
  totalOrders: number
  totalSpent: number
  lastOrderDate: string | null
  recentOrders: { id: string; total: number; status: string; items: string; created_at: string }[]
}

export async function getClientContext(phone: string): Promise<ClientContext> {
  const sb = getClient()
  const empty: ClientContext = { totalOrders: 0, totalSpent: 0, lastOrderDate: null, recentOrders: [] }
  if (!sb || !phone) return empty

  const phoneNorm = normalizePhone(phone)
  if (!phoneNorm) return empty

  // Bulk SIN la columna `items` (JSON pesado) — el match por teléfono debe ser
  // client-side porque el formato almacenado varía y normalizePhone usa los
  // últimos 9 dígitos. Limitamos las filas para acotar el egress.
  const { data, error } = await sb
    .from("orders")
    .select("id, total, status, created_at, client_phone")
    .order("created_at", { ascending: false })
    .limit(1000)

  if (error || !data) return empty

  const matched = data.filter((o: any) =>
    normalizePhone(o.client_phone || "") === phoneNorm
  )

  if (matched.length === 0) return empty

  // Traer `items` solo para los 3 pedidos recientes que se mostrarán.
  const recent = matched.slice(0, 3)
  const recentIds = recent.map((o: any) => o.id)
  let itemsById: Record<string, any[]> = {}
  if (recentIds.length > 0) {
    const { data: itemRows } = await sb
      .from("orders")
      .select("id, items")
      .in("id", recentIds)
    for (const row of itemRows || []) {
      const items = typeof row.items === "string" ? JSON.parse(row.items) : (row.items || [])
      itemsById[row.id] = items
    }
  }

  return {
    totalOrders: matched.length,
    totalSpent: matched.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
    lastOrderDate: matched[0].created_at,
    recentOrders: recent.map((o: any) => ({
      id: o.id,
      total: o.total,
      status: o.status,
      items: (itemsById[o.id] || []).map((i: any) => `${i.quantity}× ${i.name}`).join(", "),
      created_at: o.created_at,
    })),
  }
}

// ── Singleton Realtime store ───────────────────────────────────────
// Un solo canal WebSocket compartido entre todos los componentes.
// Múltiples suscriptores reciben el mismo snapshot sin duplicar conexiones.

type OrderListener = (orders: SupabaseOrder[]) => void
type OrderEventListener = (event: string, newRow: any, oldRow: any) => void

let _listeners: Set<OrderListener> = new Set()
let _eventListeners: Set<OrderEventListener> = new Set()
let _cachedOrders: SupabaseOrder[] = []
let _initialLoaded = false
let _channelActive = false
let _channelStarting = false

// ── Persistencia del cache en sessionStorage ──────────────────────
// Permite pintar la lista al instante tras un F5 (recarga completa) sin
// esperar el fetch. El fetch posterior revalida y reemplaza con datos frescos.
// Se usa sessionStorage (por pestaña, se limpia al cerrarla) para evitar datos
// obsoletos entre sesiones. Hay un tope de tamaño para no llenar la cuota.
const _CACHE_KEY = "pos_orders_cache_v1"
const _CACHE_MAX_BYTES = 1_000_000 // ~1MB

function _persistCache(orders: SupabaseOrder[]) {
  if (typeof window === "undefined") return
  try {
    const json = JSON.stringify(orders)
    if (json.length > _CACHE_MAX_BYTES) return // demasiado grande: no persistir
    sessionStorage.setItem(_CACHE_KEY, json)
  } catch {
    // Cuota llena u otro error: ignorar (el cache en memoria sigue funcionando)
  }
}

function _readPersistedCache(): SupabaseOrder[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function _broadcast(orders: SupabaseOrder[]) {
  _cachedOrders = orders
  _initialLoaded = true
  _persistCache(orders)
  _listeners.forEach((fn) => fn(orders))
}

// Días de historial cargados al iniciar — reducido para minimizar egress
const REALTIME_RANGE_DAYS = 2

function _normalizeOrder(row: any): SupabaseOrder {
  return {
    ...row,
    items: typeof row.items === "string" ? JSON.parse(row.items) : (row.items || []),
  }
}

function _applyChange(event: string, newRow: any, oldRow: any) {
  if (event === "DELETE") {
    const id = oldRow?.id
    if (!id) return
    _broadcast(_cachedOrders.filter((o) => o.id !== id))
    return
  }
  if (!newRow) return
  const incoming = _normalizeOrder(newRow)
  if (event === "INSERT") {
    if (_cachedOrders.some((o) => o.id === incoming.id)) return
    _broadcast([incoming, ..._cachedOrders])
    return
  }
  // UPDATE
  const idx = _cachedOrders.findIndex((o) => o.id === incoming.id)
  if (idx === -1) {
    _broadcast([incoming, ..._cachedOrders])
  } else {
    const next = _cachedOrders.slice()
    next[idx] = incoming
    _broadcast(next)
  }
}

function _ensureChannel() {
  if (_channelActive || _channelStarting) return
  _channelStarting = true
  const sb = getClient()
  if (!sb) { _channelStarting = false; return }

  // Hidratación instantánea: si hay cache persistido (tras un F5), píntalo de
  // inmediato mientras llega el fetch fresco que lo revalida y reemplaza.
  if (!_initialLoaded) {
    const persisted = _readPersistedCache()
    if (persisted && persisted.length > 0) {
      _cachedOrders = persisted
      _initialLoaded = true
      _listeners.forEach((fn) => fn(persisted))
    }
  }

  // Carga inicial — sólo últimos N días para minimizar egress
  getOrdersByDateRange(REALTIME_RANGE_DAYS).then((data) => {
    _broadcast(data)
  }).catch(() => {
    _initialLoaded = true
    _channelActive = false
    _channelStarting = false
    _listeners.forEach((fn) => fn([]))
  })

  sb.channel("orders-global")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      (payload: any) => {
        // Aplicar el cambio incrementalmente — sin refetch completo
        _applyChange(payload.eventType, payload.new, payload.old)
        // Notificar a listeners de eventos crudos (ej. notificaciones push)
        _eventListeners.forEach((fn) => fn(payload.eventType, payload.new, payload.old))
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        _channelActive = true
        _channelStarting = false
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        _channelActive = false
        _channelStarting = false // permite reintento la próxima vez
      }
    })

  // NOTA: El refetch en visibilitychange fue removido para reducir egress.
  // Realtime mantiene los datos sincronizados via WebSocket. Si la conexión
  // cae, _channelActive se marca false y se reintenta en la próxima suscripción.
}

/**
 * Suscribe un listener a los cambios de pedidos en tiempo real.
 * Usa un único canal WebSocket compartido (singleton).
 * Retorna una función de cleanup para desuscribirse.
 */
export function subscribeToOrders(onUpdate: OrderListener): () => void {
  _listeners.add(onUpdate)
  if (_initialLoaded) {
    // Ya hay datos (o carga completa con array vacío): entregar inmediatamente
    onUpdate(_cachedOrders)
  }
  _ensureChannel()
  return () => {
    _listeners.delete(onUpdate)
  }
}

/**
 * Suscribe un listener a eventos crudos de pedidos (INSERT/UPDATE/DELETE).
 * Reusa el mismo canal WebSocket compartido que subscribeToOrders, evitando
 * abrir un canal Realtime adicional (ahorra conexiones y mensajes).
 * Retorna una función de cleanup para desuscribirse.
 */
export function subscribeToOrderEvents(onEvent: OrderEventListener): () => void {
  _eventListeners.add(onEvent)
  _ensureChannel()
  return () => {
    _eventListeners.delete(onEvent)
  }
}

/**
 * Fuerza un refetch de pedidos y notifica a todos los listeners.
 * Llamar después de mutaciones locales para actualizar la UI sin esperar Realtime.
 */
export async function refreshOrders(): Promise<void> {
  const fresh = await getOrdersByDateRange(REALTIME_RANGE_DAYS)
  _broadcast(fresh)
}

/**
 * Aplica un cambio local al cache compartido SIN hacer fetch.
 * Refleja la mutación al instante en todos los listeners (UI optimista),
 * evitando el refetch completo de refreshOrders() (que descarga 2 días de
 * pedidos). El evento Realtime posterior es idempotente: para UPDATE reemplaza
 * por id, para INSERT el guard evita duplicar, para DELETE filtra por id.
 */
export function applyLocalOrderChange(
  event: "INSERT" | "UPDATE" | "DELETE",
  order: SupabaseOrder | Pick<SupabaseOrder, "id">
): void {
  if (event === "DELETE") _applyChange("DELETE", null, order)
  else _applyChange(event, order, null)
}
