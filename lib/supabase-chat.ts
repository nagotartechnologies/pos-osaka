/**
 * CRUD de mensajes de chat usando Supabase.
 * Incluye suscripción en tiempo real.
 */

import { getSharedClient } from "@/lib/supabase"
import { normalizePhone, chatIdFromPhone } from "@/lib/phone"
import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js"

// ── Tipos ──────────────────────────────────────────────────────────
export type MessageDirection = "incoming" | "outgoing"
export type MessageType = "text" | "file" | "status" | "image" | "audio"

export interface ChatMessage {
  id: string
  order_id: string
  phone: string
  direction: MessageDirection
  message: string
  type: MessageType
  media_url?: string | null
  read: boolean
  created_at: string
}

export interface UnreadCount {
  order_id: string
  count: number
}

// ── Cliente ────────────────────────────────────────────────────────
function getClient(): SupabaseClient {
  return getSharedClient()
}

// ── Flag: Realtime de chat ─────────────────────────────────────────
// El chat/WhatsApp no se usa actualmente (los pedidos llegan desde la
// pestaña Pedidos). Mantener este flag en `false` evita abrir canales
// Realtime sobre `chat_messages`, ahorrando conexiones y mensajes del
// plan de Supabase. Cambiar a `true` reactiva todo sin más cambios.
const CHAT_REALTIME_ENABLED = false

// ── Obtener mensajes de un cliente ─────────────────────────────────
// Si hay teléfono, trae TODOS los mensajes del número (todos sus pedidos)
// para mostrar el historial completo unificado del cliente.
export async function getMessagesByOrder(orderId: string, phone?: string): Promise<ChatMessage[]> {
  const sb = getClient()
  if (!sb) return []

  if (phone) {
    const phoneNorm = normalizePhone(phone)
    // Intentar con número normalizado primero
    const { data: d1 } = await sb
      .from("chat_messages")
      .select("*")
      .eq("phone", phoneNorm)
      .order("created_at", { ascending: true })
    if (d1 && d1.length > 0) return d1
    // Fallback con número original
    const { data: d2 } = await sb
      .from("chat_messages")
      .select("*")
      .eq("phone", phone)
      .order("created_at", { ascending: true })
    if (d2 && d2.length > 0) return d2
  }

  // Sin teléfono: buscar por order_id + CHAT-xxx
  const orderIds = [orderId]
  if (!orderId.startsWith("CHAT-")) {
    const chatId = chatIdFromPhone(orderId)
    if (!orderIds.includes(chatId)) orderIds.push(chatId)
  }
  const { data, error } = await sb
    .from("chat_messages")
    .select("*")
    .in("order_id", orderIds)
    .order("created_at", { ascending: true })
  if (error) {
    console.error("getMessagesByOrder error:", error)
    return []
  }
  return data || []
}

// ── Insertar un mensaje ────────────────────────────────────────────
export async function insertMessage(msg: {
  order_id: string
  phone: string
  direction: MessageDirection
  message: string
  type?: MessageType
}): Promise<ChatMessage | null> {
  const sb = getClient()
  if (!sb) return null
  const { data, error } = await sb
    .from("chat_messages")
    .insert({
      order_id: msg.order_id,
      phone: msg.phone,
      direction: msg.direction,
      message: msg.message,
      type: msg.type || "text",
      read: msg.direction === "outgoing",
    })
    .select()
    .single()
  if (error) {
    console.error("insertMessage error:", error)
    return null
  }
  return data
}

// ── Eliminar todos los mensajes de un chat ───────────────────────
export async function deleteMessagesByOrder(orderId: string, phone?: string): Promise<boolean> {
  const sb = getClient()
  if (!sb) return false
  // Eliminar también mensajes del CHAT-xxx del mismo teléfono
  const orderIds = [orderId]
  if (phone && !orderId.startsWith("CHAT-")) {
    const chatId = chatIdFromPhone(phone)
    if (!orderIds.includes(chatId)) orderIds.push(chatId)
  }
  const { error } = await sb
    .from("chat_messages")
    .delete()
    .in("order_id", orderIds)
  if (error) {
    console.error("deleteMessagesByOrder error:", error)
    return false
  }
  return true
}

// ── Eliminar todos los mensajes de un teléfono (todos sus pedidos) ──
export async function deleteMessagesByPhone(phone: string): Promise<boolean> {
  const sb = getClient()
  if (!sb) return false
  const phoneNorm = normalizePhone(phone)
  if (!phoneNorm) return false
  // Obtener todos los order_ids del teléfono y borrar de una vez
  const { data: msgs } = await sb
    .from("chat_messages")
    .select("order_id")
    .filter("phone", "like", `%${phoneNorm}%`)
  const orderIds = [...new Set((msgs || []).map((m: any) => m.order_id as string))]
  if (orderIds.length === 0) return true
  const { error } = await sb
    .from("chat_messages")
    .delete()
    .in("order_id", orderIds)
  if (error) { console.error("deleteMessagesByPhone error:", error); return false }
  return true
}

// ── Marcar mensajes como leídos ────────────────────────────────────
export async function markMessagesAsRead(orderId: string): Promise<void> {
  const sb = getClient()
  if (!sb) return
  const { error } = await sb
    .from("chat_messages")
    .update({ read: true })
    .eq("order_id", orderId)
    .eq("direction", "incoming")
    .eq("read", false)
  if (error) console.error("markMessagesAsRead error:", error)
}

// ── Contar mensajes no leídos por pedido ───────────────────────────
export async function getUnreadCounts(since?: string): Promise<Record<string, number>> {
  const sb = getClient()
  if (!sb) return {}
  let query = sb
    .from("chat_messages")
    .select("order_id, created_at")
    .eq("direction", "incoming")
    .eq("read", false)
  if (since) query = query.gte("created_at", since)
  const { data, error } = await query
  if (error) {
    console.error("getUnreadCounts error:", error)
    return {}
  }
  const counts: Record<string, number> = {}
  ;(data || []).forEach((row: { order_id: string }) => {
    counts[row.order_id] = (counts[row.order_id] || 0) + 1
  })
  return counts
}

// ── Obtener conversaciones activas (agrupadas) ─────────────────────
export interface ChatConversation {
  orderId: string
  phone: string
  clientName: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  hasActiveOrder: boolean
  orderStatus?: string
}

export async function getActiveConversations(): Promise<ChatConversation[]> {
  const sb = getClient()
  if (!sb) return []

  // Obtener mensajes recientes ordenados por fecha desc (límite para evitar cargar miles)
  const { data: messages, error } = await sb
    .from("chat_messages")
    .select("order_id, phone, message, created_at, direction, read")
    .order("created_at", { ascending: false })
    .limit(500)

  if (error || !messages) {
    console.error("getActiveConversations error:", error)
    return []
  }

  // ── Agrupar por teléfono normalizado → una entrada por cliente ─────
  const byPhone = new Map<string, {
    phone: string          // número original (primer mensaje encontrado)
    orderIds: Set<string>  // todos los order_ids del cliente
    lastMessage: string
    lastMessageTime: string
    unreadCount: number
  }>()

  for (const msg of messages) {
    const key = normalizePhone(msg.phone)
    if (!byPhone.has(key)) {
      byPhone.set(key, {
        phone: msg.phone,
        orderIds: new Set(),
        lastMessage: msg.message,
        lastMessageTime: msg.created_at,
        unreadCount: 0,
      })
    }
    const entry = byPhone.get(key)!
    entry.orderIds.add(msg.order_id)
    // primer mensaje desc ya es el más reciente (Supabase devuelve desc)
    if (msg.direction === "incoming" && !msg.read) {
      entry.unreadCount++
    }
  }

  // Obtener pedidos para cruzar nombre y status (buscar todos los order_ids reales)
  const allOrderIds = new Set<string>()
  for (const entry of byPhone.values()) {
    for (const id of entry.orderIds) {
      if (!id.startsWith("CHAT-")) allOrderIds.add(id)
    }
  }

  let ordersMap: Record<string, { client_name: string; status: string; client_phone: string }> = {}
  if (allOrderIds.size > 0) {
    const { data: orders } = await sb
      .from("orders")
      .select("id, client_name, status, client_phone")
      .in("id", Array.from(allOrderIds))
    if (orders) {
      for (const o of orders) {
        ordersMap[o.id] = { client_name: o.client_name, status: o.status, client_phone: o.client_phone }
      }
    }
  }

  // Construir conversaciones: un item por teléfono
  const conversations: ChatConversation[] = []

  for (const [, entry] of byPhone) {
    // Buscar el pedido más reciente (no CHAT-xxx) para este cliente
    let representativeOrderId: string | null = null
    let clientName: string | null = null
    let orderStatus: string | undefined

    for (const oid of entry.orderIds) {
      if (oid.startsWith("CHAT-")) continue
      const o = ordersMap[oid]
      if (o) {
        // Primer orden real encontrado (ya vienen desc por created_at)
        if (!representativeOrderId) {
          representativeOrderId = oid
          clientName = o.client_name
          orderStatus = o.status
        }
      }
    }

    // Si no hay pedido, usar el CHAT-xxx
    if (!representativeOrderId) {
      for (const oid of entry.orderIds) {
        if (oid.startsWith("CHAT-")) {
          representativeOrderId = oid
          break
        }
      }
    }

    if (!representativeOrderId) continue

    conversations.push({
      orderId: representativeOrderId,
      phone: entry.phone,
      clientName: clientName || entry.phone,
      lastMessage: entry.lastMessage,
      lastMessageTime: entry.lastMessageTime,
      unreadCount: entry.unreadCount,
      hasActiveOrder: !!clientName,
      orderStatus,
    })
  }

  // Ordenar: no leídos primero, luego por último mensaje
  conversations.sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1
    if (a.unreadCount === 0 && b.unreadCount > 0) return 1
    return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
  })

  return conversations
}

// ── Suscripción Realtime a nuevos mensajes (singleton compartido) ──
// Un único canal WebSocket para todos los suscriptores (sidebar, pedidos,
// whatsapp). Evita abrir un canal Realtime por componente, reduciendo
// conexiones y mensajes consumidos del plan de Supabase.
type ChatMessageListener = (msg: ChatMessage) => void
let _chatListeners: Set<ChatMessageListener> = new Set()
let _chatChannel: RealtimeChannel | null = null

function _ensureChatChannel() {
  if (!CHAT_REALTIME_ENABLED) return
  if (_chatChannel) return
  const sb = getClient()
  _chatChannel = sb
    .channel("chat_messages_realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages" },
      (payload) => {
        const msg = payload.new as ChatMessage
        _chatListeners.forEach((fn) => fn(msg))
      }
    )
    .subscribe()
}

/**
 * Suscribe un listener a nuevos mensajes de chat en tiempo real.
 * Reusa un único canal WebSocket compartido (singleton).
 * Devuelve un objeto con `unsubscribe()` para mantener compatibilidad con
 * los callers existentes (`channel.unsubscribe()`).
 */
export function subscribeToChatMessages(
  onNewMessage: ChatMessageListener
): { unsubscribe: () => void } {
  _chatListeners.add(onNewMessage)
  _ensureChatChannel()
  return {
    unsubscribe: () => {
      _chatListeners.delete(onNewMessage)
    },
  }
}

// ── Suscripción Realtime para un pedido específico ─────────────────
export function subscribeToChatByOrder(
  orderId: string,
  onNewMessage: (msg: ChatMessage) => void
): RealtimeChannel {
  const sb = getClient()
  const channel = sb
    .channel(`chat_order_${orderId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `order_id=eq.${orderId}`,
      },
      (payload) => {
        onNewMessage(payload.new as ChatMessage)
      }
    )
  // Solo abrir el WebSocket si el Realtime de chat está habilitado.
  if (CHAT_REALTIME_ENABLED) channel.subscribe()
  return channel
}

// ── Suscripción Realtime por teléfono (todos los pedidos del cliente) ─────
export function subscribeToChatByPhone(
  phone: string,
  onNewMessage: (msg: ChatMessage) => void
): RealtimeChannel {
  const sb = getClient()
  const phoneNorm = normalizePhone(phone)
  const channel = sb
    .channel(`chat_phone_${phoneNorm}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages" },
      (payload) => {
        const msg = payload.new as ChatMessage
        if (normalizePhone(msg.phone) === phoneNorm) {
          onNewMessage(msg)
        }
      }
    )
  // Solo abrir el WebSocket si el Realtime de chat está habilitado.
  if (CHAT_REALTIME_ENABLED) channel.subscribe()
  return channel
}
