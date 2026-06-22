/**
 * Store de pedidos entrantes (desde carta digital).
 * Persiste en localStorage.
 */

const ORDERS_KEY = "pos-osaka-orders"

export type OrderStatus = "recibido" | "preparando" | "en-camino" | "entregado" | "cancelado"
export type PaymentMethod = "efectivo" | "transferencia" | "tarjeta"
export type PaymentStatus = "na" | "pendiente" | "aprobado" | "rechazado"
export type DeliveryType = "delivery" | "retiro"

export interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  notes?: string
}

export interface IncomingOrder {
  id: string
  items: OrderItem[]
  total: number
  clientName: string
  clientPhone: string
  deliveryType: DeliveryType
  address: string
  paymentMethod: PaymentMethod
  cashAmount: number | null
  change: number | null
  paymentStatus: PaymentStatus
  receiptUrl: string | null
  status: OrderStatus
  createdAt: string
  updatedAt: string
}

function generateOrderId(): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  const seq = Math.floor(Math.random() * 900) + 100
  return `PED-${pad(now.getHours())}${pad(now.getMinutes())}-${seq}`
}

function loadAll(): IncomingOrder[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(ORDERS_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveAll(orders: IncomingOrder[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
}

export function getOrders(): IncomingOrder[] {
  return loadAll()
}

export function getOrdersByStatus(status: OrderStatus): IncomingOrder[] {
  return loadAll().filter((o) => o.status === status)
}

export function countByStatus(status: OrderStatus): number {
  return loadAll().filter((o) => o.status === status).length
}

export function addOrder(data: Omit<IncomingOrder, "id" | "status" | "createdAt" | "updatedAt" | "paymentStatus" | "receiptUrl"> & { receiptUrl?: string | null }): IncomingOrder {
  const now = new Date().toISOString()
  const isTransfer = data.paymentMethod === "transferencia"
  const order: IncomingOrder = {
    ...data,
    id: generateOrderId(),
    status: "recibido",
    paymentStatus: isTransfer ? "pendiente" : "na",
    receiptUrl: data.receiptUrl || null,
    createdAt: now,
    updatedAt: now,
  }
  const all = loadAll()
  all.unshift(order)
  saveAll(all)
  return order
}

export function updateOrderStatus(id: string, status: OrderStatus): IncomingOrder | null {
  const all = loadAll()
  const idx = all.findIndex((o) => o.id === id)
  if (idx === -1) return null
  all[idx].status = status
  all[idx].updatedAt = new Date().toISOString()
  saveAll(all)
  return all[idx]
}

export function deleteOrder(id: string): void {
  const all = loadAll().filter((o) => o.id !== id)
  saveAll(all)
}

export function updatePaymentStatus(id: string, paymentStatus: PaymentStatus): IncomingOrder | null {
  const all = loadAll()
  const idx = all.findIndex((o) => o.id === id)
  if (idx === -1) return null
  all[idx].paymentStatus = paymentStatus
  all[idx].updatedAt = new Date().toISOString()
  saveAll(all)
  return all[idx]
}

export function clearDelivered(): void {
  const all = loadAll().filter((o) => o.status !== "entregado")
  saveAll(all)
}
