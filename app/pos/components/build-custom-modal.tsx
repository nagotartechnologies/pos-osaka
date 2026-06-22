"use client"

import { X, MessageSquare } from "lucide-react"
import type { Product } from "@/lib/supabase-menu"

interface BuildCustomModalProps {
  product: Product
  notes: string
  setNotes: (v: string) => void
  triedConfirm: boolean
  onConfirm: () => void
  onClose: () => void
}

export function BuildCustomModal({ product, notes, setNotes, triedConfirm, onConfirm, onClose }: BuildCustomModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card overflow-hidden animate-in zoom-in-95 fade-in duration-200 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎨</span>
              <h3 className="text-sm font-bold text-card-foreground">Ármalo a tu pinta</h3>
            </div>
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Base: <span className="font-semibold text-card-foreground">{product.name}</span> · Ref. ${product.price.toLocaleString("es-CL")}
          </p>
          <div className="mt-2 rounded-lg px-3 py-2 bg-amber-500/5 border border-amber-500/20">
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              El precio final será confirmado por el vendedor y enviado por WhatsApp.
            </p>
          </div>
        </div>

        <div className="px-5 pb-2 flex-1">
          <div className="flex items-center gap-1.5 mb-1.5">
            <MessageSquare className="h-3 w-3" style={{ color: triedConfirm && !notes.trim() ? "rgb(239,68,68)" : "rgb(217,119,6)" }} />
            <span className={`text-[10px] font-bold uppercase tracking-wide ${triedConfirm && !notes.trim() ? "text-red-500" : "text-muted-foreground"}`}>
              Describe cómo lo quieres *
            </span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: 5 piezas con camarón tempura, 3 con salmón flameado, sin palta..."
            rows={4}
            className={`w-full rounded-xl bg-accent px-3.5 py-2.5 text-xs resize-none focus:outline-none border-2 transition-all ${
              triedConfirm && !notes.trim() ? "border-red-500" : "border-border"
            }`}
          />
          {triedConfirm && !notes.trim() && (
            <p className="text-[10px] font-semibold mt-1 text-red-500">Debes describir cómo quieres tu producto</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border">
          <button
            onClick={onConfirm}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all active:scale-[0.98]"
          >
            🎨 Agregar a tu pinta
          </button>
        </div>
      </div>
    </div>
  )
}
