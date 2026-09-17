"use client"

import { useState, useEffect, useMemo } from "react"
import {
  X,
  Search,
  Plus,
  Minus,
  ShoppingCart,
  ArrowRight,
  ArrowLeft,
  Trash2,
  User,
  Phone,
  MapPin,
  Truck,
  Store,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  Check,
  Loader2,
  ChevronDown,
  MessageSquare,
} from "lucide-react"
import Image from "next/image"
import { getAvailableProducts, getCategories, type Product, type Category, type CustomizationOption } from "@/lib/supabase-menu"
import { addOrder, type AddOrderData, type PaymentMethod, type DeliveryType } from "@/lib/supabase-orders"
import { getAllConfig } from "@/lib/supabase-config"
import { optimizeCloudinaryUrl } from "@/lib/cloudinary"

const SALSAS = [
  { id: "salsa-soya", name: "Salsa Soya", price: 0 },
  { id: "salsa-agridulce", name: "Salsa Agridulce", price: 0 },
  { id: "salsa-acevichada", name: "Salsa Acevichada", price: 500 },
  { id: "salsa-teriyaki", name: "Salsa Teriyaki", price: 500 },
]
const MAX_FREE_SALSAS = 5

interface CartItem {
  id: string
  name: string
  price: number
  image: string
  quantity: number
  category?: string
  cartKey?: string
  selectedProtein?: CustomizationOption | null
  selectedWrapper?: CustomizationOption | null
  notes?: string
  customBuild?: boolean
  customBuildNotes?: string
}

interface POSModalProps {
  open: boolean
  onClose: () => void
  onOrderCreated: () => void
  initialClientName?: string
  initialClientPhone?: string
  noBackdrop?: boolean
}

export function POSModal({ open, onClose, onOrderCreated, initialClientName, initialClientPhone, noBackdrop }: POSModalProps) {
  // Data
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Step
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1: Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState("")
  const [selectedCat, setSelectedCat] = useState("all")
  const [categorySearch, setCategorySearch] = useState("")
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)

  // Customization
  const [customizeProduct, setCustomizeProduct] = useState<Product | null>(null)
  const [customProtein, setCustomProtein] = useState<CustomizationOption | null>(null)
  const [customWrapper, setCustomWrapper] = useState<CustomizationOption | null>(null)
  const [customInstructions, setCustomInstructions] = useState("")
  const [customTriedConfirm, setCustomTriedConfirm] = useState(false)

  // Ármalo a tu pinta
  const [buildProduct, setBuildProduct] = useState<Product | null>(null)
  const [buildNotes, setBuildNotes] = useState("")
  const [buildTriedConfirm, setBuildTriedConfirm] = useState(false)

  // Step 2: Client info
  const [clientName, setClientName] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("retiro")
  const [address, setAddress] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo")
  const [cardType, setCardType] = useState<"debito" | "credito" | null>(null)
  const [cashAmount, setCashAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Delivery fee from config
  const [deliveryFee, setDeliveryFee] = useState(0)

  // Load products, categories & config
  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([getAvailableProducts(), getCategories(), getAllConfig()]).then(([prods, cats, cfg]) => {
      setProducts(prods)
      setCategories(cats)
      if (cfg.deliveryFee) setDeliveryFee(Number(cfg.deliveryFee) || 0)
      setLoading(false)
    })
  }, [open])

  // Reset on close / pre-fill on open
  useEffect(() => {
    if (open) {
      if (initialClientName) setClientName(initialClientName)
      if (initialClientPhone) setClientPhone(initialClientPhone)
    } else {
      setStep(1)
      setCart([])
      setSearch("")
      setSelectedCat("all")
      setCategorySearch("")
      setClientName("")
      setClientPhone("")
      setDeliveryType("retiro")
      setAddress("")
      setPaymentMethod("efectivo")
      setCardType(null)
      setCashAmount("")
    }
  }, [open, initialClientName, initialClientPhone])

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (!categorySearch) return categories
    const q = categorySearch.toLowerCase()
    return categories.filter((cat) => cat.name.toLowerCase().includes(q))
  }, [categories, categorySearch])

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

  // Helper para obtener nombre de categoría
  const getCategoryName = (catId: string) => {
    const cat = categories.find((c) => c.id === catId)
    return cat?.name || catId.split('-')[0] || ""
  }
  const hasCustomization = (product: Product) =>
    (product.protein_options && product.protein_options.length > 0) || (product.wrapper_options && product.wrapper_options.length > 0)

  const makeCartKey = (product: Product, protein?: CustomizationOption | null, wrapper?: CustomizationOption | null) => {
    const pName = protein?.name || "_"
    const wName = wrapper?.name || "_"
    return hasCustomization(product) ? `${product.id}--${pName}--${wName}` : product.id
  }

  const hasCustomChange = (customProtein?.price || 0) > 0 || (customWrapper?.price || 0) > 0

  const openCustomization = (product: Product) => {
    setDetailProduct(null)
    setCustomizeProduct(product)
    setCustomProtein(null)
    setCustomWrapper(null)
    setCustomInstructions("")
    setCustomTriedConfirm(false)
  }

  const confirmCustomization = () => {
    if (!customizeProduct) return
    if (hasCustomChange && !customInstructions.trim()) {
      setCustomTriedConfirm(true)
      return
    }
    const key = makeCartKey(customizeProduct, customProtein, customWrapper)
    const catName = getCategoryName(customizeProduct.category)
    const notes = customInstructions.trim() || ""
    setCart((prev) => {
      const existing = prev.find((i) => (i.cartKey || i.id) === key)
      if (existing) return prev.map((i) => (i.cartKey || i.id) === key ? { ...i, quantity: i.quantity + 1, notes: notes || i.notes } : i)
      return [...prev, { id: customizeProduct.id, name: customizeProduct.name, price: customizeProduct.price, image: customizeProduct.image, category: catName, quantity: 1, cartKey: key, selectedProtein: customProtein, selectedWrapper: customWrapper, notes }]
    })
    setCustomizeProduct(null)
    setDetailProduct(null)
  }

  // Ármalo a tu pinta
  const openBuildCustom = (product: Product) => {
    setDetailProduct(null)
    setBuildProduct(product)
    setBuildNotes("")
    setBuildTriedConfirm(false)
  }

  const confirmBuildCustom = () => {
    if (!buildProduct) return
    if (!buildNotes.trim()) {
      setBuildTriedConfirm(true)
      return
    }
    const key = `${buildProduct.id}--build--${Date.now()}`
    const catName = getCategoryName(buildProduct.category)
    setCart((prev) => [...prev, {
      id: buildProduct.id,
      name: buildProduct.name,
      price: buildProduct.price,
      image: buildProduct.image,
      category: catName,
      quantity: 1,
      cartKey: key,
      customBuild: true,
      customBuildNotes: buildNotes.trim(),
      notes: "",
    }])
    setBuildProduct(null)
  }

  const addToCart = (product: Product) => {
    if (hasCustomization(product)) {
      openCustomization(product)
      return
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      if (existing) return prev.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      const catName = getCategoryName(product.category)
      return [...prev, { id: product.id, name: product.name, price: product.price, image: product.image, category: catName, quantity: 1 }]
    })
  }

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.cartKey || i.id) === id ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0)
    )
  }

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => (i.cartKey || i.id) !== id))

  const getItemUnitPrice = (item: CartItem) => item.price + (item.selectedProtein?.price || 0) + (item.selectedWrapper?.price || 0)

  const cartTotal = cart.reduce((sum, i) => sum + getItemUnitPrice(i) * i.quantity, 0)
  const orderTotal = cartTotal + (deliveryType === "delivery" && deliveryFee > 0 ? deliveryFee : 0)
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)

  const getCartQty = (id: string) => cart.filter((i) => i.id === id).reduce((sum, i) => sum + i.quantity, 0)

  // Submit
  const handleSubmit = async () => {
    if (!clientName.trim() || cart.length === 0) return
    setSubmitting(true)

    const cashNum = paymentMethod === "efectivo" && cashAmount ? parseFloat(cashAmount) : null
    const changeNum = cashNum !== null ? cashNum - orderTotal : null

    const data: AddOrderData & { cardType?: string | null } = {
      items: cart.map((i) => {
        const extras: { description: string; price: number }[] = []
        if (i.selectedProtein && i.selectedProtein.price > 0) extras.push({ description: `Proteína: ${i.selectedProtein.name}`, price: i.selectedProtein.price })
        if (i.selectedWrapper && i.selectedWrapper.price > 0) extras.push({ description: `Envoltura: ${i.selectedWrapper.name}`, price: i.selectedWrapper.price })
        return { id: i.id, name: i.name, price: i.price, quantity: i.quantity, category: i.category, notes: i.notes || "", extras: extras.length > 0 ? extras : undefined, customBuild: i.customBuild || false, customBuildNotes: i.customBuildNotes || "" }
      }),
      total: orderTotal,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      deliveryType,
      address: deliveryType === "delivery" ? address.trim() : "",
      paymentMethod,
      cashAmount: cashNum,
      change: changeNum && changeNum > 0 ? changeNum : null,
      cardType: paymentMethod === "tarjeta" ? cardType : null,
    }

    const result = await addOrder(data)
    setSubmitting(false)

    if (result) {
      onOrderCreated()
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className={`fixed z-50 flex items-end sm:items-center justify-center ${
      noBackdrop ? "inset-y-0 left-0 right-[480px]" : "inset-0"
    }`}>
      {/* Backdrop — solo cuando no hay chat abierto */}
      {!noBackdrop && <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />}

      {/* Modal */}
      <div className={`relative bg-background overflow-hidden flex flex-col shadow-2xl ${
        noBackdrop
          ? "w-full h-full rounded-none"
          : "w-full h-full sm:h-[90vh] sm:max-w-2xl sm:rounded-2xl"
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="p-1 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="h-5 w-5 text-muted-foreground" />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-foreground">
                {step === 1 ? "Nuevo Pedido" : "Datos del Cliente"}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {step === 1 ? "Selecciona productos" : "Completa la información"}
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
            <div className="px-3 pt-3 pb-2 space-y-2 bg-background">
              <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 border border-border">
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
                  className="w-full appearance-none rounded-xl bg-card px-3 py-2 border border-border text-sm text-foreground focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="all">Todas las categorías</option>
                  {filteredCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filtered.map((product) => {
                  const qty = getCartQty(product.id)
                  return (
                    <button
                      key={product.id}
                      className={`relative rounded-xl border bg-card overflow-hidden text-left transition-all active:scale-[0.97] ${
                        qty > 0 ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
                      }`}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-accent cursor-pointer" onClick={() => setDetailProduct(product)}>
                        <Image
                          src={optimizeCloudinaryUrl(product.image, 300)}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, 33vw"
                          loading="lazy"
                        />
                        {qty > 0 && (
                          <div className="absolute top-1.5 right-1.5 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-black text-primary-foreground shadow">
                            {qty}
                          </div>
                        )}
                      </div>
                      <div className="p-2" onClick={() => addToCart(product)}>
                        <p className="text-xs font-semibold text-card-foreground truncate">{product.name}</p>
                        {product.description && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 leading-snug mt-0.5">{product.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs font-bold text-primary">$ {product.price.toLocaleString("es-CL")}</p>
                          {product.allow_custom_build && (
                            <span
                              onClick={(e) => { e.stopPropagation(); openBuildCustom(product) }}
                              className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-500/10 cursor-pointer hover:bg-amber-100 transition-colors"
                            >
                              🎨 A tu pinta
                            </span>
                          )}
                        </div>
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

            {/* Cart Summary Footer */}
            {cart.length > 0 && (
              <div className="border-t border-border bg-card px-3 py-2 space-y-2">
                {/* Cart items mini list */}
                <div className="max-h-32 overflow-y-auto space-y-1.5">
                  {cart.map((item) => {
                    const key = item.cartKey || item.id
                    const unitPrice = getItemUnitPrice(item)
                    return (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-card-foreground truncate">{item.name}</p>
                          {(item.selectedProtein || item.selectedWrapper) && (
                            <p className="text-[9px] text-muted-foreground truncate">
                              {[item.selectedProtein?.name, item.selectedWrapper?.name].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); updateQty(key, -1) }}
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-foreground hover:bg-accent/80"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateQty(key, 1) }}
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-foreground hover:bg-accent/80"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-semibold text-card-foreground w-14 text-right">
                            $ {(unitPrice * item.quantity).toLocaleString("es-CL")}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFromCart(key) }}
                            className="p-0.5 text-red-500 hover:bg-red-500/10 rounded"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Salsas adicionales */}
                <div className="border-t border-border/50 pt-2">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">🫙 Salsas</p>
                  <p className="text-[9px] text-muted-foreground mb-1.5">Soya y Agridulce gratis (máx. {MAX_FREE_SALSAS}) · Acevichada y Teriyaki $500</p>
                  <div className="space-y-1">
                    {SALSAS.map((salsa) => {
                      const qty = getCartQty(salsa.id)
                      const isFree = salsa.price === 0
                      const totalFreeSalsas = SALSAS.filter(s => s.price === 0).reduce((sum, s) => sum + getCartQty(s.id), 0)
                      const limitReached = isFree && totalFreeSalsas >= MAX_FREE_SALSAS
                      return (
                        <div key={salsa.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs text-card-foreground">{salsa.name}</p>
                            <span className={`text-[9px] font-medium ${isFree ? "text-emerald-500" : "text-primary"}`}>{isFree ? "Gratis" : "$500"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {qty > 0 && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); updateQty(salsa.id, -1) }}
                                  className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-foreground hover:bg-accent/80"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="text-xs font-bold w-5 text-center">{qty}</span>
                              </>
                            )}
                            <button
                              disabled={limitReached}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (limitReached) return
                                setCart((prev) => {
                                  const existing = prev.find((i) => i.id === salsa.id)
                                  if (existing) return prev.map((i) => i.id === salsa.id ? { ...i, quantity: i.quantity + 1 } : i)
                                  return [...prev, { id: salsa.id, name: salsa.name, price: salsa.price, image: "", quantity: 1 }]
                                })
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            {qty > 0 && !isFree && (
                              <span className="text-xs font-semibold text-card-foreground w-14 text-right">
                                $ {(salsa.price * qty).toLocaleString("es-CL")}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {/* Total + Next */}
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <div>
                    <p className="text-[10px] text-muted-foreground">{cartCount} producto{cartCount !== 1 ? "s" : ""}</p>
                    <p className="text-base font-bold text-foreground">$ {cartTotal.toLocaleString("es-CL")}</p>
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Siguiente
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Step 2: Client Info */
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Client Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Nombre del cliente *
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nombre"
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Client Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Teléfono (opcional)
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Delivery Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Tipo de entrega</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDeliveryType("retiro")}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                      deliveryType === "retiro"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <Store className="h-4 w-4" />
                    Retiro
                  </button>
                  <button
                    onClick={() => setDeliveryType("delivery")}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                      deliveryType === "delivery"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <Truck className="h-4 w-4" />
                    Delivery
                  </button>
                </div>
              </div>

              {/* Address (if delivery) */}
              {deliveryType === "delivery" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    Dirección de entrega
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Dirección completa"
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Método de pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "efectivo" as PaymentMethod, label: "Efectivo", icon: Banknote },
                    { id: "tarjeta" as PaymentMethod, label: "Tarjeta", icon: CreditCard },
                    { id: "transferencia" as PaymentMethod, label: "Transfer.", icon: ArrowRightLeft },
                  ]).map((pm) => (
                    <button
                      key={pm.id}
                      onClick={() => {
                        setPaymentMethod(pm.id)
                        if (pm.id !== "tarjeta") setCardType(null)
                      }}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-colors ${
                        paymentMethod === pm.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      <pm.icon className="h-4 w-4" />
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash amount (if efectivo) */}
              {paymentMethod === "efectivo" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                    Monto recibido (opcional)
                  </label>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder={`Total: $ ${orderTotal.toLocaleString("es-CL")}`}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {cashAmount && parseFloat(cashAmount) > orderTotal && (
                    <p className="text-xs text-emerald-500 font-semibold">
                      Vuelto: $ {(parseFloat(cashAmount) - orderTotal).toLocaleString("es-CL")}
                    </p>
                  )}
                </div>
              )}

              {/* Card type (if tarjeta) */}
              {paymentMethod === "tarjeta" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Tipo de tarjeta</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setCardType("debito")}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                        cardType === "debito"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      Débito
                    </button>
                    <button
                      onClick={() => setCardType("credito")}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                        cardType === "credito"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      Crédito
                    </button>
                  </div>
                </div>
              )}

              {/* Order Summary */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <h3 className="text-xs font-bold text-card-foreground">Resumen del pedido</h3>
                {cart.map((item) => {
                  const key = item.cartKey || item.id
                  const unitPrice = getItemUnitPrice(item)
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{item.quantity}x {item.name}</span>
                        <span className="text-xs font-semibold text-card-foreground">$ {(unitPrice * item.quantity).toLocaleString("es-CL")}</span>
                      </div>
                      {(item.selectedProtein || item.selectedWrapper) && (
                        <p className="text-[9px] text-muted-foreground ml-4">
                          {[item.selectedProtein?.name, item.selectedWrapper?.name].filter(Boolean).join(" · ")}
                          {(item.selectedProtein?.price || 0) + (item.selectedWrapper?.price || 0) > 0 && (
                            <span className="text-primary ml-1">+${((item.selectedProtein?.price || 0) + (item.selectedWrapper?.price || 0)).toLocaleString("es-CL")}</span>
                          )}
                        </p>
                      )}
                    </div>
                  )
                })}
                {deliveryType === "delivery" && deliveryFee > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> Delivery</span>
                    <span className="text-xs font-semibold text-card-foreground">$ {deliveryFee.toLocaleString("es-CL")}</span>
                  </div>
                )}
                <div className="border-t border-border/50 pt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">Total</span>
                  <span className="text-sm font-bold text-primary">$ {orderTotal.toLocaleString("es-CL")}</span>
                </div>
              </div>
            </div>

            {/* Submit Footer */}
            <div className="border-t border-border bg-card px-4 py-3">
              <button
                onClick={handleSubmit}
                disabled={submitting || !clientName.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {submitting ? "Creando pedido..." : "Confirmar Pedido"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Customization Modal */}
      {customizeProduct && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setCustomizeProduct(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 fade-in duration-300 flex flex-col max-h-[85vh]"
            style={{ background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold" style={{ color: "var(--foreground)" }}>{customizeProduct.name}</h3>
                <button
                  onClick={() => setCustomizeProduct(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                  style={{ background: "var(--accent)", color: "var(--muted-foreground)" }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                Personaliza tu producto (opcional)
              </p>
            </div>

            {/* Options */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Proteína */}
              {customizeProduct.protein_options && customizeProduct.protein_options.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--muted-foreground)" }}>🥩 Proteína <span className="text-[9px] font-medium">(opcional)</span></p>
                  <div className="space-y-1.5">
                    {customizeProduct.protein_options.map((opt) => {
                      const isSelected = customProtein?.name === opt.name
                      return (
                        <button
                          key={opt.name}
                          onClick={() => setCustomProtein(customProtein?.name === opt.name ? null : opt)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 transition-all text-left ${isSelected ? "border-primary bg-primary/5" : "border-border"}`}
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

              {/* Envoltura */}
              {customizeProduct.wrapper_options && customizeProduct.wrapper_options.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--muted-foreground)" }}>🍣 Envoltura <span className="text-[9px] font-medium">(opcional)</span></p>
                  <div className="space-y-1.5">
                    {customizeProduct.wrapper_options.map((opt) => {
                      const isSelected = customWrapper?.name === opt.name
                      return (
                        <button
                          key={opt.name}
                          onClick={() => setCustomWrapper(customWrapper?.name === opt.name ? null : opt)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 transition-all text-left ${isSelected ? "border-primary bg-primary/5" : "border-border"}`}
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

            {/* Instrucciones obligatorias si hay cambio con precio */}
            {hasCustomChange && (
              <div className="px-5 pb-1">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MessageSquare className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: customTriedConfirm && !customInstructions.trim() ? "var(--destructive, #c1272d)" : "var(--muted-foreground)" }}>
                    Instrucciones *
                  </span>
                </div>
                <textarea
                  value={customInstructions}
                  onChange={(e) => { setCustomInstructions(e.target.value); setCustomTriedConfirm(false) }}
                  placeholder="Indica la cantidad de piezas que requieren el cambio. Ej: 5 piezas con camarón, 5 con pollo"
                  rows={3}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-xs resize-none focus:outline-none border-2 transition-all bg-accent/30 text-card-foreground ${customTriedConfirm && !customInstructions.trim() ? "border-red-500" : "border-border"}`}
                />
                {customTriedConfirm && !customInstructions.trim() && (
                  <p className="text-[10px] font-semibold mt-1 text-red-500">
                    Debes indicar la cantidad de piezas que requieren cambio
                  </p>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="px-5 py-4 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>Total</span>
                <div className="text-right">
                  <span className="text-xl font-black" style={{ color: "var(--foreground)" }}>
                    $ {(customizeProduct.price + (customProtein?.price || 0) + (customWrapper?.price || 0)).toLocaleString("es-CL")}
                  </span>
                  {((customProtein?.price || 0) + (customWrapper?.price || 0)) > 0 && (
                    <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                      Base ${customizeProduct.price.toLocaleString("es-CL")} + extras ${((customProtein?.price || 0) + (customWrapper?.price || 0)).toLocaleString("es-CL")}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={confirmCustomization}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Agregar al pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ármalo a tu pinta Modal */}
      {buildProduct && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setBuildProduct(null)}
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
                <button onClick={() => setBuildProduct(null)} className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Base: <span className="font-semibold text-card-foreground">{buildProduct.name}</span> · Ref. ${buildProduct.price.toLocaleString("es-CL")}
              </p>
              <div className="mt-2 rounded-lg px-3 py-2 bg-amber-500/5 border border-amber-500/20">
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  El precio final será confirmado por el vendedor y enviado por WhatsApp.
                </p>
              </div>
            </div>
            <div className="px-5 pb-2 flex-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <MessageSquare className="h-3 w-3" style={{ color: buildTriedConfirm && !buildNotes.trim() ? "rgb(239,68,68)" : "rgb(217,119,6)" }} />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${buildTriedConfirm && !buildNotes.trim() ? "text-red-500" : "text-muted-foreground"}`}>
                  Describe cómo lo quieres *
                </span>
              </div>
              <textarea
                value={buildNotes}
                onChange={(e) => { setBuildNotes(e.target.value); setBuildTriedConfirm(false) }}
                placeholder="Ej: 5 piezas con camarón tempura, 3 con salmón flameado, sin palta..."
                rows={4}
                className={`w-full rounded-xl bg-accent px-3.5 py-2.5 text-xs resize-none focus:outline-none border-2 transition-all ${buildTriedConfirm && !buildNotes.trim() ? "border-red-500" : "border-border"}`}
              />
              {buildTriedConfirm && !buildNotes.trim() && (
                <p className="text-[10px] font-semibold mt-1 text-red-500">Debes describir cómo quieres tu producto</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border">
              <button
                onClick={confirmBuildCustom}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all active:scale-[0.98]"
              >
                🎨 Agregar a tu pinta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {detailProduct && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center p-4 animate-in fade-in duration-200"
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
                src={optimizeCloudinaryUrl(detailProduct.image, 400)}
                alt={detailProduct.name}
                fill
                className="object-cover"
                sizes="400px"
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
              <p className="text-lg font-black mt-3" style={{ color: "var(--primary)" }}>$ {detailProduct.price.toLocaleString("es-CL")}</p>
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
                    onClick={() => addToCart(detailProduct)}
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
