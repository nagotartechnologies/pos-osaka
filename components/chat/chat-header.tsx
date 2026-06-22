"use client"

import { MessageCircle, ChevronDown, ChevronUp, ShoppingCart, Search, Trash2, X } from "lucide-react"

interface ChatHeaderProps {
  clientName: string
  clientPhone: string
  orderId: string
  waStatus: "authorized" | "not_configured" | "offline" | "loading"
  showContext: boolean
  setShowContext: (v: boolean) => void
  showSearch: boolean
  setShowSearch: (v: boolean) => void
  onDeleteHistory: () => void
  onOpenPOS?: (name: string, phone: string) => void
  onClose: () => void
}

export function ChatHeader({
  clientName,
  clientPhone,
  orderId,
  waStatus,
  showContext,
  setShowContext,
  showSearch,
  setShowSearch,
  onDeleteHistory,
  onOpenPOS,
  onClose,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-[#f0f2f5] dark:bg-card">
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
          <MessageCircle className="h-5 w-5 text-emerald-500" />
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${
              waStatus === "authorized" ? "bg-emerald-500" :
              waStatus === "loading" ? "bg-yellow-500 animate-pulse" :
              waStatus === "not_configured" ? "bg-gray-400" : "bg-red-500"
            }`}
            title={
              waStatus === "authorized" ? "WhatsApp conectado" :
              waStatus === "loading" ? "Verificando conexión..." :
              waStatus === "not_configured" ? "WhatsApp no configurado" : "WhatsApp desconectado"
            }
          />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{clientName}</p>
          <p className="text-[11px] text-muted-foreground">{clientPhone} · Pedido {orderId}</p>
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        {clientPhone && (
          <button
            onClick={() => setShowContext(!showContext)}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
            title="Ver historial del cliente"
          >
            {showContext ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        )}
        {clientPhone && onOpenPOS && (
          <button
            onClick={() => onOpenPOS(clientName, clientPhone)}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
            title="Nuevo pedido en POS"
          >
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${showSearch ? "bg-primary/10 text-primary" : "hover:bg-accent text-muted-foreground"}`}
          title="Buscar en mensajes"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          onClick={onDeleteHistory}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
          title="Eliminar historial"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}
