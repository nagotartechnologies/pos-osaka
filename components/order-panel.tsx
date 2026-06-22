"use client"

import Image from "next/image"
import { Minus, Plus, ChevronRight, User, Phone } from "lucide-react"
import type { CartItem } from "@/lib/store"

export function OrderPanel({
  cart,
  onAdd,
  onRemove,
  onPlaceOrder,
  clientName,
  clientPhone,
  onClientNameChange,
  onClientPhoneChange,
}: {
  cart: CartItem[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  onPlaceOrder: () => void
  clientName: string
  clientPhone: string
  onClientNameChange: (v: string) => void
  onClientPhoneChange: (v: string) => void
}) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.1
  const discount = 0
  const total = subtotal + tax - discount

  return (
    <div className="flex h-full flex-col bg-card border-l border-border">
      {/* Order Type */}
      <div className="p-4">
        <button className="flex w-full items-center justify-between rounded-full border-2 border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors">
          Para Llevar
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3">
        {cart.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">No hay productos en el pedido</p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-card-foreground truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">x {item.quantity}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-sm font-bold text-card-foreground">$ {item.price}</p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onRemove(item.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      aria-label={`Remove one ${item.name}`}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-4 text-center text-xs font-semibold text-card-foreground">{item.quantity}</span>
                    <button
                      onClick={() => onAdd(item.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      aria-label={`Add one ${item.name}`}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Datos del Cliente */}
      <div className="border-t border-border px-4 pt-3 pb-1 space-y-2">
        <p className="text-xs font-bold text-card-foreground">Datos del Cliente</p>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={clientName}
            onChange={(e) => onClientNameChange(e.target.value)}
            placeholder="Nombre del cliente"
            className="w-full bg-transparent text-xs text-card-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <input
            type="tel"
            value={clientPhone}
            onChange={(e) => onClientPhoneChange(e.target.value)}
            placeholder="Teléfono / WhatsApp"
            className="w-full bg-transparent text-xs text-card-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {/* Pricing Summary */}
      <div className="border-t border-border p-4">
        <p className="text-sm font-bold text-card-foreground mb-2">Resumen de Precios</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Subtotal</span>
            <span className="text-xs font-semibold text-card-foreground">$ {subtotal}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Impuesto (10%)</span>
            <span className="text-xs font-semibold text-card-foreground">$ {tax.toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Descuento</span>
            <span className="text-xs font-semibold text-card-foreground">$ {discount}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-base font-bold text-primary">Total</span>
          <span className="text-base font-bold text-primary">$ {total.toFixed(1)}</span>
        </div>

        <button
          onClick={onPlaceOrder}
          className="mt-4 w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Realizar Pedido
        </button>
      </div>
    </div>
  )
}
