"use client"

import { X, Plus, MessageSquare } from "lucide-react"
import type { Product, CustomizationOption } from "@/lib/supabase-menu"

interface CustomizeModalProps {
  product: Product
  protein: CustomizationOption | null
  setProtein: (v: CustomizationOption | null) => void
  wrapper: CustomizationOption | null
  setWrapper: (v: CustomizationOption | null) => void
  instructions: string
  setInstructions: (v: string) => void
  triedConfirm: boolean
  hasCustomChange: boolean
  onConfirm: () => void
  onClose: () => void
}

export function CustomizeModal({
  product,
  protein,
  setProtein,
  wrapper,
  setWrapper,
  instructions,
  setInstructions,
  triedConfirm,
  hasCustomChange,
  onConfirm,
  onClose,
}: CustomizeModalProps) {
  const total = product.price + (protein?.price || 0) + (wrapper?.price || 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 fade-in duration-300 flex flex-col max-h-[85vh] bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground">{product.name}</h3>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs mt-0.5 text-muted-foreground">Personaliza tu producto (opcional)</p>
        </div>

        {/* Options */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {product.protein_options && product.protein_options.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2 text-muted-foreground">
                🥩 Proteína <span className="text-[9px] font-medium">(opcional)</span>
              </p>
              <div className="space-y-1.5">
                {product.protein_options.map((opt) => {
                  const isSelected = protein?.name === opt.name
                  return (
                    <button
                      key={opt.name}
                      onClick={() => setProtein(protein?.name === opt.name ? null : opt)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 transition-all text-left ${
                        isSelected ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-primary" : "border-muted-foreground/30"}`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <span className="text-sm font-medium capitalize text-card-foreground">{opt.name}</span>
                      </div>
                      <span className={`text-xs font-semibold ${opt.price > 0 ? "text-primary" : "text-emerald-500"}`}>
                        {opt.price > 0 ? `+$${opt.price.toLocaleString("es-CL")}` : "Base"}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {product.wrapper_options && product.wrapper_options.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2 text-muted-foreground">
                🍣 Envoltura <span className="text-[9px] font-medium">(opcional)</span>
              </p>
              <div className="space-y-1.5">
                {product.wrapper_options.map((opt) => {
                  const isSelected = wrapper?.name === opt.name
                  return (
                    <button
                      key={opt.name}
                      onClick={() => setWrapper(wrapper?.name === opt.name ? null : opt)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 transition-all text-left ${
                        isSelected ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-primary" : "border-muted-foreground/30"}`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <span className="text-sm font-medium capitalize text-card-foreground">{opt.name}</span>
                      </div>
                      <span className={`text-xs font-semibold ${opt.price > 0 ? "text-primary" : "text-emerald-500"}`}>
                        {opt.price > 0 ? `+$${opt.price.toLocaleString("es-CL")}` : "Base"}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Instructions (required if custom change) */}
        {hasCustomChange && (
          <div className="px-5 pb-1">
            <div className="flex items-center gap-1.5 mb-1.5">
              <MessageSquare className="h-3 w-3 text-primary" />
              <span className={`text-[10px] font-bold uppercase tracking-wide ${triedConfirm && !instructions.trim() ? "text-red-500" : "text-muted-foreground"}`}>
                Instrucciones *
              </span>
            </div>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Indica la cantidad de piezas que requieren el cambio. Ej: 5 piezas con camarón, 5 con pollo"
              rows={3}
              className={`w-full rounded-xl px-3.5 py-2.5 text-xs resize-none focus:outline-none border-2 transition-all bg-accent/30 text-card-foreground ${
                triedConfirm && !instructions.trim() ? "border-red-500" : "border-border"
              }`}
            />
            {triedConfirm && !instructions.trim() && (
              <p className="text-[10px] font-semibold mt-1 text-red-500">Debes indicar la cantidad de piezas que requieren cambio</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <div className="text-right">
              <span className="text-xl font-black text-foreground">${total.toLocaleString("es-CL")}</span>
              {((protein?.price || 0) + (wrapper?.price || 0)) > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Base ${product.price.toLocaleString("es-CL")} + extras ${((protein?.price || 0) + (wrapper?.price || 0)).toLocaleString("es-CL")}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onConfirm}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Agregar al pedido
          </button>
        </div>
      </div>
    </div>
  )
}
