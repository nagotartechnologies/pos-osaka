"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { getAvailableProducts, getCategories, type Product, type CustomizationOption } from "@/lib/supabase-menu"
import { addOrder, getOrdersByDateRange, type AddOrderData, type PaymentMethod, type DeliveryType } from "@/lib/supabase-orders"
import { getAllConfig } from "@/lib/supabase-config"
import type { CartItem } from "@/app/pos/types"
import { SALSAS, MAX_FREE_SALSAS } from "@/app/pos/types"

export function usePOS() {
  // Data
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState("")
  const [selectedCat, setSelectedCat] = useState("all")

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])

  // Client
  const [clientName, setClientName] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("retiro")
  const [address, setAddress] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo")
  const [cardType, setCardType] = useState<"debito" | "credito" | null>(null)
  const [cashAmount, setCashAmount] = useState("")
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Top sellers
  const [topSellerIds, setTopSellerIds] = useState<string[]>([])

  // Customization
  const [customizeProduct, setCustomizeProduct] = useState<Product | null>(null)
  const [customProtein, setCustomProtein] = useState<CustomizationOption | null>(null)
  const [customWrapper, setCustomWrapper] = useState<CustomizationOption | null>(null)
  const [customInstructions, setCustomInstructions] = useState("")
  const [customTriedConfirm, setCustomTriedConfirm] = useState(false)
  const [unitChoices, setUnitChoices] = useState<(CustomizationOption | null)[]>([])

  // Build custom
  const [buildProduct, setBuildProduct] = useState<Product | null>(null)
  const [buildNotes, setBuildNotes] = useState("")
  const [buildTriedConfirm, setBuildTriedConfirm] = useState(false)

  // Load data
  useEffect(() => {
    setLoading(true)
    Promise.all([getAvailableProducts(), getCategories(), getAllConfig(), getOrdersByDateRange(7)]).then(
      ([prods, cats, cfg, recentOrders]) => {
        setProducts(prods)
        setCategories(cats.map((c) => ({ id: c.id, name: c.name })))
        if (cfg.deliveryFee) setDeliveryFee(Number(cfg.deliveryFee) || 0)

        // Compute top sellers from last 7 days
        const counts = new Map<string, number>()
        for (const order of recentOrders) {
          for (const item of order.items) {
            counts.set(item.id, (counts.get(item.id) || 0) + item.quantity)
          }
        }
        const sorted = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([id]) => id)
        setTopSellerIds(sorted)

        setLoading(false)
      }
    )
  }, [])

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

  // Top sellers products
  const topSellers = useMemo(() => {
    if (topSellerIds.length === 0) return []
    return topSellerIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[]
  }, [topSellerIds, products])

  // Helpers
  const getCategoryName = useCallback(
    (catId: string) => categories.find((c) => c.id === catId)?.name || catId,
    [categories]
  )

  const hasCustomization = (product: Product) =>
    (product.protein_options && product.protein_options.length > 0) ||
    (product.wrapper_options && product.wrapper_options.length > 0)

  const makeCartKey = (product: Product, protein?: CustomizationOption | null, wrapper?: CustomizationOption | null) => {
    const pName = protein?.name || "_"
    const wName = wrapper?.name || "_"
    return hasCustomization(product) ? `${product.id}--${pName}--${wName}` : product.id
  }

  const hasCustomChange = (customProtein?.price || 0) > 0 || (customWrapper?.price || 0) > 0

  const isPerUnit = customizeProduct?.per_unit_choice && (customizeProduct.choice_count || 0) > 0
  const perUnitComplete = isPerUnit ? unitChoices.every((c) => c !== null) : true

  // Cart actions
  const addToCart = useCallback(
    (product: Product) => {
      if (hasCustomization(product)) {
        setCustomizeProduct(product)
        setCustomProtein(null)
        setCustomWrapper(null)
        setCustomInstructions("")
        setCustomTriedConfirm(false)
        const count = product.per_unit_choice ? (product.choice_count || 1) : 0
        setUnitChoices(count > 0 ? Array(count).fill(null) : [])
        return
      }
      setCart((prev) => {
        const existing = prev.find((i) => i.id === product.id && !i.cartKey)
        if (existing) return prev.map((i) => i.id === product.id && !i.cartKey ? { ...i, quantity: i.quantity + 1 } : i)
        const catName = getCategoryName(product.category)
        return [...prev, { id: product.id, name: product.name, price: product.price, image: product.image, category: catName, quantity: 1 }]
      })
    },
    [getCategoryName]
  )

  const updateQty = useCallback((key: string, delta: number) => {
    setCart((prev) => prev.map((i) => (i.cartKey || i.id) === key ? { ...i, quantity: i.quantity + delta } : i).filter((i) => i.quantity > 0))
  }, [])

  const removeFromCart = useCallback((key: string) => {
    setCart((prev) => prev.filter((i) => (i.cartKey || i.id) !== key))
  }, [])

  const getItemUnitPrice = (item: CartItem) => item.price + (item.selectedProtein?.price || 0) + (item.selectedWrapper?.price || 0)

  const getCartQty = useCallback(
    (id: string) => cart.filter((i) => i.id === id).reduce((sum, i) => sum + i.quantity, 0),
    [cart]
  )

  const cartTotal = cart.reduce((sum, i) => sum + getItemUnitPrice(i) * i.quantity, 0)
  const orderTotal = cartTotal + (deliveryType === "delivery" && deliveryFee > 0 ? deliveryFee : 0)
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)

  // Salsas helpers
  const addSalsa = useCallback((salsa: typeof SALSAS[number]) => {
    const isFree = salsa.price === 0
    const totalFreeSalsas = SALSAS.filter((s) => s.price === 0).reduce((sum, s) => {
      const salsaInCart = cart.find((i) => i.id === s.id)
      return sum + (salsaInCart?.quantity || 0)
    }, 0)
    if (isFree && totalFreeSalsas >= MAX_FREE_SALSAS) return
    setCart((prev) => {
      const existing = prev.find((i) => i.id === salsa.id)
      if (existing) return prev.map((i) => i.id === salsa.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { id: salsa.id, name: salsa.name, price: salsa.price, image: "", quantity: 1 }]
    })
  }, [cart])

  const getSalsaLimitReached = useCallback(
    (salsaId: string) => {
      const salsa = SALSAS.find((s) => s.id === salsaId)
      if (!salsa || salsa.price > 0) return false
      const totalFree = SALSAS.filter((s) => s.price === 0).reduce((sum, s) => {
        const c = cart.find((i) => i.id === s.id)
        return sum + (c?.quantity || 0)
      }, 0)
      return totalFree >= MAX_FREE_SALSAS
    },
    [cart]
  )

  // Customization confirm
  const confirmCustomization = useCallback(() => {
    if (!customizeProduct) return
    if (isPerUnit && !perUnitComplete) {
      setCustomTriedConfirm(true)
      return
    }
    if (hasCustomChange && !customInstructions.trim()) {
      setCustomTriedConfirm(true)
      return
    }
    const catName = getCategoryName(customizeProduct.category)
    if (isPerUnit) {
      const choices = unitChoices.filter((c): c is CustomizationOption => c !== null)
      const grouped = choices.reduce((acc, c) => {
        acc[c.name] = (acc[c.name] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      const desc = Object.entries(grouped).map(([name, count]) => `${count}x ${name}`).join(", ")
      const key = `${customizeProduct.id}--unit-${desc}`
      const notes = customInstructions.trim() || desc
      setCart((prev) => {
        const existing = prev.find((i) => (i.cartKey || i.id) === key)
        if (existing) return prev.map((i) => (i.cartKey || i.id) === key ? { ...i, quantity: i.quantity + 1, notes: notes || i.notes } : i)
        return [...prev, { id: customizeProduct.id, name: customizeProduct.name, price: customizeProduct.price, image: customizeProduct.image, category: catName, quantity: 1, cartKey: key, notes, unitChoices: choices }]
      })
    } else {
      const key = makeCartKey(customizeProduct, customProtein, customWrapper)
      const notes = customInstructions.trim() || ""
      setCart((prev) => {
        const existing = prev.find((i) => (i.cartKey || i.id) === key)
        if (existing) return prev.map((i) => (i.cartKey || i.id) === key ? { ...i, quantity: i.quantity + 1, notes: notes || i.notes } : i)
        return [...prev, { id: customizeProduct.id, name: customizeProduct.name, price: customizeProduct.price, image: customizeProduct.image, category: catName, quantity: 1, cartKey: key, selectedProtein: customProtein, selectedWrapper: customWrapper, notes }]
      })
    }
    setCustomizeProduct(null)
  }, [customizeProduct, customProtein, customWrapper, customInstructions, hasCustomChange, isPerUnit, perUnitComplete, unitChoices, getCategoryName])

  // Build custom
  const openBuildCustom = useCallback((product: Product) => {
    setBuildProduct(product)
    setBuildNotes("")
    setBuildTriedConfirm(false)
  }, [])

  const confirmBuildCustom = useCallback(() => {
    if (!buildProduct) return
    if (!buildNotes.trim()) {
      setBuildTriedConfirm(true)
      return
    }
    const key = `${buildProduct.id}--build--${Date.now()}`
    const catName = getCategoryName(buildProduct.category)
    setCart((prev) => [
      ...prev,
      {
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
      },
    ])
    setBuildProduct(null)
  }, [buildProduct, buildNotes, getCategoryName])

  // Submit order
  const handleSubmit = useCallback(async () => {
    if (!clientName.trim() || cart.length === 0) return false
    setSubmitting(true)

    const cashNum = paymentMethod === "efectivo" && cashAmount ? parseFloat(cashAmount) : null
    const changeNum = cashNum !== null ? cashNum - orderTotal : null

    const data: AddOrderData & { cardType?: string | null } = {
      items: cart.map((i) => {
        const extras: { description: string; price: number }[] = []
        if (i.unitChoices && i.unitChoices.length > 0) {
          const grouped = i.unitChoices.reduce((acc: Record<string, number>, opt) => {
            acc[opt.name] = (acc[opt.name] || 0) + 1
            return acc
          }, {} as Record<string, number>)
          for (const [name, count] of Object.entries(grouped)) {
            extras.push({ description: `${count}x ${name}`, price: 0 })
          }
        }
        if (i.selectedProtein) extras.push({ description: `Proteína: ${i.selectedProtein.name}`, price: i.selectedProtein.price })
        if (i.selectedWrapper) extras.push({ description: `Envoltura: ${i.selectedWrapper.name}`, price: i.selectedWrapper.price })
        return {
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          category: i.category,
          notes: i.notes || "",
          extras: extras.length > 0 ? extras : undefined,
          customBuild: i.customBuild || false,
          customBuildNotes: i.customBuildNotes || "",
        }
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
      // Reset form
      setCart([])
      setClientName("")
      setClientPhone("")
      setDeliveryType("retiro")
      setAddress("")
      setPaymentMethod("efectivo")
      setCardType(null)
      setCashAmount("")
      return true
    }
    return false
  }, [cart, clientName, clientPhone, deliveryType, address, paymentMethod, cardType, cashAmount, orderTotal])

  return {
    // Data
    products,
    categories,
    loading,
    filtered,
    topSellers,
    // Filters
    search,
    setSearch,
    selectedCat,
    setSelectedCat,
    // Cart
    cart,
    addToCart,
    updateQty,
    removeFromCart,
    getItemUnitPrice,
    getCartQty,
    cartTotal,
    orderTotal,
    cartCount,
    // Salsas
    addSalsa,
    getSalsaLimitReached,
    // Client
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
    handleSubmit,
    // Customization
    customizeProduct,
    setCustomizeProduct,
    customProtein,
    setCustomProtein,
    customWrapper,
    setCustomWrapper,
    customInstructions,
    setCustomInstructions,
    customTriedConfirm,
    hasCustomChange,
    confirmCustomization,
    isPerUnit,
    perUnitComplete,
    unitChoices,
    setUnitChoices,
    // Build custom
    buildProduct,
    setBuildProduct,
    openBuildCustom,
    buildNotes,
    setBuildNotes,
    buildTriedConfirm,
    confirmBuildCustom,
    // Helpers
    hasCustomization,
    getCategoryName,
  }
}
