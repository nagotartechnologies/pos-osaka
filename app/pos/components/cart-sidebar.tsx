"use client"

import { Minus, Plus, Trash2, User, Phone, MapPin, Truck, Store, Banknote, CreditCard, ArrowRightLeft, Check, Loader2, ShoppingCart } from "lucide-react"
import type { CartItem } from "../types"
import { SALSAS, MAX_FREE_SALSAS } from "../types"
import type { DeliveryType, PaymentMethod } from "@/lib/supabase-orders"

interface CartSidebarProps {
  cart: CartItem[]
  updateQty: (key: string, delta: number) => void
  removeFromCart: (key: string) => void
  getItemUnitPrice: (item: CartItem) => number
  getCartQty: (id: string) => number
  cartTotal: number
  orderTotal: number
  cartCount: number
  // Salsas
  addSalsa: (salsa: typeof SALSAS[number]) => void
  getSalsaLimitReached: (id: string) => boolean
  // Client
  clientName: string
  setClientName: (v: string) => void
  clientPhone: string
  setClientPhone: (v: string) => void
  deliveryType: DeliveryType
  setDeliveryType: (v: DeliveryType) => void
  address: string
  setAddress: (v: string) => void
  paymentMethod: PaymentMethod
  setPaymentMethod: (v: PaymentMethod) => void
  cardType: "debito" | "credito" | null
  setCardType: (v: "debito" | "credito" | null) => void
  cashAmount: string
  setCashAmount: (v: string) => void
  deliveryFee: number
  submitting: boolean
  onSubmit: () => void
}

export function CartSidebar({
  cart,
  updateQty,
  removeFromCart,
  getItemUnitPrice,
  getCartQty,
  cartTotal,
  orderTotal,
  cartCount,
  addSalsa,
  getSalsaLimitReached,
  clientName,
  setClientName,
  clientPhone,
  setClientPhone,
  deliveryType,
  setDeliveryType,
  address,
  setAddress,
  paymentMethod,
  setPaymentMethod,
  cardType,
  setCardType,
  cashAmount,
  setCashAmount,
  deliveryFee,
  submitting,
  onSubmit,
}: CartSidebarProps) {
  const canSubmit = clientName.trim().length > 0 && cart.length > 0 && !submitting

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <ShoppingCart className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Pedido</h2>
        {cartCount > 0 && (
          <span className="ml-auto text-xs font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
            {cartCount}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <ShoppingCart className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Agrega productos</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Toca un producto para agregarlo</p>
          </div>
        ) : (
          <div className="px-3 py-3 space-y-4">
            {/* Cart items */}
            <div className="space-y-2">
              {cart.filter((i) => !i.id.startsWith("salsa-")).map((item) => {
                const key = item.cartKey || item.id
                const unitPrice = getItemUnitPrice(item)
                return (
                  <div key={key} className="flex items-center gap-2 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-card-foreground truncate">{item.name}</p>
                      {(item.selectedProtein || item.selectedWrapper) && (
                        <p className="text-[9px] text-muted-foreground truncate">
                          {[item.selectedProtein?.name, item.selectedWrapper?.name].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {item.customBuild && (
                        <p className="text-[9px] text-amber-600 truncate">🎨 A tu pinta</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(key, -1)} className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-foreground hover:bg-accent/80">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(key, 1)} className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-foreground hover:bg-accent/80">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-xs font-semibold text-card-foreground w-14 text-right">
                      ${(unitPrice * item.quantity).toLocaleString("es-CL")}
                    </span>
                    <button onClick={() => removeFromCart(key)} className="p-0.5 text-red-500 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Salsas */}
            <div className="border-t border-border/50 pt-3">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">🫙 Salsas</p>
              <p className="text-[9px] text-muted-foreground mb-1.5">Soya y Agridulce gratis (máx. {MAX_FREE_SALSAS}) · Acevichada $500</p>
              <div className="space-y-1">
                {SALSAS.map((salsa) => {
                  const qty = getCartQty(salsa.id)
                  const isFree = salsa.price === 0
                  const limitReached = getSalsaLimitReached(salsa.id)
                  return (
                    <div key={salsa.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-card-foreground">{salsa.name}</p>
                        <span className={`text-[9px] font-medium ${isFree ? "text-emerald-500" : "text-primary"}`}>
                          {isFree ? "Gratis" : "$500"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {qty > 0 && (
                          <>
                            <button onClick={() => updateQty(salsa.id, -1)} className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-foreground hover:bg-accent/80">
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-xs font-bold w-5 text-center">{qty}</span>
                          </>
                        )}
                        <button
                          disabled={limitReached}
                          onClick={() => addSalsa(salsa)}
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Client info */}
            <div className="border-t border-border/50 pt-3 space-y-2.5">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                  <User className="h-3 w-3" /> Nombre *
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nombre del cliente"
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                  <Phone className="h-3 w-3" /> Teléfono
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>

              {/* Delivery */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Entrega</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setDeliveryType("retiro")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${
                      deliveryType === "retiro" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    <Store className="h-3.5 w-3.5" /> Retiro
                  </button>
                  <button
                    onClick={() => setDeliveryType("delivery")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${
                      deliveryType === "delivery" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    <Truck className="h-3.5 w-3.5" /> Delivery
                  </button>
                </div>
              </div>

              {deliveryType === "delivery" && (
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                    <MapPin className="h-3 w-3" /> Dirección
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Dirección completa"
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
              )}

              {/* Payment */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Pago</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { id: "efectivo" as PaymentMethod, label: "Efectivo", Icon: Banknote },
                    { id: "tarjeta" as PaymentMethod, label: "Tarjeta", Icon: CreditCard },
                    { id: "transferencia" as PaymentMethod, label: "Transfer.", Icon: ArrowRightLeft },
                  ]).map((pm) => (
                    <button
                      key={pm.id}
                      onClick={() => { setPaymentMethod(pm.id); if (pm.id !== "tarjeta") setCardType(null) }}
                      className={`flex flex-col items-center gap-0.5 rounded-lg border px-1.5 py-2 text-[10px] font-medium transition-colors ${
                        paymentMethod === pm.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                      }`}
                    >
                      <pm.Icon className="h-3.5 w-3.5" />
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === "efectivo" && (
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                    <Banknote className="h-3 w-3" /> Monto recibido
                  </label>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder={`Total: $${orderTotal.toLocaleString("es-CL")}`}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  {cashAmount && parseFloat(cashAmount) > orderTotal && (
                    <p className="text-[10px] text-emerald-500 font-semibold mt-0.5">
                      Vuelto: ${(parseFloat(cashAmount) - orderTotal).toLocaleString("es-CL")}
                    </p>
                  )}
                </div>
              )}

              {paymentMethod === "tarjeta" && (
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setCardType("debito")}
                    className={`rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${
                      cardType === "debito" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    Débito
                  </button>
                  <button
                    onClick={() => setCardType("credito")}
                    className={`rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${
                      cardType === "credito" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    Crédito
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer total + cobrar */}
      {cart.length > 0 && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {deliveryType === "delivery" && deliveryFee > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span>${cartTotal.toLocaleString("es-CL")}</span>
            </div>
          )}
          {deliveryType === "delivery" && deliveryFee > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> Delivery</span>
              <span>${deliveryFee.toLocaleString("es-CL")}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">Total</span>
            <span className="text-lg font-black text-primary">${orderTotal.toLocaleString("es-CL")}</span>
          </div>
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {submitting ? "Creando..." : `Cobrar $${orderTotal.toLocaleString("es-CL")}`}
          </button>
        </div>
      )}
    </div>
  )
}
