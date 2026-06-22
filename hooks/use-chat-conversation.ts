"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  getMessagesByOrder,
  markMessagesAsRead,
  subscribeToChatByPhone,
  type ChatMessage,
} from "@/lib/supabase-chat"
import { deleteCloudinaryImage } from "@/lib/cloudinary"
import { getSharedClient } from "@/lib/supabase"
import { getClientContext, type ClientContext } from "@/lib/supabase-orders"

interface UseChatConversationOpts {
  phone: string
  orderId: string
  active: boolean
}

export function useChatConversation({ phone, orderId, active }: UseChatConversationOpts) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [clientCtx, setClientCtx] = useState<ClientContext | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const deletedUrls = useRef(new Set<string>())

  const isNearBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }, [])

  // Cargar mensajes
  useEffect(() => {
    if (!active || !orderId) return
    setLoading(true)
    setMessages([])
    getMessagesByOrder(orderId, phone).then((msgs) => {
      setMessages(msgs)
      setLoading(false)
    })
    markMessagesAsRead(orderId)
    if (phone) getClientContext(phone).then(setClientCtx)
  }, [active, orderId, phone])

  // Realtime por teléfono
  useEffect(() => {
    if (!active || !phone) return
    const channel = subscribeToChatByPhone(phone, (newMsg) => {
      setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg])
      if (newMsg.direction === "incoming") markMessagesAsRead(newMsg.order_id)
    })
    return () => { channel.unsubscribe() }
  }, [active, phone])

  // Scroll al final
  useEffect(() => {
    if (isNearBottom()) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isNearBottom])

  // Auto-eliminar imágenes Cloudinary (3 min)
  useEffect(() => {
    if (!active) return
    const imgs = messages.filter((m) => m.type === "image" && m.media_url && !deletedUrls.current.has(m.media_url!))
    if (!imgs.length) return
    const timers = imgs.map((msg) =>
      setTimeout(async () => {
        const url = msg.media_url!
        deletedUrls.current.add(url)
        await deleteCloudinaryImage(url)
        const sb = getSharedClient()
        if (sb) await sb.from("chat_messages").update({ media_url: null }).eq("id", msg.id)
        setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, media_url: null } : m))
      }, 3 * 60 * 1000)
    )
    return () => timers.forEach(clearTimeout)
  }, [active, messages])

  return {
    messages,
    loading,
    clientCtx,
    messagesEndRef,
    containerRef,
  }
}
