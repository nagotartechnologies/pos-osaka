"use client"

import { useState, useEffect, useMemo } from "react"
import {
  X,
  Search,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Check,
  Loader2,
  Pencil,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Truck,
  Store,
  MapPin,
} from "lucide-react"
import Image from "next/image"
import { getAvailableProducts, getCategories, getEffectivePrice, getActiveDiscountPct, type Product, type Category } from "@/lib/supabase-menu"
import { getAllConfig } from "@/lib/supabase-config"
import {
  updateOrderItems,
  type SupabaseOrder,
  type OrderItem,
  type OrderItemExtra,
  type DeliveryType,
  type PaymentMethod,
} from "@/lib/supabase-orders"

interface CartItem {
  id: string
  name: string
  price: number
  image: string
  quantity: number
  description?: string
  category?: string
  notes?: string
  extras?: OrderItemExtra[]
  customBuild?: boolean
  customBuildNotes?: string
  quotedPrice?: number | null
}

interface EditOrderModalProps {
  open: boolean
  order: SupabaseOrder | null
  onClose: () => void
  onOrderUpdated: () => void
}

interface DiffItem {
  type: "added" | "removed" | "changed"
  name: string
  detail: string
  priceDiff: number
}

export function EditOrderModal({ open, order, onClose, onOrderUpdated }: EditOrderModalProps) {
  // Data
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Step: 1 = edit items, 2 = review changes
  const [step, setStep] = useState<1 | 2>(1)

  // Cart (editable copy of the order items)
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState("")
  const [selectedCat, setSelectedCat] = useState("all")

  // Original items (for diff)
  const [originalItems, setOriginalItems] = useState<OrderItem[]>([])
  const [originalTotal, setOriginalTotal] = useState(0)

  // Extras panel: which cart item is expanded
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  // Product detail modal
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)

  // Modification fee
  const [modFeeEnabled, setModFeeEnabled] = useState(false)
  const [modFeeAmount, setModFeeAmount] = useState("")

  // Delivery type editing
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("retiro")
  const [address, setAddress] = useState("")
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [originalDeliveryCost, setOriginalDeliveryCost] = useState(0)

  // Payment method editing
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo")

  // Submitting
  const [submitting, setSubmitting] = useState(false)

  // Load products, categories & config
  useEffect(() => {
    if (!open || !order) return
    setLoading(true)
    Promise.all([getAvailableProducts(), getCategories(), getAllConfig()]).then(
      ([prods, cats, cfg]) => {
        setProducts(prods)
        setCategories(cats)
        setDeliveryFee(Number(cfg.deliveryFee) || 0)
        setModFeeEnabled(false)
        setModFeeAmount("")
        setLoading(false)
      }
    )
  }, [open, order])

  // Initialize cart from order items
  useEffect(() => {
    if (!open || !order) return
    setStep(1)
    setSearch("")
    setSelectedCat("all")
    const items: CartItem[] = order.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      image: products.find((p) => p.id === item.id)?.image || "",
      quantity: item.quantity,
      description: products.find((p) => p.id === item.id)?.description || "",
      category: item.category,
      notes: item.notes,
      extras: item.extras ? [...item.extras] : [],
      customBuild: item.customBuild,
      customBuildNotes: item.customBuildNotes,
      quotedPrice: item.quotedPrice ?? null,
    }))
    setCart(items)
    setOriginalItems([...order.items])
    setOriginalTotal(order.original_total ?? order.total)
    setDeliveryType(order.delivery_type)
    setAddress(order.address || "")
    setPaymentMethod(order.payment_method)
    // Calcular el costo de delivery real del pedido (no del config)
    const origItemsSubtotal = order.items.reduce((sum, i: any) => {
      const up = i.customBuild && i.quotedPrice != null ? i.quotedPrice : i.price
      const extrasTotal = (i.extras || []).reduce((s: number, e: any) => s + (Number(e.price) || 0), 0)
      return sum + (up + extrasTotal) * i.quantity
    }, 0)
    setOriginalDeliveryCost(Math.max(0, order.total - origItemsSubtotal))
  }, [open, order, products])

  // Helper para obtener nombre legible de categoría
  const getCategoryName = (catId: string) => {
    const cat = categories.find((c) => c.id === catId)
    return cat?.name || catId.split('-')[0] || ""
  }

  // Filtered products
  const filtered = useMemo(() => {
    let result = products
    if (selectedCat !== "all") result = result.filter((p) => p.category === selectedCat)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((p) => p.name.toLowerCase().includes(q))
    }
    return result
  }, [products, selectedCat, search])

  // Cart helpers
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      if (existing) return prev.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      const catName = getCategoryName(product.category)
      return [...prev, { id: product.id, name: product.name, price: getEffectivePrice(product), image: product.image, category: catName, quantity: 1 }]
    })
  }

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => i.id === id ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0)
    )
  }

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id))

  const updateItemNotes = (id: string, notes: string) => {
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, notes } : i))
  }

  // Extras helpers
  const addExtra = (itemId: string) => {
    setCart((prev) => prev.map((i) =>
      i.id === itemId
        ? { ...i, extras: [...(i.extras || []), { description: "", price: 0 }] }
        : i
    ))
  }

  const updateExtra = (itemId: string, idx: number, field: keyof OrderItemExtra, value: string | number) => {
    setCart((prev) => prev.map((i) =>
      i.id === itemId
        ? { ...i, extras: (i.extras || []).map((e, j) => j === idx ? { ...e, [field]: value } : e) }
        : i
    ))
  }

  const removeExtra = (itemId: string, idx: number) => {
    setCart((prev) => prev.map((i) =>
      i.id === itemId
        ? { ...i, extras: (i.extras || []).filter((_, j) => j !== idx) }
        : i
    ))
  }

  const getItemExtrasTotal = (item: CartItem) =>
    (item.extras || []).reduce((sum, e) => sum + (Number(e.price) || 0), 0)

  const cartTotal = cart.reduce((sum, i) => sum + (i.price + getItemExtrasTotal(i)) * i.quantity, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)
  const getCartQty = (id: string) => cart.find((i) => i.id === id)?.quantity || 0

  // Diff calculation
  const diff = useMemo((): DiffItem[] => {
    const items: DiffItem[] = []
    const origMap = new Map(originalItems.map((i) => [i.id, i]))
    const newMap = new Map(cart.map((i) => [i.id, i]))

    // Added or changed (including extras)
    for (const item of cart) {
      const orig = origMap.get(item.id)
      const itemExtrasTotal = (item.extras || []).reduce((s, e) => s + (Number(e.price) || 0), 0)
      if (!orig) {
        items.push({
          type: "added",
          name: item.name,
          detail: `${item.quantity}x`,
          priceDiff: (item.price + itemExtrasTotal) * item.quantity,
        })
      } else {
        const origExtrasTotal = (orig.extras || []).reduce((s, e) => s + (Number(e.price) || 0), 0)
        const qtyChanged = orig.quantity !== item.quantity
        const extrasChanged =
          itemExtrasTotal !== origExtrasTotal ||
          JSON.stringify(item.extras || []) !== JSON.stringify(orig.extras || [])

        if (qtyChanged) {
          const qtyDiff = item.quantity - orig.quantity
          items.push({
            type: "changed",
            name: item.name,
            detail: `${orig.quantity} → ${item.quantity}`,
            priceDiff: (item.price + itemExtrasTotal) * qtyDiff,
          })
        }
        if (extrasChanged) {
          const extrasDiff = (itemExtrasTotal - origExtrasTotal) * item.quantity
          const extraNames = (item.extras || []).filter(e => e.description).map(e => e.description).join(", ")
          items.push({
            type: "changed",
            name: item.name,
            detail: extraNames ? `Extras: ${extraNames}` : "Extras modificados",
            priceDiff: extrasDiff,
          })
        }
      }
    }

    // Removed
    for (const orig of originalItems) {
      if (!newMap.has(orig.id)) {
        const origExtrasTotal = (orig.extras || []).reduce((s, e) => s + (Number(e.price) || 0), 0)
        items.push({
          type: "removed",
          name: orig.name,
          detail: `${orig.quantity}x`,
          priceDiff: -((orig.price + origExtrasTotal) * orig.quantity),
        })
      }
    }

    return items
  }, [cart, originalItems])

  const deliveryTypeChanged = order ? deliveryType !== order.delivery_type : false
  const addressChanged = order ? (deliveryType === "delivery" && address.trim() !== (order.address || "").trim()) : false
  const deliveryChanged = deliveryTypeChanged || addressChanged
  const paymentChanged = order ? paymentMethod !== order.payment_method : false
  const hasChanges = diff.length > 0 || deliveryChanged || paymentChanged
  // Usar el fee del config solo si se cambia el tipo de entrega; si no, conservar el costo original
  const deliveryCost = deliveryTypeChanged
    ? (deliveryType === "delivery" ? deliveryFee : 0)
    : originalDeliveryCost
  const priceDiff = (cartTotal + deliveryCost) - originalTotal
  const modFee = modFeeEnabled ? (parseFloat(modFeeAmount) || 0) : 0
  const finalTotal = cartTotal + deliveryCost + modFee

  // Generate modification notes
  const generateNotes = (): string => {
    const parts: string[] = []
    if (deliveryTypeChanged) {
      const from = order!.delivery_type === "delivery" ? "Delivery" : "Retiro"
      const to = deliveryType === "delivery" ? "Delivery" : "Retiro"
      parts.push(`Entrega: ${from} → ${to}`)
    }
    if (!deliveryTypeChanged && addressChanged) {
      parts.push(`Dirección: ${address.trim()}`)
    }
    if (paymentChanged) {
      const labels: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta" }
      parts.push(`Pago: ${labels[order!.payment_method] || order!.payment_method} → ${labels[paymentMethod] || paymentMethod}`)
    }
    for (const d of diff) {
      if (d.type === "added") parts.push(`+${d.detail} ${d.name}`)
      if (d.type === "removed") parts.push(`-${d.detail} ${d.name}`)
      if (d.type === "changed") parts.push(`${d.name}: ${d.detail}`)
    }
    return parts.join(", ")
  }

  // Submit
  const handleSubmit = async () => {
    if (!order || !hasChanges || cart.length === 0) return
    setSubmitting(true)

    const result = await updateOrderItems(order.id, {
      items: cart.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        category: i.category,
        notes: i.notes,
        extras: (i.extras || []).filter(e => e.description.trim()),
        ...(i.customBuild && { customBuild: true, customBuildNotes: i.customBuildNotes, quotedPrice: i.quotedPrice }),
      })),
      total: finalTotal,
      modificationFee: modFee,
      originalTotal: originalTotal,
      modificationNotes: generateNotes(),
      ...(deliveryChanged && {
        deliveryType,
        address: deliveryType === "delivery" ? address.trim() : "",
      }),
      ...(paymentChanged && { paymentMethod }),
    })

    setSubmitting(false)

    if (result) {
      onOrderUpdated()
      onClose()
    }
  }

  if (!open || !order) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal - Fullscreen Split Layout */}
      <div className="relative w-full h-full sm:h-full sm:max-w-none bg-background overflow-hidden flex flex-col sm:flex-row shadow-2xl">
        {/* Left Panel - Products */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-3">
              {step === 2 && (
                <button onClick={() => setStep(1)} className="p-1 rounded-lg hover:bg-accent transition-colors">
                  <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                </button>
              )}
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-amber-500" />
                  {step === 1 ? "Editar Pedido" : "Resumen de Cambios"}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {step === 1
                    ? `${order.id} — ${order.client_name}`
                    : "Revisa los cambios antes de confirmar"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Paso {step}/2</span>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        ) : step === 1 ? (
          <>
            {/* Search + Categories */}
            <div className="px-4 pt-4 pb-3 space-y-3 bg-background">
              <div className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 border border-border">
                <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none w-full"
                />
              </div>
              {/* Category Dropdown */}
              <div className="relative">
                <select
                  value={selectedCat}
                  onChange={(e) => setSelectedCat(e.target.value)}
                  className="w-full appearance-none rounded-xl bg-card px-4 py-2.5 border border-border text-sm text-foreground focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="all">Todas las categorías</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Product Grid - More space */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filtered.map((product) => {
                  const qty = getCartQty(product.id)
                  return (
                    <button
                      key={product.id}
                      className={`relative rounded-xl border bg-card overflow-hidden text-left transition-all active:scale-[0.97] ${
                        qty > 0 ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
                      }`}
                    >
                      <div
                        className="relative aspect-square w-full overflow-hidden bg-accent cursor-pointer"
                        onClick={() => setDetailProduct(product)}
                      >
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 33vw, 20vw"
                          loading="lazy"
                          quality={60}
                        />
                        {qty > 0 && (
                          <div className="absolute top-2 right-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-black text-primary-foreground shadow">
                            {qty}
                          </div>
                        )}
                      </div>
                      <div className="p-2.5" onClick={() => addToCart(product)}>
                        <p className="text-xs font-semibold text-card-foreground truncate">{product.name}</p>
                        {getActiveDiscountPct(product) !== null ? (
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-[10px] text-muted-foreground line-through">${product.price.toLocaleString("es-CL")}</span>
                            <p className="text-xs font-bold text-red-500">${getEffectivePrice(product).toLocaleString("es-CL")}</p>
                          </div>
                        ) : (
                          <p className="text-xs font-bold text-primary mt-0.5">$ {product.price.toLocaleString("es-CL")}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">No se encontraron productos</p>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Step 2: Review Changes - Full width */
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Changes List */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-3 py-2 bg-muted/30 border-b border-border">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cambios realizados</p>
                </div>
                <div className="divide-y divide-border">
                  {deliveryTypeChanged && (
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500">~</span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-card-foreground">Tipo de entrega</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            {order!.delivery_type === "delivery" ? <Truck className="h-2.5 w-2.5" /> : <Store className="h-2.5 w-2.5" />}
                            {order!.delivery_type === "delivery" ? "Delivery" : "Retiro"}
                            {" → "}
                            {deliveryType === "delivery" ? <Truck className="h-2.5 w-2.5" /> : <Store className="h-2.5 w-2.5" />}
                            {deliveryType === "delivery" ? "Delivery" : "Retiro"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold flex-shrink-0 ml-2 text-muted-foreground">—</span>
                    </div>
                  )}
                  {!deliveryTypeChanged && addressChanged && (
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500">~</span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-card-foreground">Dirección</p>
                          <p className="text-[10px] text-muted-foreground truncate">{address.trim()}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold flex-shrink-0 ml-2 text-muted-foreground">—</span>
                    </div>
                  )}
                  {paymentChanged && (
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500">~</span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-card-foreground">Medio de pago</p>
                          <p className="text-[10px] text-muted-foreground">
                            {order!.payment_method === "efectivo" ? "Efectivo" : order!.payment_method === "transferencia" ? "Transferencia" : "Tarjeta"}
                            {" → "}
                            {paymentMethod === "efectivo" ? "Efectivo" : paymentMethod === "transferencia" ? "Transferencia" : "Tarjeta"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold flex-shrink-0 ml-2 text-muted-foreground">—</span>
                    </div>
                  )}
                  {diff.map((d, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                          d.type === "added" ? "bg-emerald-500/10 text-emerald-500"
                          : d.type === "removed" ? "bg-red-500/10 text-red-500"
                          : "bg-amber-500/10 text-amber-500"
                        }`}>
                          {d.type === "added" ? "+" : d.type === "removed" ? "−" : "~"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-card-foreground truncate">{d.name}</p>
                          <p className="text-[10px] text-muted-foreground">{d.detail}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold flex-shrink-0 ml-2 ${
                        d.priceDiff > 0 ? "text-emerald-500" : d.priceDiff < 0 ? "text-red-500" : "text-muted-foreground"
                      }`}>
                        {d.priceDiff > 0 ? "+" : ""}$ {d.priceDiff.toLocaleString("es-CL")}
                      </span>
                    </div>
                  ))}
                  {diff.length === 0 && (
                    <div className="py-6 text-center">
                      <p className="text-xs text-muted-foreground">Sin cambios</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Price Summary */}
              <div className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total original</span>
                  <span className="font-semibold text-card-foreground">$ {originalTotal.toLocaleString("es-CL")}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Productos</span>
                  <span className="font-semibold text-card-foreground">$ {cartTotal.toLocaleString("es-CL")}</span>
                </div>
                {deliveryCost > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> Delivery</span>
                    <span className="font-semibold text-orange-500">+ $ {deliveryCost.toLocaleString("es-CL")}</span>
                  </div>
                )}
                {priceDiff !== 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Diferencia</span>
                    <span className={`font-bold ${priceDiff > 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {priceDiff > 0 ? "+" : ""}$ {priceDiff.toLocaleString("es-CL")}
                    </span>
                  </div>
                )}
              </div>

              {/* Modification Fee */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-semibold text-card-foreground">Cargo por modificación</span>
                  </div>
                  <button
                    onClick={() => {
                      setModFeeEnabled(!modFeeEnabled)
                      if (modFeeEnabled) setModFeeAmount("")
                    }}
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      modFeeEnabled ? "bg-amber-500" : "bg-muted"
                    }`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      modFeeEnabled ? "translate-x-4" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
                {modFeeEnabled && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Monto:</span>
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5">
                      <span className="text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={modFeeAmount}
                        onChange={(e) => setModFeeAmount(e.target.value)}
                        placeholder="0"
                        className="w-24 bg-transparent text-xs font-semibold text-card-foreground focus:outline-none placeholder:text-muted-foreground"
                        min="0"
                        autoFocus
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Final Total */}
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">Total Final</span>
                  <span className="text-lg font-black text-primary">$ {finalTotal.toLocaleString("es-CL")}</span>
                </div>
                {modFee > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Productos: ${cartTotal.toLocaleString("es-CL")} + Cargo: ${modFee.toLocaleString("es-CL")}
                  </p>
                )}
              </div>
            </div>

            {/* Submit Footer */}
            <div className="border-t border-border bg-card px-4 py-3">
              <button
                onClick={handleSubmit}
                disabled={submitting || !hasChanges || cart.length === 0}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {submitting ? "Actualizando pedido..." : "Confirmar Cambios"}
              </button>
            </div>
          </>
        )}

        </div>

        {/* Right Panel - Cart Sidebar (only in step 1) */}
        {step === 1 && (
          <div className="hidden sm:flex w-[380px] border-l border-border bg-card flex-col">
            {/* Cart Header */}
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-black">
                  {cartCount}
                </span>
                Carrito
              </h3>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-muted-foreground">Agrega productos al carrito</p>
                </div>
              ) : (
                cart.map((item) => {
                  const isExpanded = expandedItemId === item.id
                  const extrasTotal = getItemExtrasTotal(item)
                  const hasExtras = (item.extras || []).length > 0
                  return (
                    <div key={item.id} className={`rounded-xl border transition-colors ${isExpanded ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-background"}`}>
                      {/* Item row */}
                      <div className="flex items-center gap-2 px-2.5 py-2">
                        <button
                          onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                        >
                          <span className={`flex-shrink-0 ${hasExtras ? "text-amber-500" : "text-muted-foreground"}`}>
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </span>
                          <p className="text-xs text-card-foreground truncate flex-1">{item.name}</p>
                          {hasExtras && (
                            <span className="flex-shrink-0 flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-500">
                              <Sparkles className="h-2 w-2" />
                              {(item.extras || []).length}
                            </span>
                          )}
                        </button>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => updateQty(item.id, -1)} className="flex h-6 w-6 items-center justify-center rounded bg-accent hover:bg-accent/80">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="flex h-6 w-6 items-center justify-center rounded bg-accent hover:bg-accent/80">
                            <Plus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-semibold text-card-foreground w-14 text-right">
                            $ {((item.price + extrasTotal) * item.quantity).toLocaleString("es-CL")}
                          </span>
                          <button onClick={() => removeFromCart(item.id)} className="p-1 text-red-500 hover:bg-red-500/10 rounded">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Extras panel */}
                      {isExpanded && (
                        <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-amber-500/20 pt-2">
                          {item.description && (
                            <p className="text-[10px] text-muted-foreground leading-snug">{item.description}</p>
                          )}
                          <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5" />
                            Extras
                          </p>
                          {(item.extras || []).map((extra, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={extra.description}
                                onChange={(e) => updateExtra(item.id, idx, "description", e.target.value)}
                                placeholder="ej: Todo con pollo..."
                                className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50"
                              />
                              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background px-1.5 py-1 w-20">
                                <span className="text-[10px] text-muted-foreground">$</span>
                                <input
                                  type="number"
                                  value={extra.price || ""}
                                  onChange={(e) => updateExtra(item.id, idx, "price", parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-full bg-transparent text-[11px] font-semibold text-foreground focus:outline-none placeholder:text-muted-foreground"
                                  min="0"
                                />
                              </div>
                              <button onClick={() => removeExtra(item.id, idx)} className="p-0.5 text-red-500 hover:bg-red-500/10 rounded flex-shrink-0">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addExtra(item.id)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-amber-500 hover:text-amber-600 transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                            Agregar extra
                          </button>
                          {extrasTotal > 0 && (
                            <p className="text-[10px] text-amber-500 font-semibold text-right">
                              +$ {extrasTotal.toLocaleString("es-CL")} extras × {item.quantity}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Payment, Delivery & Total Footer */}
            <div className="border-t border-border px-4 py-3 space-y-3">
              {/* Payment method selector */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Medio de pago</p>
                <div className="flex items-center gap-2">
                  {([
                    { value: "efectivo" as PaymentMethod, label: "Efectivo", icon: "💵" },
                    { value: "transferencia" as PaymentMethod, label: "Transfer.", icon: "🏦" },
                    { value: "tarjeta" as PaymentMethod, label: "Tarjeta", icon: "💳" },
                  ]).map((pm) => (
                    <button
                      key={pm.value}
                      onClick={() => setPaymentMethod(pm.value)}
                      className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                        paymentMethod === pm.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-[10px]">{pm.icon}</span>
                      {pm.label}
                    </button>
                  ))}
                </div>
                {paymentChanged && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-500 mt-1.5">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Medio de pago modificado</span>
                  </div>
                )}
              </div>

              {/* Delivery selector compact */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDeliveryType("retiro")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${
                    deliveryType === "retiro"
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Store className="h-3.5 w-3.5" />
                  Retiro
                </button>
                <button
                  onClick={() => setDeliveryType("delivery")}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${
                    deliveryType === "delivery"
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Truck className="h-3.5 w-3.5" />
                  Delivery
                </button>
              </div>

              {/* Address input */}
              {deliveryType === "delivery" && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Dirección de entrega..."
                    className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              )}

              {/* Delivery changed badge */}
              {deliveryTypeChanged && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-500">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Tipo de entrega modificado</span>
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    {cartCount} producto{cartCount !== 1 ? "s" : ""}
                    {deliveryCost > 0 && <span className="ml-1 text-orange-500">+ delivery</span>}
                  </p>
                  <p className="text-lg font-black text-foreground">$ {(cartTotal + deliveryCost).toLocaleString("es-CL")}</p>
                </div>
                <button
                  onClick={() => setStep(2)}
                  disabled={!hasChanges || cart.length === 0}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Revisar
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {detailProduct && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setDetailProduct(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 fade-in duration-300"
            style={{ background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full aspect-square">
              <Image
                src={detailProduct.image}
                alt={detailProduct.name}
                fill
                className="object-cover"
                sizes="400px"
                quality={85}
              />
              <button
                onClick={() => setDetailProduct(null)}
                className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>{detailProduct.name}</h3>
              {detailProduct.description && (
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{detailProduct.description}</p>
              )}
              {getActiveDiscountPct(detailProduct) !== null ? (
                <div className="mt-3">
                  <span className="text-sm font-medium line-through" style={{ color: "var(--muted-foreground)" }}>$ {detailProduct.price.toLocaleString("es-CL")}</span>
                  <span className="text-lg font-black ml-2" style={{ color: "var(--primary)" }}>$ {getEffectivePrice(detailProduct).toLocaleString("es-CL")}</span>
                </div>
              ) : (
                <p className="text-lg font-black mt-3" style={{ color: "var(--primary)" }}>$ {detailProduct.price.toLocaleString("es-CL")}</p>
              )}
              <div className="flex items-center gap-2 mt-4">
                {getCartQty(detailProduct.id) > 0 ? (
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      onClick={() => updateQty(detailProduct.id, -1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border"
                      style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-lg font-bold flex-1 text-center" style={{ color: "var(--foreground)" }}>{getCartQty(detailProduct.id)}</span>
                    <button
                      onClick={() => addToCart(detailProduct)}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                      style={{ background: "var(--primary)" }}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { addToCart(detailProduct); setDetailProduct(null) }}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white"
                    style={{ background: "var(--primary)" }}
                  >
                    <Plus className="h-4 w-4" />
                    Agregar al pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
