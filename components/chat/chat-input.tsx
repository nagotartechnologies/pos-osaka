"use client"

import { useState, useRef } from "react"
import { Send, Loader2, ImageIcon, Zap, BookOpen, X } from "lucide-react"
import { insertMessage } from "@/lib/supabase-chat"
import { uploadImage } from "@/lib/cloudinary"
import { getSharedClient } from "@/lib/supabase"
import type { QuickReply } from "@/lib/supabase-quick-replies"

interface ChatInputProps {
  orderId: string
  clientName: string
  clientPhone: string
  businessName: string
  quickReplies: QuickReply[]
  onError: (msg: string) => void
  onClearError: () => void
}

export function ChatInput({
  orderId,
  clientName,
  clientPhone,
  businessName,
  quickReplies,
  onError,
  onClearError,
}: ChatInputProps) {
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [sendingCarta, setSendingCarta] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || ""

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    onClearError()
    setInput("")

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-token": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" },
        body: JSON.stringify({ phone: clientPhone, message: text }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        onError(errBody?.error || `HTTP ${res.status}`)
        setInput(text)
        return
      }
      await insertMessage({ order_id: orderId, phone: clientPhone, direction: "outgoing", message: text, type: "text" })
    } catch (err: any) {
      onError(err?.message || "Error al enviar")
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  const handleImageSend = async (files: File[]) => {
    if (!files.length || uploadingImage) return
    setUploadingImage(true)
    setUploadProgress({ current: 0, total: files.length })
    onClearError()
    const sb = getSharedClient()
    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length })
      try {
        const imageUrl = await uploadImage(files[i], "chat-media")
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-token": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" },
          body: JSON.stringify({ phone: clientPhone, type: "url", fileUrl: imageUrl, fileName: files[i].name, caption: "" }),
        })
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          onError(errBody?.error || `HTTP ${res.status}`)
          continue
        }
        await insertMessage({ order_id: orderId, phone: clientPhone, direction: "outgoing", message: "📷 Imagen", type: "image" })
        if (sb) {
          const { data: last } = await sb.from("chat_messages").select("id").eq("order_id", orderId).eq("direction", "outgoing").eq("type", "image").order("created_at", { ascending: false }).limit(1)
          if (last?.[0]?.id) await sb.from("chat_messages").update({ media_url: imageUrl }).eq("id", last[0].id)
        }
      } catch (err: any) {
        onError(err?.message || `Error al enviar imagen ${i + 1}`)
      }
    }
    setUploadingImage(false)
    setUploadProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleSendCarta = async () => {
    if (sendingCarta) return
    setSendingCarta(true)
    try {
      const sb = getSharedClient()
      const { data: configRows } = await sb.from("config").select("key, value").in("key", ["cartaCode", "nombreNegocio"])
      const cfg: Record<string, string> = {}
      ;(configRows || []).forEach((r: any) => { cfg[r.key] = r.value })
      if (!cfg.cartaCode) { onError("No hay código de carta configurado"); return }
      const siteUrl = SITE_URL || window.location.origin
      const phoneParam = clientPhone ? `?phone=${encodeURIComponent(clientPhone)}` : ""
      const nameParam = clientName ? `&name=${encodeURIComponent(clientName)}` : ""
      const cartaLink = `${siteUrl}/carta/${cfg.cartaCode}${phoneParam}${nameParam}`
      const bizName = cfg.nombreNegocio || "nuestro restaurante"
      const msg = `👉 Aquí está nuestra carta de *${bizName}*:\n${cartaLink}`
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-token": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" },
        body: JSON.stringify({ phone: clientPhone, message: msg }),
      })
      if (!res.ok) { onError("Error al enviar la carta"); return }
      await insertMessage({ order_id: orderId, phone: clientPhone, direction: "outgoing", message: msg, type: "text" })
    } catch {
      onError("Error al enviar la carta")
    } finally {
      setSendingCarta(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="border-t border-border bg-[#f0f2f5] dark:bg-card px-3 py-2">
      {/* Upload progress */}
      {uploadingImage && uploadProgress && (
        <div className="mb-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-[11px] font-semibold text-primary">
              {uploadProgress.total > 1 ? `Subiendo ${uploadProgress.current}/${uploadProgress.total}...` : "Subiendo imagen..."}
            </span>
          </div>
        </div>
      )}

      {/* Quick Replies Popup */}
      {showQuickReplies && quickReplies.length > 0 && (
        <div className="mb-2 rounded-lg bg-card border border-border p-2 max-h-40 overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Respuestas rápidas</p>
            <button onClick={() => setShowQuickReplies(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-0.5">
            {quickReplies.map((qr) => (
              <button
                key={qr.id}
                onClick={() => {
                  const text = qr.message
                    .replace(/\{nombre\}/g, clientName)
                    .replace(/\{pedido\}/g, orderId)
                    .replace(/\{negocio\}/g, businessName)
                  setInput(text)
                  setShowQuickReplies(false)
                  inputRef.current?.focus()
                }}
                className="w-full text-left rounded-md px-2.5 py-1.5 hover:bg-accent transition-colors"
              >
                <p className="text-xs font-semibold text-foreground">{qr.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{qr.message}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || [])
            if (files.length) handleImageSend(files)
          }}
        />
        {/* Image button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage || sending}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          title="Enviar imágenes"
        >
          {uploadingImage ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
        </button>
        {/* Carta button */}
        {clientPhone && (
          <button
            onClick={handleSendCarta}
            disabled={sendingCarta || sending}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-emerald-500 transition-colors disabled:opacity-50"
            title="Reenviar carta"
          >
            {sendingCarta ? <Loader2 className="h-5 w-5 animate-spin" /> : <BookOpen className="h-5 w-5" />}
          </button>
        )}
        {/* Quick replies */}
        {quickReplies.length > 0 && (
          <button
            onClick={() => setShowQuickReplies(!showQuickReplies)}
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
              showQuickReplies ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <Zap className="h-5 w-5" />
          </button>
        )}
        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje"
          disabled={sending}
          className="flex-1 rounded-lg border-none bg-card dark:bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
        />
        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
