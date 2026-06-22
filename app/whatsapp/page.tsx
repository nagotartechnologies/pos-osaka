"use client"

import { useState, useEffect, useMemo } from "react"
import { MessageCircle, Search, X, User, Loader2, Trash2 } from "lucide-react"
import {
  getActiveConversations,
  subscribeToChatMessages,
  deleteMessagesByPhone,
  markMessagesAsRead,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/supabase-chat"
import { getQuickReplies, type QuickReply } from "@/lib/supabase-quick-replies"
import { getAllConfig } from "@/lib/supabase-config"
import { MessageBubble, DateSeparator } from "@/components/chat/message-bubble"
import { ChatInput } from "@/components/chat/chat-input"
import { ClientContextPanel } from "@/components/chat/client-context"
import { useNotificationSound } from "@/hooks/use-notification-sound"
import { useChatConversation } from "@/hooks/use-chat-conversation"
import { groupMessagesByDate, formatConvTime } from "@/lib/chat-utils"

export default function WhatsAppPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [search, setSearch] = useState("")
  const [activeConv, setActiveConv] = useState<ChatConversation | null>(null)
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [showContext, setShowContext] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState("")
  const [waStatus, setWaStatus] = useState<"authorized" | "not_configured" | "offline" | "loading">("loading")
  const [msgSearch, setMsgSearch] = useState("")
  const [showMsgSearch, setShowMsgSearch] = useState(false)
  const { playNotificationSound, showNativeNotification } = useNotificationSound()

  // Hook compartido para la conversación activa
  const chat = useChatConversation({
    phone: activeConv?.phone ?? "",
    orderId: activeConv?.orderId ?? "",
    active: !!activeConv,
  })

  // Cargar conversaciones + config
  useEffect(() => {
    setLoadingConvs(true)
    getActiveConversations().then((c) => { setConversations(c); setLoadingConvs(false) })
    getQuickReplies().then(setQuickReplies)
    getAllConfig().then((cfg) => { if (cfg.nombreNegocio) setBusinessName(cfg.nombreNegocio) })
    fetch("/api/whatsapp/status")
      .then(r => r.json())
      .then(d => setWaStatus(d.status === "authorized" ? "authorized" : d.status === "not_configured" ? "not_configured" : "offline"))
      .catch(() => setWaStatus("offline"))
  }, [])

  // Realtime global: refrescar lista + notificaciones
  useEffect(() => {
    const channel = subscribeToChatMessages((msg: ChatMessage) => {
      getActiveConversations().then(setConversations)
      if (msg.direction === "incoming") {
        playNotificationSound()
        showNativeNotification("Nuevo mensaje", msg.message.slice(0, 100))
      }
    })
    return () => { channel.unsubscribe() }
  }, [])

  // Marcar como leído al seleccionar conversación
  useEffect(() => {
    if (!activeConv) return
    setShowContext(false); setMsgSearch(""); setShowMsgSearch(false)
    markMessagesAsRead(activeConv.orderId).then(() => {
      setConversations((prev) => prev.map((c) => c.orderId === activeConv.orderId ? { ...c, unreadCount: 0 } : c))
    })
  }, [activeConv?.orderId])

  // Filtrar conversaciones
  const filteredConvs = useMemo(() => {
    if (!search.trim()) return conversations
    const q = search.toLowerCase()
    return conversations.filter((c) => c.clientName.toLowerCase().includes(q) || c.phone.includes(q))
  }, [conversations, search])

  // Mensajes filtrados + agrupados
  const filteredMsgs = msgSearch.trim()
    ? chat.messages.filter(m => m.message.toLowerCase().includes(msgSearch.toLowerCase()))
    : chat.messages
  const grouped = groupMessagesByDate(filteredMsgs)

  return (
    <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen overflow-hidden bg-[#eae6df] dark:bg-background">
      {/* ═══ Panel izquierdo: Lista de chats ═══ */}
      <div className={`flex flex-col border-r border-border bg-card w-full md:w-[380px] lg:w-[420px] flex-shrink-0 ${activeConv ? "hidden md:flex" : "flex"}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#f0f2f5] dark:bg-muted/30 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
              <MessageCircle className="h-4.5 w-4.5 text-emerald-500" />
              <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#f0f2f5] dark:border-muted/30 ${
                waStatus === "authorized" ? "bg-emerald-500" : waStatus === "loading" ? "bg-yellow-500 animate-pulse" : waStatus === "not_configured" ? "bg-gray-400" : "bg-red-500"
              }`} />
            </div>
            <span className="text-sm font-semibold text-foreground">Chats</span>
            {conversations.length > 0 && (
              <span className="text-[10px] text-muted-foreground">{conversations.length}</span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 bg-card border-b border-border">
          <div className="flex items-center gap-2 rounded-lg bg-[#f0f2f5] dark:bg-muted/30 px-3 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar o empezar un chat"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="p-8 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground">{search ? "Sin resultados" : "Sin conversaciones"}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredConvs.map((conv) => {
                const initials = conv.clientName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
                const isOnlyDigits = /^\d+$/.test(conv.clientName.replace(/\s/g, ""))
                const isActive = activeConv?.orderId === conv.orderId
                return (
                  <div
                    key={conv.orderId}
                    className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors ${
                      isActive
                        ? "bg-[#f0f2f5] dark:bg-muted/30"
                        : conv.unreadCount > 0
                        ? "bg-emerald-500/[0.03] hover:bg-[#f5f6f6] dark:hover:bg-muted/15"
                        : "hover:bg-[#f5f6f6] dark:hover:bg-muted/15"
                    }`}
                    onClick={() => setActiveConv(conv)}
                  >
                    {/* Avatar */}
                    <div className={`flex h-[49px] w-[49px] flex-shrink-0 items-center justify-center rounded-full ${
                      isOnlyDigits ? "bg-gray-200 dark:bg-muted" : "bg-emerald-500/10"
                    }`}>
                      {isOnlyDigits ? (
                        <User className="h-5 w-5 text-gray-500 dark:text-muted-foreground" />
                      ) : (
                        <span className="text-[15px] font-bold text-emerald-700 dark:text-emerald-400">{initials}</span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-[14px] truncate ${conv.unreadCount > 0 ? "font-bold text-foreground" : "font-normal text-foreground"}`}>
                          {conv.clientName}
                        </p>
                        <span className={`text-[11px] flex-shrink-0 ml-2 ${conv.unreadCount > 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                          {formatConvTime(conv.lastMessageTime)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className={`text-[13px] truncate flex-1 pr-2 ${conv.unreadCount > 0 ? "text-foreground/80 font-medium" : "text-muted-foreground"}`}>
                          {conv.lastMessage}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[11px] font-bold text-white flex-shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Panel derecho: Conversación ═══ */}
      <div className={`flex-1 flex flex-col min-w-0 ${!activeConv ? "hidden md:flex" : "flex"}`}>
        {!activeConv ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#f0f2f5] dark:bg-muted/10">
            <div className="w-[260px] h-[260px] flex items-center justify-center mb-6">
              <MessageCircle className="h-24 w-24 text-muted-foreground/15" strokeWidth={1} />
            </div>
            <h2 className="text-2xl font-light text-foreground/70 mb-2">WhatsApp Osaka</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Envía y recibe mensajes de tus clientes. Selecciona un chat para empezar.
            </p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-[#f0f2f5] dark:bg-card flex-shrink-0">
              <div className="flex items-center gap-3">
                {/* Back button mobile */}
                <button
                  onClick={() => setActiveConv(null)}
                  className="md:hidden flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
                {/* Avatar */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                  {/^\d+$/.test(activeConv.clientName.replace(/\s/g, "")) ? (
                    <User className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      {activeConv.clientName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{activeConv.clientName}</p>
                  <p className="text-[11px] text-muted-foreground">{activeConv.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => { setShowContext(!showContext); setShowMsgSearch(false) }}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${showContext ? "bg-primary/10 text-primary" : "hover:bg-accent text-muted-foreground"}`}
                  title="Historial del cliente"
                >
                  <User className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { setShowMsgSearch(!showMsgSearch); if (showMsgSearch) setMsgSearch(""); setShowContext(false) }}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${showMsgSearch ? "bg-primary/10 text-primary" : "hover:bg-accent text-muted-foreground"}`}
                  title="Buscar en mensajes"
                >
                  <Search className="h-4 w-4" />
                </button>
                <button
                  onClick={async () => {
                    if (!activeConv) return
                    await deleteMessagesByPhone(activeConv.phone)
                    setConversations((prev) => prev.filter((c) => c.phone !== activeConv.phone))
                    setActiveConv(null)
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                  title="Eliminar historial"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Search bar */}
            {showMsgSearch && (
              <div className="border-b border-border bg-card/50 px-4 py-2">
                <div className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    value={msgSearch}
                    onChange={(e) => setMsgSearch(e.target.value)}
                    placeholder="Buscar en la conversación..."
                    autoFocus
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  {msgSearch && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {filteredMsgs.length} resultado{filteredMsgs.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  <button onClick={() => { setMsgSearch(""); setShowMsgSearch(false) }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Client context */}
            {showContext && <ClientContextPanel clientCtx={chat.clientCtx} clientPhone={activeConv.phone} />}

            {/* Messages */}
            <div
              ref={chat.containerRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
              style={{
                backgroundColor: "var(--background)",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            >
              {chat.loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : chat.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageCircle className="h-12 w-12 text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">No hay mensajes aún</p>
                </div>
              ) : (
                grouped.map((item: any, i: number) =>
                  "_type" in item ? (
                    <DateSeparator key={`date-${i}`} date={item.label} />
                  ) : (
                    <MessageBubble key={item.id} msg={item} onImageClick={setLightboxUrl} />
                  )
                )
              )}
              <div ref={chat.messagesEndRef} />
            </div>

            {/* Error */}
            {sendError && (
              <div className="mx-3 mb-1 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5">
                <span className="text-[11px] text-red-500 flex-1">⚠ {sendError}</span>
                <button onClick={() => setSendError(null)} className="text-red-400 hover:text-red-500 text-xs flex-shrink-0">✕</button>
              </div>
            )}

            {/* Input */}
            <ChatInput
              orderId={activeConv.orderId}
              clientName={activeConv.clientName}
              clientPhone={activeConv.phone}
              businessName={businessName}
              quickReplies={quickReplies}
              onError={(msg) => setSendError(msg)}
              onClearError={() => setSendError(null)}
            />
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors" onClick={() => setLightboxUrl(null)}>
            <X className="h-6 w-6" />
          </button>
          <img src={lightboxUrl} alt="Imagen ampliada" className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
