"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import { type MenuItem, type CustomizationOption } from "@/lib/store"
import { loadLogoForTheme, loadBusinessName, loadWhatsApp, loadBankData, loadAddress } from "@/lib/config-store"
import { getAllConfig, getConfigValue } from "@/lib/supabase-config"
import { addOrder } from "@/lib/supabase-orders"
import { isDebitDeliveryBlocked } from "@/lib/debit-limit"
import { uploadImage, isCloudinaryConfigured, optimizeCloudinaryUrl } from "@/lib/cloudinary"
import { getAvailableProducts, getCategories as getDbCategories, isNewProduct, sortNewFirst } from "@/lib/supabase-menu"
import { parseSchedule, checkStoreOpen, DAY_KEYS, DAY_LABELS, type WeekSchedule } from "@/lib/schedule"
import { MapPin, Clock, Star, Sparkles, Minus, Plus, ShoppingBag, X, Trash2, ChevronLeft, ChevronRight, Truck, Store, Banknote, CreditCard, ArrowRightLeft, CheckCircle2, User, Phone, MessageSquare, Upload, Loader2, ImageIcon, Palette, Beef, Droplets } from "lucide-react"

type DeliveryType = "delivery" | "retiro"
type PaymentMethod = "efectivo" | "transferencia" | "tarjeta" | ""

const SALSAS: MenuItem[] = [
  { id: "salsa-soya", name: "Salsa Soya", price: 0, image: "", category: "salsas" },
  { id: "salsa-agridulce", name: "Salsa Agridulce", price: 0, image: "", category: "salsas" },
  { id: "salsa-acevichada", name: "Salsa Acevichada", price: 500, image: "", category: "salsas" },
  { id: "salsa-teriyaki", name: "Salsa Teriyaki", price: 500, image: "", category: "salsas" },
]
const MAX_FREE_SALSAS = 999

interface CartItem extends MenuItem {
  quantity: number
  notes?: string
  cartKey?: string
  selectedProtein?: CustomizationOption | null
  selectedWrapper?: CustomizationOption | null
  customBuild?: boolean
  customBuildNotes?: string
  unitChoices?: CustomizationOption[]
}

export default function CartaPage() {
  const params = useParams()
  const code = params.code as string
  const [authorized, setAuthorized] = useState<boolean | null>(null)

  const [logo, setLogo] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [clientName, setClientName] = useState(() => "")
  const [clientPhone, setClientPhone] = useState(() => "")

  // Pre-llenar teléfono (y nombre si viene) desde parámetros de URL
  useEffect(() => {
    if (typeof window === "undefined") return
    const sp = new URLSearchParams(window.location.search)
    const phoneParam = sp.get("phone")
    const nameParam = sp.get("name")
    if (phoneParam) setClientPhone(decodeURIComponent(phoneParam))
    if (nameParam) setClientName(decodeURIComponent(nameParam))
  }, [])
  const categoryBarRef = useRef<HTMLDivElement>(null)
  const [bookOpen, setBookOpen] = useState(false)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null)
  const [coverReady, setCoverReady] = useState(false)

  // Customization modal state
  const [customizeItem, setCustomizeItem] = useState<MenuItem | null>(null)
  const [customProtein, setCustomProtein] = useState<CustomizationOption | null>(null)
  const [customWrapper, setCustomWrapper] = useState<CustomizationOption | null>(null)
  const [customInstructions, setCustomInstructions] = useState("")
  const [customTriedConfirm, setCustomTriedConfirm] = useState(false)
  const [unitChoices, setUnitChoices] = useState<(CustomizationOption | null)[]>([])

  // Ármalo a tu pinta
  const [buildItem, setBuildItem] = useState<MenuItem | null>(null)
  const [buildNotes, setBuildNotes] = useState("")
  const [buildTriedConfirm, setBuildTriedConfirm] = useState(false)

  // Checkout state
  const [checkoutStep, setCheckoutStep] = useState(0) // 0=carrito, 1=datos, 2=entrega, 3=pago
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("delivery")
  const [address, setAddress] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("")
  const [cardType, setCardType] = useState<"debito" | "credito" | null>(null)
  const [debitBlocked, setDebitBlocked] = useState(false)
  const [cardPaymentsEnabled, setCardPaymentsEnabled] = useState(false)
  const [cashAmount, setCashAmount] = useState("")
  const [orderSent, setOrderSent] = useState(false)
  const [submittingOrder, setSubmittingOrder] = useState(false)
  // Lock síncrono anti doble-submit: el estado submittingOrder se actualiza de
  // forma asíncrona y NO protege contra dos taps en el mismo tick (doble-tap
  // móvil). Un ref se lee/escribe de inmediato y cierra esa ventana de carrera.
  const submitLockRef = useRef(false)
  const [triedContinue, setTriedContinue] = useState(false)

  // Comprobante de transferencia
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState("")
  const [receiptUrl, setReceiptUrl] = useState("")
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [receiptError, setReceiptError] = useState("")
  const receiptInputRef = useRef<HTMLInputElement>(null)

  // Config loaded
  const [storeWhatsApp, setStoreWhatsApp] = useState("")
  const [bankData, setBankData] = useState({ banco: "", tipoCuenta: "", numeroCuenta: "", rut: "", titular: "" })
  const [storeAddress, setStoreAddress] = useState("")
  const [deliveryFee, setDeliveryFee] = useState(0)

  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([{ id: "all", name: "Todo" }])
  const [menuLoading, setMenuLoading] = useState(true)
  const [storeClosed, setStoreClosed] = useState(false)
  const [storeSchedule, setStoreSchedule] = useState<WeekSchedule | null>(null)
  const [closedInfo, setClosedInfo] = useState<{ nextDay: string | null; nextTime: string | null }>({ nextDay: null, nextTime: null })
  const [highDemandMsg, setHighDemandMsg] = useState("")
  const [acceptedDelay, setAcceptedDelay] = useState(false)
  const [ordersBlocked, setOrdersBlocked] = useState(false)
  const [ordersBlockedMsg, setOrdersBlockedMsg] = useState("")
  const [deliveryZoneMsg, setDeliveryZoneMsg] = useState("")
  const [promoBanners, setPromoBanners] = useState<{ id: string; text: string; color: "red" | "green" }[]>([])

  // Validar código de acceso
  useEffect(() => {
    getConfigValue("cartaCode").then((savedCode) => {
      setAuthorized(savedCode === code)
    })
  }, [code])

  useEffect(() => {
    if (authorized !== true) return
    async function loadAll() {
      // Cargar config del negocio desde Supabase
      const dbConfig = await getAllConfig()
      if (dbConfig.logoPublicUrl) setLogo(dbConfig.logoPublicUrl)
      else setLogo(loadLogoForTheme("dark"))
      setBusinessName(dbConfig.nombreNegocio || loadBusinessName() || "Osaka Sushi Restaurant")
      setStoreWhatsApp(dbConfig.whatsapp || loadWhatsApp())
      setStoreAddress(dbConfig.direccion || loadAddress())
      if (dbConfig.deliveryFee) setDeliveryFee(Number(dbConfig.deliveryFee) || 0)
      if (dbConfig.highDemandMsg) setHighDemandMsg(dbConfig.highDemandMsg)
      if (dbConfig.promoBanners) {
        try {
          const parsed = JSON.parse(dbConfig.promoBanners) as { id: string; text: string; color: "red" | "green" }[]
          if (Array.isArray(parsed)) setPromoBanners(parsed)
        } catch {}
      }
      if (dbConfig.ordersBlocked === "true") {
        setOrdersBlocked(true)
        setOrdersBlockedMsg(dbConfig.ordersBlockedMsg || "")
      }
      if (dbConfig.deliveryZoneEnabled === "true" && dbConfig.deliveryZoneMsg) {
        setDeliveryZoneMsg(dbConfig.deliveryZoneMsg)
      }
      setCardPaymentsEnabled(dbConfig.cardPaymentsEnabled === "true")
      if (dbConfig.bankData) {
        try { setBankData(JSON.parse(dbConfig.bankData)) } catch { setBankData(loadBankData()) }
      } else {
        setBankData(loadBankData())
      }

      // Parsear schedule SIEMPRE para tener horarios disponibles en pantalla de cerrado
      const sched = parseSchedule(dbConfig.schedule || null, dbConfig.horaApertura, dbConfig.horaCierre)
      setStoreSchedule(sched)

      // El estado abierto/cerrado depende SOLO del inicio y cierre de día manual
      // El horario de configuración es únicamente informativo
      const lastStart = dbConfig.lastDayStart
      const lastClose = dbConfig.lastDayClose
      const dayIsOpen = !!lastStart && (!lastClose || lastStart > lastClose)
      if (!dayIsOpen) {
        setStoreClosed(true)
        return
      }

      // Cargar productos y categorías
      const [prods, cats] = await Promise.all([getAvailableProducts(), getDbCategories()])
      setMenuItems(sortNewFirst(prods.map((p) => ({ id: p.id, name: p.name, price: Number(p.price), image: p.image, category: p.category, description: p.description || "", protein_options: p.protein_options || null, wrapper_options: p.wrapper_options || null, allow_custom_build: p.allow_custom_build || false, per_unit_choice: p.per_unit_choice || false, choice_count: p.choice_count || null, created_at: p.created_at })), (i) => i.created_at))
      if (cats.length > 0) {
        setCategories([{ id: "all", name: "Todo" }, ...cats.map((c) => ({ id: c.id, name: c.name }))])
      }
      setMenuLoading(false)
    }
    loadAll()

    const t = setTimeout(() => setCoverReady(true), 100)
    return () => clearTimeout(t)
  }, [authorized])

  const filteredItems = useMemo(() => {
    if (activeCategory === "all") return menuItems
    return menuItems.filter((item) => item.category === activeCategory)
  }, [activeCategory, menuItems])

  const newItems = useMemo(() => menuItems.filter((i) => isNewProduct(i.created_at)), [menuItems])

  useEffect(() => {
    if (checkoutStep === 3) isDebitDeliveryBlocked().then(setDebitBlocked).catch(() => {})
  }, [checkoutStep])

  const getCategoryName = (catId: string) => {
    return categories.find((c) => c.id === catId)?.name || catId
  }

  // --- Carrito ---
  const hasCustomization = (item: MenuItem) =>
    (item.protein_options && item.protein_options.length > 0) || (item.wrapper_options && item.wrapper_options.length > 0)

  const makeCartKey = (item: MenuItem, protein?: CustomizationOption | null, wrapper?: CustomizationOption | null) => {
    const pName = protein?.name || "_"
    const wName = wrapper?.name || "_"
    return hasCustomization(item) ? `${item.id}--${pName}--${wName}` : item.id
  }

  const openCustomization = (item: MenuItem) => {
    setCustomizeItem(item)
    setCustomProtein(null)
    setCustomWrapper(null)
    setCustomInstructions("")
    setCustomTriedConfirm(false)
    const count = item.per_unit_choice ? (item.choice_count || 1) : 0
    setUnitChoices(count > 0 ? Array(count).fill(null) : [])
  }

  const hasCustomChange = (customProtein?.price || 0) > 0 || (customWrapper?.price || 0) > 0

  const isPerUnit = customizeItem?.per_unit_choice && (customizeItem.choice_count || 0) > 0

  const perUnitComplete = isPerUnit ? unitChoices.every((c) => c !== null) : true

  const confirmCustomization = () => {
    if (!customizeItem) return
    if (isPerUnit && !perUnitComplete) {
      setCustomTriedConfirm(true)
      return
    }
    if (hasCustomChange && !customInstructions.trim()) {
      setCustomTriedConfirm(true)
      return
    }
    let key: string
    let notes = customInstructions.trim() || ""
    let extraFields: Record<string, unknown> = {}
    if (isPerUnit) {
      const choices = unitChoices.filter((c): c is CustomizationOption => c !== null)
      const grouped = choices.reduce((acc, c) => {
        acc[c.name] = (acc[c.name] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      const desc = Object.entries(grouped).map(([name, count]) => `${count}x ${name}`).join(", ")
      key = `${customizeItem.id}--unit-${desc}`
      extraFields = { unitChoices: choices }
    } else {
      key = makeCartKey(customizeItem, customProtein, customWrapper)
      extraFields = { selectedProtein: customProtein, selectedWrapper: customWrapper }
    }
    const catName = getCategoryName(customizeItem.category)
    setCart((prev) => {
      const existing = prev.find((c) => (c.cartKey || c.id) === key)
      if (existing) return prev.map((c) => (c.cartKey || c.id) === key ? { ...c, quantity: c.quantity + 1, notes: notes || c.notes } : c)
      return [...prev, { ...customizeItem, category: catName, quantity: 1, cartKey: key, notes, ...extraFields }]
    })
    setCustomizeItem(null)
    setDetailItem(null)
  }

  // Ármalo a tu pinta
  const openBuildCustom = (item: MenuItem) => {
    setDetailItem(null)
    setBuildItem(item)
    setBuildNotes("")
    setBuildTriedConfirm(false)
  }

  const confirmBuildCustom = () => {
    if (!buildItem) return
    if (!buildNotes.trim()) {
      setBuildTriedConfirm(true)
      return
    }
    const key = `${buildItem.id}--build--${Date.now()}`
    const catName = getCategoryName(buildItem.category)
    setCart((prev) => [...prev, {
      ...buildItem,
      category: catName,
      quantity: 1,
      cartKey: key,
      customBuild: true,
      customBuildNotes: buildNotes.trim(),
      notes: "",
    }])
    setBuildItem(null)
    setBuildNotes("")
    setBuildTriedConfirm(false)
  }

  const addToCart = (item: MenuItem | CartItem) => {
    // Si es un CartItem con cartKey
    if ("cartKey" in item && item.cartKey) {
      // Si es custom build, duplicar el item (crear otro igual con nuevo key)
      if (item.customBuild) {
        const newKey = `${item.id}--build--${Date.now()}`
        setCart((prev) => [...prev, {
          ...item,
          cartKey: newKey,
          quantity: 1,
        }])
        return
      }
      // Si no es custom, solo incrementar cantidad
      setCart((prev) => prev.map((c) => (c.cartKey || c.id) === item.cartKey ? { ...c, quantity: c.quantity + 1 } : c))
      return
    }
    // Si tiene opciones de personalización, abrir modal
    if (hasCustomization(item)) {
      openCustomization(item)
      return
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id && !c.cartKey)
      if (existing) return prev.map((c) => c.id === item.id && !c.cartKey ? { ...c, quantity: c.quantity + 1 } : c)
      const catName = getCategoryName(item.category)
      return [...prev, { ...item, category: catName, quantity: 1 }]
    })
  }

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => (c.cartKey || c.id) === itemId)
      if (!existing) return prev
      if (existing.quantity <= 1) return prev.filter((c) => (c.cartKey || c.id) !== itemId)
      return prev.map((c) => (c.cartKey || c.id) === itemId ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  const deleteFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => (c.cartKey || c.id) !== itemId))
  }

  const updateItemNotes = (itemId: string, notes: string) => {
    setCart((prev) => prev.map((c) => (c.cartKey || c.id) === itemId ? { ...c, notes } : c))
  }

  const updateCustomBuildNotes = (itemId: string, customBuildNotes: string) => {
    setCart((prev) => prev.map((c) => (c.cartKey || c.id) === itemId ? { ...c, customBuildNotes, notes: "" } : c))
  }

  const getItemQty = (itemId: string) => cart.filter((c) => c.id === itemId).reduce((s, c) => s + c.quantity, 0)

  const getItemUnitPrice = (item: CartItem) => item.price + (item.selectedProtein?.price || 0) + (item.selectedWrapper?.price || 0)

  const cartSubtotal = useMemo(() => cart.reduce((s, c) => s + getItemUnitPrice(c) * c.quantity, 0), [cart])
  const cartCount = useMemo(() => cart.reduce((s, c) => s + c.quantity, 0), [cart])
  const deliveryCost = checkoutStep >= 2 && deliveryType === "delivery" ? deliveryFee : 0
  const cartTotal = cartSubtotal + deliveryCost

  const cashNum = parseFloat(cashAmount) || 0
  const changeAmount = paymentMethod === "efectivo" && cashNum > cartTotal ? cashNum - cartTotal : 0

  const hasCustomBuild = useMemo(() => cart.some((c) => c.customBuild), [cart])

  const canSubmit = () => {
    if (!clientPhone.trim()) return false
    if (deliveryType === "delivery" && !address.trim()) return false
    if (deliveryType === "retiro" && !clientName.trim()) return false
    if (hasCustomBuild) return true // Sin pago, el vendedor cotiza
    if (!paymentMethod) return false
    if (paymentMethod === "tarjeta" && !cardType) return false
    if (paymentMethod === "tarjeta" && cardType === "debito" && deliveryType === "delivery" && debitBlocked) return false
    if (paymentMethod === "transferencia" && !receiptFile && !receiptUrl) return false
    return true
  }

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
    setReceiptError("")
    const reader = new FileReader()
    reader.onloadend = () => setReceiptPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmitOrder = async () => {
    if (cart.length === 0 || !canSubmit() || submitLockRef.current) return
    submitLockRef.current = true
    setSubmittingOrder(true)

    // Si es transferencia y hay archivo, subir a Cloudinary
    let finalReceiptUrl = receiptUrl
    if (!hasCustomBuild && paymentMethod === "transferencia" && receiptFile && !receiptUrl) {
      if (!isCloudinaryConfigured()) {
        setReceiptError("Cloudinary no está configurado. No se puede subir el comprobante.")
        submitLockRef.current = false
        setSubmittingOrder(false)
        return
      }
      setUploadingReceipt(true)
      setReceiptError("")
      try {
        finalReceiptUrl = await uploadImage(receiptFile, "comprobantes")
        setReceiptUrl(finalReceiptUrl)
      } catch (err: any) {
        setReceiptError(err.message || "Error al subir comprobante")
        setUploadingReceipt(false)
        submitLockRef.current = false
        setSubmittingOrder(false)
        return
      }
      setUploadingReceipt(false)
    }

    // Guardar pedido en Supabase
    let newOrder: any = null
    try {
      newOrder = await addOrder({
        items: cart.map(c => {
          const extras: { description: string; price: number }[] = []
          if (c.unitChoices && c.unitChoices.length > 0) {
            const grouped = c.unitChoices.reduce((acc: Record<string, number>, opt) => {
              acc[opt.name] = (acc[opt.name] || 0) + 1
              return acc
            }, {} as Record<string, number>)
            for (const [name, count] of Object.entries(grouped)) {
              extras.push({ description: `${count}x ${name}`, price: 0 })
            }
          }
          if (c.selectedProtein) extras.push({ description: `Proteína: ${c.selectedProtein.name}`, price: c.selectedProtein.price })
          if (c.selectedWrapper) extras.push({ description: `Envoltura: ${c.selectedWrapper.name}`, price: c.selectedWrapper.price })
          return { id: c.id, name: c.name, price: c.price, quantity: c.quantity, category: c.category, notes: c.notes?.trim() || "", extras: extras.length > 0 ? extras : undefined, customBuild: c.customBuild || false, customBuildNotes: c.customBuildNotes || "" }
        }),
        total: cartTotal,
        clientName: deliveryType === "delivery" && !clientName.trim() ? clientPhone.trim() : clientName.trim(),
        clientPhone: clientPhone.trim(),
        deliveryType,
        address: deliveryType === "delivery" ? address.trim() : "",
        paymentMethod: (hasCustomBuild ? "efectivo" : (paymentMethod || "efectivo")) as "efectivo" | "transferencia" | "tarjeta",
        cardType: !hasCustomBuild && paymentMethod === "tarjeta" ? cardType : null,
        cashAmount: hasCustomBuild ? null : (paymentMethod === "efectivo" ? cashNum : null),
        change: hasCustomBuild ? null : (paymentMethod === "efectivo" ? changeAmount : null),
        receiptUrl: hasCustomBuild ? null : (finalReceiptUrl || null),
      })
    } catch (err) {
      console.error("Error creando pedido:", err)
      submitLockRef.current = false
      setSubmittingOrder(false)
      alert("Hubo un error al enviar tu pedido. Por favor intenta de nuevo.")
      return
    }

    if (!newOrder) {
      submitLockRef.current = false
      setSubmittingOrder(false)
      alert("No se pudo crear el pedido. Verifica tu conexión e intenta de nuevo.")
      return
    }

    // Enviar mensaje de confirmación por WhatsApp
    if (newOrder) {
      try {
        const confirmationMsg = `¡Hola ${clientName.trim()}! 🍣\n\nTu pedido *#${newOrder.id}* ya está en manos de *${businessName}*.\n\nTe avisaremos por WhatsApp cuando comencemos a prepararlo.\n\n¡Gracias por preferirnos!`
        await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-token": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" },
          body: JSON.stringify({ phone: clientPhone.trim(), message: confirmationMsg }),
        })
      } catch (err) {
        console.error("Error enviando confirmación WhatsApp:", err)
      }
    }

    setSubmittingOrder(false)
    setShowCart(false)
    setOrderSent(true)
    setTimeout(() => {
      setCart([])
      setClientName("")
      setClientPhone("")
      setAddress("")
      setCashAmount("")
      setCheckoutStep(0)
      setPaymentMethod("")
      setCardType(null)
      setDeliveryType("delivery")
      setReceiptFile(null)
      setReceiptPreview("")
      setReceiptUrl("")
      setReceiptError("")
      submitLockRef.current = false
      setSubmittingOrder(false)
      setOrderSent(false)
    }, 5000)
  }

  // Loading auth check
  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#faf7f2" }}>
        <div className="h-8 w-8 rounded-full border-2 border-[#c1272d]/30 border-t-[#c1272d] animate-spin" />
      </div>
    )
  }

  // Not authorized
  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#faf7f2" }}>
        <div className="text-center">
          <p className="text-5xl mb-4">🍣</p>
          <h1 className="text-xl font-bold mb-2" style={{ color: "#1a1210" }}>Carta no disponible</h1>
          <p className="text-sm" style={{ color: "#8c7e6a" }}>El enlace no es válido o ha expirado.</p>
        </div>
      </div>
    )
  }

  // Pedidos pausados por el operador (prioridad sobre cerrado)
  if (ordersBlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#faf7f2" }}>
        <div className="text-center max-w-sm mx-auto">
          {logo ? (
            <div className="relative h-20 w-20 mx-auto mb-6 rounded-2xl overflow-hidden" style={{ background: "#1a1210" }}>
              <Image src={logo} alt="Logo" fill className="object-contain p-2" sizes="80px" />
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl mx-auto mb-6" style={{ background: "#c1272d" }}>
              <span className="text-3xl font-black text-white">O</span>
            </div>
          )}
          <h1 className="text-xl font-bold mb-3" style={{ color: "#1a1210" }}>{businessName}</h1>
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "#fee2e2", color: "#dc2626" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Sin pedidos por ahora
            </span>
          </div>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: "#5c4a3a" }}>
            {ordersBlockedMsg || "No estamos recibiendo pedidos en este momento. ¡Muchas gracias!"}
          </p>
          {storeWhatsApp && (
            <a
              href={`https://wa.me/${storeWhatsApp.replace(/[^0-9+]/g, "")}`}
              target="_blank"
              className="mt-2 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors"
              style={{ background: "#25d366" }}
            >
              <MessageSquare className="h-4 w-4" />
              Contáctanos
            </a>
          )}
        </div>
      </div>
    )
  }

  // Store closed
  if (storeClosed && storeSchedule) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#faf7f2" }}>
        <div className="text-center max-w-sm mx-auto">
          {logo ? (
            <div className="relative h-20 w-20 mx-auto mb-6 rounded-2xl overflow-hidden" style={{ background: "#1a1210" }}>
              <Image src={logo} alt="Logo" fill className="object-contain p-2" sizes="80px" />
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl mx-auto mb-6" style={{ background: "#c1272d" }}>
              <span className="text-3xl font-black text-white">O</span>
            </div>
          )}
          <h1 className="text-xl font-bold mb-1" style={{ color: "#1a1210" }}>{businessName}</h1>
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "#fee2e2", color: "#dc2626" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Cerrado
            </span>
          </div>

          {/* Horario semanal */}
          <div className="rounded-2xl border p-4 text-left" style={{ borderColor: "#e8e2d8", background: "#fff" }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#8c7e6a" }}>Horarios de atención</p>
            <div className="space-y-1.5">
              {DAY_KEYS.map((day) => {
                const d = storeSchedule[day]
                return (
                  <div key={day} className="flex items-center justify-between text-sm">
                    <span className="font-medium" style={{ color: d.open ? "#1a1210" : "#c4b9a8" }}>{DAY_LABELS[day]}</span>
                    <span style={{ color: d.open ? "#1a1210" : "#c4b9a8" }}>
                      {d.open ? `${d.from} – ${d.to}` : "Cerrado"}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {storeWhatsApp && (
            <a
              href={`https://wa.me/${storeWhatsApp.replace(/[^0-9+]/g, "")}`}
              target="_blank"
              className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors"
              style={{ background: "#25d366" }}
            >
              <MessageSquare className="h-4 w-4" />
              Contáctanos
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32" style={{ background: "#faf7f2" }}>

      {/* ═══ BANNERS (alta demanda + promociones) ═══ */}
      {(highDemandMsg || promoBanners.length > 0) && (
        <div className="sticky top-0 z-30">
          {highDemandMsg && (
            <div className="px-4 py-2.5 flex items-center gap-2.5 text-sm" style={{ background: "#fef3cd", borderBottom: "1px solid #fde68a" }}>
              <span className="text-base flex-shrink-0">🔥</span>
              <p className="font-medium" style={{ color: "#92400e" }}>{highDemandMsg}</p>
            </div>
          )}
          {promoBanners.map((banner) => (
            <div
              key={banner.id}
              className="px-4 py-2.5 flex items-center gap-2.5 text-sm"
              style={{
                background: banner.color === "red" ? "#fee2e2" : "#dcfce7",
                borderBottom: `1px solid ${banner.color === "red" ? "#fecaca" : "#bbf7d0"}`,
              }}
            >
              <span className="text-base flex-shrink-0">{banner.color === "red" ? "🔥" : "🎉"}</span>
              <p className="font-medium" style={{ color: banner.color === "red" ? "#991b1b" : "#166534" }}>{banner.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div style={{ background: "#1a1210" }}>
        <div className="px-5 pt-12 pb-5">
          <div className="flex items-center gap-3.5">
            {logo ? (
              <div className="relative h-14 w-14 flex-shrink-0 rounded-xl overflow-hidden bg-white/10">
                <Image src={logo} alt="Logo" fill className="object-contain p-1" sizes="56px" />
              </div>
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl flex-shrink-0" style={{ background: "#c1272d" }}>
                <span className="text-2xl font-black text-white">O</span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white truncate">{businessName}</h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1 text-[11px] text-white/50">
                  <Star className="h-3 w-3 text-amber-400" /> 4.8
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CATEGORÍAS — sticky ═══ */}
      <div className="sticky top-0 z-30 border-b" style={{ background: "#faf7f2", borderColor: "#e8e2d8" }}>
        <div ref={categoryBarRef} className="flex gap-1 px-4 py-2.5 overflow-x-auto scrollbar-thin">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="flex-shrink-0 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all"
              style={activeCategory === cat.id
                ? { background: "#1a1210", color: "#fff" }
                : { background: "transparent", color: "#8c7e6a" }
              }
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ MENÚ ═══ */}
      <div className="px-4 pt-4 pb-6">
        {menuLoading ? (
          <div className="space-y-6">
            {[1, 2].map((sec) => (
              <div key={sec}>
                <div className="h-4 w-28 rounded-full mb-3 mx-1 animate-pulse" style={{ background: "#e8e2d8" }} />
                <div className="space-y-2.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: "#fff", border: "1px solid #e8e2d8" }}>
                      <div className="h-16 w-16 rounded-xl flex-shrink-0 animate-pulse" style={{ background: "#e8e2d8" }} />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-3/4 rounded-full animate-pulse" style={{ background: "#e8e2d8" }} />
                        <div className="h-3 w-1/2 rounded-full animate-pulse" style={{ background: "#f0ebe3" }} />
                        <div className="h-4 w-16 rounded-full animate-pulse" style={{ background: "#e8e2d8" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : activeCategory === "all" ? (
          <>
          {newItems.length > 0 && (
            <div className="mb-6">
              <h2 className="text-[13px] font-bold uppercase tracking-wide mb-3 px-1 flex items-center gap-1.5" style={{ color: "#d97706" }}>
                <Sparkles className="h-3.5 w-3.5" />
                Prueba nuestro nuevo producto
              </h2>
              <div className="space-y-2.5">
                {newItems.map((item) => (
                  <MenuCard key={`new-${item.id}`} item={item} qty={getItemQty(item.id)} onAdd={addToCart} onRemove={removeFromCart} onImageClick={setDetailItem} onBuildCustom={openBuildCustom} />
                ))}
              </div>
            </div>
          )}
          {categories.filter((c) => c.id !== "all").map((cat) => {
            const catItems = menuItems.filter((i) => i.category === cat.id)
            if (catItems.length === 0) return null
            return (
              <div key={cat.id} className="mb-6">
                <h2 className="text-[13px] font-bold uppercase tracking-wide mb-3 px-1" style={{ color: "#1a1210" }}>{cat.name}</h2>
                <div className="space-y-2.5">
                  {catItems.map((item) => (
                    <MenuCard key={item.id} item={item} qty={getItemQty(item.id)} onAdd={addToCart} onRemove={removeFromCart} onImageClick={setDetailItem} onBuildCustom={openBuildCustom} />
                  ))}
                </div>
              </div>
            )
          })}
          </>
        ) : (
          <div className="space-y-2.5">
            {filteredItems.map((item) => (
              <MenuCard key={item.id} item={item} qty={getItemQty(item.id)} onAdd={addToCart} onRemove={removeFromCart} onImageClick={setDetailItem} onBuildCustom={openBuildCustom} />
            ))}
          </div>
        )}

        {filteredItems.length === 0 && activeCategory !== "all" && (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="text-3xl mb-3">🍣</span>
            <p className="text-sm" style={{ color: "#8c7e6a" }}>No hay productos en esta categoría</p>
          </div>
        )}

        {filteredItems.length === 0 && activeCategory === "all" && (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="text-4xl mb-4">🍱</span>
            <p className="text-base font-semibold mb-1" style={{ color: "#1a1210" }}>Menú en preparación</p>
            <p className="text-sm text-center max-w-[260px]" style={{ color: "#8c7e6a" }}>Estamos actualizando nuestro menú. Vuelve pronto para ver nuestros platos disponibles.</p>
          </div>
        )}
      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="px-6 py-6 text-center border-t" style={{ borderColor: "#e8e2d8" }}>
        <p className="text-[11px]" style={{ color: "#b5a898" }}>{businessName} &copy; {new Date().getFullYear()}</p>
      </div>

      {/* ═══ MODAL DETALLE PRODUCTO ═══ */}
      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6 animate-in fade-in duration-200"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setDetailItem(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 fade-in duration-300"
            style={{ background: "#fff" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full aspect-square">
              <Image src={optimizeCloudinaryUrl(detailItem.image, 400)} alt={detailItem.name} fill className="object-cover" sizes="400px" />
              <button
                onClick={() => setDetailItem(null)}
                className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <h3 className="text-lg font-bold" style={{ color: "#1a1210" }}>{detailItem.name}</h3>
              {detailItem.description && (
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "#8c7e6a" }}>{detailItem.description}</p>
              )}
              <p className="text-lg font-black mt-3" style={{ color: "#c1272d" }}>$ {detailItem.price.toLocaleString("es-CL")}</p>
              <div className="flex items-center gap-2 mt-4">
                {getItemQty(detailItem.id) > 0 ? (
                  <div className="flex items-center gap-3 flex-1">
                    <button onClick={() => removeFromCart(detailItem.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border transition-all"
                      style={{ borderColor: "#e8e2d8", color: "#8c7e6a" }}>
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-lg font-bold flex-1 text-center" style={{ color: "#1a1210" }}>{getItemQty(detailItem.id)}</span>
                    <button onClick={() => addToCart(detailItem)}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-all"
                      style={{ background: "#c1272d" }}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => addToCart(detailItem)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-[0.98]"
                    style={{ background: "#c1272d" }}>
                    <Plus className="h-4 w-4" />
                    Agregar al pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL PERSONALIZACIÓN ═══ */}
      {customizeItem && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center animate-in fade-in duration-200"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setCustomizeItem(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-300"
            style={{ background: "#fff" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: "#f0ebe3" }}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold" style={{ color: "#1a1210" }}>Personalizar</h3>
                <button onClick={() => setCustomizeItem(null)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5" style={{ color: "#8c7e6a" }}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm font-semibold mt-1" style={{ color: "#1a1210" }}>{customizeItem.name}</p>
              {customizeItem.description && (
                <p className="text-[11px] mt-0.5" style={{ color: "#8c7e6a" }}>{customizeItem.description}</p>
              )}
            </div>

            {/* Options */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Elección por unidad */}
              {isPerUnit && (
                <div className="space-y-4">
                  <div className="rounded-xl px-3 py-2.5" style={{ background: "#f0f7ff", border: "1px solid #bfdbfe" }}>
                    <p className="text-[11px] font-medium" style={{ color: "#1e40af" }}>
                      Elige una opción para cada uno de tus {customizeItem.choice_count} handrolls
                    </p>
                  </div>
                  {unitChoices.map((choice, idx) => {
                    const options = [
                      ...(customizeItem.protein_options || []),
                      ...(customizeItem.wrapper_options || []),
                    ]
                    return (
                      <div key={idx}>
                        <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#8c7e6a" }}>
                          Handroll {idx + 1}
                        </p>
                        <div className="space-y-1.5">
                          {options.map((opt) => {
                            const isSelected = choice?.name === opt.name
                            return (
                              <button
                                key={opt.name}
                                onClick={() => setUnitChoices(prev => prev.map((c, i) => i === idx ? opt : c))}
                                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 transition-all text-left"
                                style={{
                                  borderColor: isSelected ? "#c1272d" : "#f0ebe3",
                                  background: isSelected ? "#fff5f5" : "#fff",
                                }}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: isSelected ? "#c1272d" : "#d0c8bc" }}>
                                    {isSelected && <div className="w-2 h-2 rounded-full" style={{ background: "#c1272d" }} />}
                                  </div>
                                  <span className="text-sm font-medium capitalize" style={{ color: "#1a1210" }}>{opt.name}</span>
                                </div>
                                <span className="text-xs font-semibold" style={{ color: opt.price > 0 ? "#c1272d" : "#2e7d32" }}>
                                  {opt.price > 0 ? `+$${opt.price.toLocaleString("es-CL")}` : "Base"}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  {customTriedConfirm && !perUnitComplete && (
                    <p className="text-[10px] font-semibold" style={{ color: "#c1272d" }}>
                      Debes elegir una opción para cada handroll
                    </p>
                  )}
                </div>
              )}

              {/* Proteína */}
              {!isPerUnit && customizeItem.protein_options && customizeItem.protein_options.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#8c7e6a" }}><span className="inline-flex items-center gap-1"><Beef className="h-3 w-3" /> Proteína</span> <span className="text-[9px] font-medium" style={{ color: "#b5a898" }}>(opcional)</span></p>
                  <div className="space-y-1.5">
                    {customizeItem.protein_options.map((opt) => {
                      const isSelected = customProtein?.name === opt.name
                      return (
                        <button
                          key={opt.name}
                          onClick={() => setCustomProtein(customProtein?.name === opt.name ? null : opt)}
                          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 transition-all text-left"
                          style={{
                            borderColor: isSelected ? "#c1272d" : "#f0ebe3",
                            background: isSelected ? "#fff5f5" : "#fff",
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: isSelected ? "#c1272d" : "#d0c8bc" }}>
                              {isSelected && <div className="w-2 h-2 rounded-full" style={{ background: "#c1272d" }} />}
                            </div>
                            <span className="text-sm font-medium capitalize" style={{ color: "#1a1210" }}>{opt.name}</span>
                          </div>
                          <span className="text-xs font-semibold" style={{ color: opt.price > 0 ? "#c1272d" : "#2e7d32" }}>
                            {opt.price > 0 ? `+$${opt.price.toLocaleString("es-CL")}` : "Base"}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Envoltura */}
              {!isPerUnit && customizeItem.wrapper_options && customizeItem.wrapper_options.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#8c7e6a" }}><span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> Envoltura</span> <span className="text-[9px] font-medium" style={{ color: "#b5a898" }}>(opcional)</span></p>
                  <div className="space-y-1.5">
                    {customizeItem.wrapper_options.map((opt) => {
                      const isSelected = customWrapper?.name === opt.name
                      return (
                        <button
                          key={opt.name}
                          onClick={() => setCustomWrapper(customWrapper?.name === opt.name ? null : opt)}
                          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 transition-all text-left"
                          style={{
                            borderColor: isSelected ? "#c1272d" : "#f0ebe3",
                            background: isSelected ? "#fff5f5" : "#fff",
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: isSelected ? "#c1272d" : "#d0c8bc" }}>
                              {isSelected && <div className="w-2 h-2 rounded-full" style={{ background: "#c1272d" }} />}
                            </div>
                            <span className="text-sm font-medium capitalize" style={{ color: "#1a1210" }}>{opt.name}</span>
                          </div>
                          <span className="text-xs font-semibold" style={{ color: opt.price > 0 ? "#c1272d" : "#2e7d32" }}>
                            {opt.price > 0 ? `+$${opt.price.toLocaleString("es-CL")}` : "Base"}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Instrucciones obligatorias si hay cambio */}
            {hasCustomChange && (
              <div className="px-5 pb-1">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MessageSquare className="h-3 w-3" style={{ color: customTriedConfirm && !customInstructions.trim() ? "#c1272d" : "#c1272d" }} />
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: customTriedConfirm && !customInstructions.trim() ? "#c1272d" : "#8c7e6a" }}>
                    Instrucciones *
                  </span>
                </div>
                <textarea
                  value={customInstructions}
                  onChange={(e) => { setCustomInstructions(e.target.value); setCustomTriedConfirm(false) }}
                  placeholder="Indica la cantidad de piezas que requieren el cambio. Ej: 5 piezas con camarón, 5 con pollo"
                  rows={3}
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs resize-none focus:outline-none border-2 transition-all"
                  style={{
                    background: "#faf7f2",
                    borderColor: customTriedConfirm && !customInstructions.trim() ? "#c1272d" : "#e8e2d8",
                    color: "#1a1210",
                  }}
                />
                {customTriedConfirm && !customInstructions.trim() && (
                  <p className="text-[10px] font-semibold mt-1" style={{ color: "#c1272d" }}>
                    Debes indicar la cantidad de piezas que requieren cambio
                  </p>
                )}
              </div>
            )}

            {/* Footer con precio y botón confirmar */}
            <div className="px-5 py-4 border-t space-y-3" style={{ borderColor: "#f0ebe3" }}>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "#8c7e6a" }}>Total</span>
                <div className="text-right">
                  <span className="text-xl font-black" style={{ color: "#1a1210" }}>
                    $ {(customizeItem.price + (customProtein?.price || 0) + (customWrapper?.price || 0)).toLocaleString("es-CL")}
                  </span>
                  {((customProtein?.price || 0) + (customWrapper?.price || 0)) > 0 && (
                    <p className="text-[10px]" style={{ color: "#8c7e6a" }}>
                      Base ${customizeItem.price.toLocaleString("es-CL")} + extras ${((customProtein?.price || 0) + (customWrapper?.price || 0)).toLocaleString("es-CL")}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={confirmCustomization}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98]"
                style={{ background: "#c1272d" }}
              >
                <Plus className="h-4 w-4" />
                Agregar al pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL ÁRMALO A TU PINTA ═══ */}
      {buildItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center animate-in fade-in duration-200"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setBuildItem(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl overflow-hidden animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[80vh]"
            style={{ background: "#fff" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                    <Palette className="h-4 w-4" style={{ color: "#d97706" }} />
                  </div>
                  <h3 className="text-base font-bold" style={{ color: "#1a1210" }}>Ármalo a tu pinta</h3>
                </div>
                <button
                  onClick={() => setBuildItem(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                  style={{ background: "#f5f0e8", color: "#8c7e6a" }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs" style={{ color: "#8c7e6a" }}>
                Producto base: <span className="font-semibold" style={{ color: "#1a1210" }}>{buildItem.name}</span> · Precio ref. ${buildItem.price.toLocaleString("es-CL")}
              </p>
              <div className="mt-2 rounded-lg px-3 py-2" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                <p className="text-[10px] font-medium" style={{ color: "#92400e" }}>
                  Cualquier cambio o modificación tiene un valor extra que se verá reflejado en el total de tu pedido. El precio final será confirmado por el vendedor. ¡Esperamos tu confirmación!
                </p>
              </div>
            </div>

            {/* Textarea */}
            <div className="px-5 pb-2 flex-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <MessageSquare className="h-3 w-3" style={{ color: buildTriedConfirm && !buildNotes.trim() ? "#c1272d" : "#d97706" }} />
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: buildTriedConfirm && !buildNotes.trim() ? "#c1272d" : "#8c7e6a" }}>
                  Describe cómo lo quieres *
                </span>
              </div>
              <textarea
                value={buildNotes}
                onChange={(e) => { setBuildNotes(e.target.value); setBuildTriedConfirm(false) }}
                placeholder=""
                rows={4}
                className="w-full rounded-xl px-3.5 py-2.5 text-xs resize-none focus:outline-none border-2 transition-all"
                style={{
                  background: "#faf7f2",
                  borderColor: buildTriedConfirm && !buildNotes.trim() ? "#c1272d" : "#e8e2d8",
                  color: "#1a1210",
                }}
              />
              {buildTriedConfirm && !buildNotes.trim() && (
                <p className="text-[10px] font-semibold mt-1" style={{ color: "#c1272d" }}>
                  Debes describir cómo quieres tu producto
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t" style={{ borderColor: "#f0ebe3" }}>
              <button
                onClick={confirmBuildCustom}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98]"
                style={{ background: "#d97706" }}
              >
                <Palette className="h-4 w-4" />
                Agregar a tu pinta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BOTÓN FLOTANTE CARRITO ═══ */}
      {cartCount > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-5 left-4 right-4 z-40 flex items-center justify-between rounded-2xl px-5 py-4 transition-all active:scale-[0.98]"
          style={{ background: "#c1272d", color: "#fff", boxShadow: "0 8px 30px rgba(193,39,45,0.35)" }}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-black" style={{ color: "#c1272d" }}>
                {cartCount}
              </span>
            </div>
            <span className="text-sm font-bold">Ver pedido</span>
          </div>
          <span className="text-sm font-black">$ {cartTotal.toLocaleString("es-CL")}</span>
        </button>
      )}

      {/* ═══ MODAL CHECKOUT ═══ */}
      {showCart && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => { setShowCart(false); setCheckoutStep(0) }}
        >
          <div
            className="w-full max-w-md rounded-t-3xl overflow-hidden max-h-[92vh] flex flex-col"
            style={{ background: "#fff" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0 border-b" style={{ borderColor: "#f0ebe3" }}>
              <div className="flex items-center gap-2.5">
                {checkoutStep > 0 && (
                  <button onClick={() => setCheckoutStep(s => s - 1)} className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/5" style={{ color: "#1a1210" }}>
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                <h3 className="text-base font-bold" style={{ color: "#1a1210" }}>
                  {checkoutStep === 0 ? "Tu pedido" : checkoutStep === 1 ? "Tus datos" : checkoutStep === 2 ? "Entrega" : hasCustomBuild ? "Confirmar" : "Pago"}
                </h3>
              </div>
              <button onClick={() => { setShowCart(false); setCheckoutStep(0) }} className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/5" style={{ color: "#8c7e6a" }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Progress */}
            {checkoutStep > 0 && (
              <div className="px-5 pt-3 flex-shrink-0">
                <div className="flex gap-1.5">
                  {(hasCustomBuild ? [1,2,3] : [1,2,3]).map(s => (
                    <div key={s} className="h-1 flex-1 rounded-full transition-all" style={{ background: s <= checkoutStep ? "#c1272d" : "#f0ebe3" }} />
                  ))}
                </div>
              </div>
            )}

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto px-5 py-4">

              {/* PASO 0: Carrito */}
              {checkoutStep === 0 && (
                <div className="space-y-3">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <ShoppingBag className="h-12 w-12 mb-3" style={{ color: "#e0d8cc" }} />
                      <p className="text-sm font-medium" style={{ color: "#8c7e6a" }}>Tu pedido está vacío</p>
                    </div>
                  ) : (
                    <>
                    {cart.filter(i => !i.id.startsWith("salsa-")).map((item) => {
                      const itemKey = item.cartKey || item.id
                      const unitPrice = getItemUnitPrice(item)
                      return (
                      <div key={itemKey} className="rounded-xl border overflow-hidden" style={{ borderColor: "#f0ebe3" }}>
                        <div className="flex items-center gap-3 p-3">
                          <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
                            {item.image ? (
                              <Image src={optimizeCloudinaryUrl(item.image, 120)} alt={item.name} fill className="object-cover" sizes="56px" loading="lazy" />
                            ) : (
                              <div className="flex items-center justify-center h-full w-full rounded-lg" style={{ background: "#f5f0e8" }}>
                                <Droplets className="h-6 w-6" style={{ color: "#c4b9a8" }} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: "#1a1210" }}>
                              {item.name}
                              {item.customBuild && (
                                <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full" style={{ background: "#fef3cd" }}>
                                  <Palette className="h-2.5 w-2.5" style={{ color: "#92400e" }} />
                                </span>
                              )}
                            </p>
                            {item.customBuild && item.customBuildNotes && (
                              <p className="text-[10px] mt-0.5 italic line-clamp-1" style={{ color: "#d97706" }}>{item.customBuildNotes}</p>
                            )}
                            {(item.selectedProtein || item.selectedWrapper) && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {item.selectedProtein && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#fef3cd", color: "#856404" }}>
                                    {item.selectedProtein.name}{item.selectedProtein.price > 0 ? ` +$${item.selectedProtein.price.toLocaleString("es-CL")}` : ""}
                                  </span>
                                )}
                                {item.selectedWrapper && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#d4edda", color: "#155724" }}>
                                    {item.selectedWrapper.name}{item.selectedWrapper.price > 0 ? ` +$${item.selectedWrapper.price.toLocaleString("es-CL")}` : ""}
                                  </span>
                                )}
                              </div>
                            )}
                            <p className="text-sm font-bold" style={{ color: "#c1272d" }}>$ {(unitPrice * item.quantity).toLocaleString("es-CL")}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => removeFromCart(itemKey)} className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors" style={{ borderColor: "#e8e2d8", color: "#8c7e6a" }}>
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-7 text-center text-sm font-bold" style={{ color: "#1a1210" }}>{item.quantity}</span>
                            <button onClick={() => addToCart(item)} className="flex h-8 w-8 items-center justify-center rounded-full transition-colors text-white" style={{ background: "#c1272d" }}>
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => deleteFromCart(itemKey)} className="flex h-7 w-7 items-center justify-center rounded-full transition-colors ml-0.5" style={{ color: "#ccc0b0" }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Observaciones - items custom: editan customBuildNotes */}
                        {item.customBuild && (
                        <div className="px-3 pb-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Palette className="h-3.5 w-3.5" style={{ color: "#d97706" }} />
                            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#d97706" }}>Tu personalización</span>
                          </div>
                          <textarea
                            value={item.customBuildNotes || ""}
                            onChange={(e) => updateCustomBuildNotes(itemKey, e.target.value)}
                            placeholder="Describe cómo quieres tu producto..."
                            rows={3}
                            className="w-full rounded-lg px-3 py-2 text-xs resize-none focus:outline-none border-2 transition-all"
                            style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#1a1210" }}
                          />
                        </div>
                        )}
                      </div>
                      )
                    })}

                    {/* Salsas adicionales */}
                    {(() => {
                      const totalSalsas = SALSAS.reduce((sum, s) => sum + getItemQty(s.id), 0)
                      const showSalsaError = triedContinue && totalSalsas === 0
                      return (
                    <div className="rounded-xl border-2 overflow-hidden transition-colors" style={{ borderColor: showSalsaError ? "#c1272d" : "#e8e2d8" }}>
                      <div className="px-3 py-2 border-b" style={{ background: showSalsaError ? "#fff5f5" : "#faf7f2", borderColor: showSalsaError ? "#f9c0c0" : "#e8e2d8" }}>
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: showSalsaError ? "#c1272d" : "#8c7e6a" }}><span className="inline-flex items-center gap-1"><Droplets className="h-3 w-3" /> Salsas</span> <span style={{ color: "#c1272d" }}>*</span></p>
                          {showSalsaError && <p className="text-[10px] font-semibold" style={{ color: "#c1272d" }}>⚠ Debes elegir al menos 1 salsa</p>}
                        </div>
                        <p className="text-[10px]" style={{ color: "#b5a898" }}>Soya y Agridulce gratis (máx. {MAX_FREE_SALSAS}) · Acevichada y Teriyaki $500</p>
                      </div>
                      <div className="divide-y divide-[#f0ebe3]">
                        {SALSAS.map((salsa) => {
                          const qty = getItemQty(salsa.id)
                          const isFree = salsa.price === 0
                          const totalFreeSalsas = SALSAS.filter(s => s.price === 0).reduce((sum, s) => sum + getItemQty(s.id), 0)
                          const limitReached = isFree && totalFreeSalsas >= MAX_FREE_SALSAS
                          return (
                            <div key={salsa.id} className="flex items-center justify-between px-3 py-2.5">
                              <div>
                                <span className="text-sm font-medium" style={{ color: "#1a1210" }}>{salsa.name}</span>
                                <span className="text-[10px] ml-1.5" style={{ color: isFree ? "#2e7d32" : "#c1272d" }}>{isFree ? "Gratis" : "$500"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {qty > 0 && (
                                  <>
                                    <button onClick={() => removeFromCart(salsa.id)} className="flex h-7 w-7 items-center justify-center rounded-full border transition-colors" style={{ borderColor: "#e8e2d8", color: "#8c7e6a" }}>
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="w-5 text-center text-sm font-bold" style={{ color: "#1a1210" }}>{qty}</span>
                                  </>
                                )}
                                <button
                                  onClick={() => { if (!limitReached) addToCart(salsa) }}
                                  disabled={limitReached}
                                  className="flex h-7 w-7 items-center justify-center rounded-full text-white transition-all disabled:opacity-40"
                                  style={{ background: "#c1272d" }}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                                {qty > 0 && !isFree && (
                                  <span className="text-xs font-semibold w-16 text-right" style={{ color: "#1a1210" }}>$ {(salsa.price * qty).toLocaleString("es-CL")}</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                      )
                    })()}
                    </>
                  )}
                </div>
              )}

              {/* PASO 1: Tipo de entrega */}
              {checkoutStep === 1 && (
                <div className="space-y-4">
                  <p className="text-xs font-medium" style={{ color: "#8c7e6a" }}>¿Cómo quieres recibir tu pedido?</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { id: "delivery" as DeliveryType, icon: Truck, label: "Delivery", sub: "Envío a domicilio" },
                      { id: "retiro" as DeliveryType, icon: Store, label: "Retiro", sub: "Retiro en local" },
                    ]).map(opt => (
                      <button key={opt.id} onClick={() => setDeliveryType(opt.id)}
                        className="flex flex-col items-center gap-2 rounded-2xl p-5 border transition-all"
                        style={deliveryType === opt.id
                          ? { borderColor: "#c1272d", background: "#fef7f7", color: "#c1272d" }
                          : { borderColor: "#e8e2d8", background: "#fff", color: "#8c7e6a" }
                        }
                      >
                        <opt.icon className="h-6 w-6" />
                        <span className="text-xs font-bold">{opt.label}</span>
                        <span className="text-[10px]" style={{ color: "#b5a898" }}>{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* PASO 2: Datos según tipo de entrega */}
              {checkoutStep === 2 && (
                <div className="space-y-4">
                  {deliveryType === "delivery" ? (
                    <>
                      <div>
                        <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#1a1210" }}>Teléfono / WhatsApp *</label>
                        <input
                          type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                          placeholder="Ej: +56 9 1234 5678"
                          className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none border transition-all focus:border-[#c1272d]"
                          style={{ background: "#faf7f2", borderColor: "#e8e2d8", color: "#1a1210" }}
                        />
                      </div>
                      {deliveryZoneMsg && (
                        <div className="rounded-xl px-4 py-3 flex items-start gap-2.5" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                          <span className="text-base flex-shrink-0">📍</span>
                          <p className="text-xs leading-relaxed" style={{ color: "#9a3412" }}>{deliveryZoneMsg}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#1a1210" }}>Dirección *</label>
                        <textarea value={address} onChange={(e) => setAddress(e.target.value)}
                          placeholder="Calle, número, depto, comuna..."
                          rows={2}
                          className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none border transition-all resize-none focus:border-[#c1272d]"
                          style={{ background: "#faf7f2", borderColor: "#e8e2d8", color: "#1a1210" }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#1a1210" }}>Nombre *</label>
                        <input
                          type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                          placeholder="Ej: Juan Pérez"
                          className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none border transition-all focus:border-[#c1272d]"
                          style={{ background: "#faf7f2", borderColor: "#e8e2d8", color: "#1a1210" }}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#1a1210" }}>Teléfono / WhatsApp *</label>
                        <input
                          type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                          placeholder="Ej: +56 9 1234 5678"
                          className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none border transition-all focus:border-[#c1272d]"
                          style={{ background: "#faf7f2", borderColor: "#e8e2d8", color: "#1a1210" }}
                        />
                      </div>
                      {storeAddress && (
                        <div className="rounded-xl p-4 border" style={{ borderColor: "#e8e2d8", background: "#faf7f2" }}>
                          <p className="text-[11px] font-semibold mb-1" style={{ color: "#8c7e6a" }}>Dirección del local</p>
                          <p className="text-sm flex items-center gap-2" style={{ color: "#1a1210" }}>
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#c1272d" }} />
                            {storeAddress}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* PASO 3: Pago / Confirmación custom build */}
              {checkoutStep === 3 && !orderSent && hasCustomBuild && (
                <div className="space-y-4">
                  {/* Banner informativo */}
                  <div className="rounded-2xl p-5 space-y-3" style={{ background: "#fffbeb", border: "2px solid #fde68a" }}>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                        <Palette className="h-5 w-5" style={{ color: "#d97706" }} />
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "#92400e" }}>Pedido personalizado</p>
                        <p className="text-[11px]" style={{ color: "#a16207" }}>Tu pedido incluye productos "a tu pinta"</p>
                      </div>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: "#fff", border: "1px solid #fde68a" }}>
                      <p className="text-xs leading-relaxed" style={{ color: "#78350f" }}>
                        El vendedor revisará tu pedido, calculará el <strong>precio final</strong> y te lo enviará por <strong>WhatsApp</strong> antes de comenzar a prepararlo.
                      </p>
                    </div>
                  </div>

                  {/* Resumen */}
                  <div className="rounded-xl p-4 space-y-2 border" style={{ borderColor: "#e8e2d8", background: "#faf7f2" }}>
                    <p className="text-[11px] font-semibold" style={{ color: "#8c7e6a" }}>Resumen</p>
                    <div className="space-y-1">
                      {cart.map((c, idx) => (
                        <div key={`${c.cartKey || c.id}-${idx}`} className="flex justify-between text-xs">
                          <span style={{ color: "#8c7e6a" }}>
                            {c.name} x{c.quantity}
                            {c.customBuild && (
                              <span className="ml-1 inline-flex items-center justify-center h-3 w-3 rounded-full" style={{ background: "#fffbeb" }}>
                                <Palette className="h-2 w-2" style={{ color: "#d97706" }} />
                              </span>
                            )}
                          </span>
                          <span className="font-medium" style={{ color: c.customBuild ? "#d97706" : "#1a1210" }}>
                            {c.customBuild ? "Por cotizar" : `$ ${(getItemUnitPrice(c) * c.quantity).toLocaleString("es-CL")}`}
                          </span>
                        </div>
                      ))}
                    </div>
                    {cart.some(c => c.customBuild && c.customBuildNotes) && (
                      <div className="pt-2 border-t space-y-1" style={{ borderColor: "#e8e2d8" }}>
                        <p className="text-[10px] font-semibold" style={{ color: "#d97706" }}>Notas de personalización:</p>
                        {cart.filter(c => c.customBuild && c.customBuildNotes).map((c, idx) => (
                          <p key={idx} className="text-[10px] italic" style={{ color: "#92400e" }}>• {c.name}: {c.customBuildNotes}</p>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t" style={{ borderColor: "#e8e2d8" }}>
                      <span className="text-sm font-bold" style={{ color: "#1a1210" }}>Precio referencial</span>
                      <span className="text-sm font-black" style={{ color: "#d97706" }}>$ {cartTotal.toLocaleString("es-CL")}</span>
                    </div>
                    <p className="text-[10px] text-center" style={{ color: "#a16207" }}>
                      El precio final puede variar según tu personalización
                    </p>
                  </div>
                </div>
              )}

              {checkoutStep === 3 && !orderSent && !hasCustomBuild && (
                <div className="space-y-4">
                  <p className="text-xs font-medium" style={{ color: "#8c7e6a" }}>¿Cómo vas a pagar?</p>
                  <div className={`grid ${cardPaymentsEnabled ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
                    {([
                      { id: "efectivo" as PaymentMethod, icon: Banknote, label: "Efectivo" },
                      { id: "transferencia" as PaymentMethod, icon: ArrowRightLeft, label: "Transfer." },
                      ...(cardPaymentsEnabled ? [{ id: "tarjeta" as PaymentMethod, icon: CreditCard, label: "Tarjeta" }] : []),
                    ]).map(pm => (
                      <button key={pm.id} onClick={() => { setPaymentMethod(pm.id); if (pm.id !== "tarjeta") setCardType(null) }}
                        className="flex flex-col items-center gap-1.5 rounded-xl p-3.5 border transition-all"
                        style={paymentMethod === pm.id
                          ? { borderColor: "#c1272d", background: "#fef7f7", color: "#c1272d" }
                          : { borderColor: "#e8e2d8", background: "#fff", color: "#8c7e6a" }
                        }
                      >
                        <pm.icon className="h-5 w-5" />
                        <span className="text-[10px] font-bold">{pm.label}</span>
                      </button>
                    ))}
                  </div>

                  {paymentMethod === "efectivo" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#1a1210" }}>¿Con cuánto pagas?</label>
                        <input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)}
                          placeholder={`Mínimo $${cartTotal.toLocaleString("es-CL")}`}
                          className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none border transition-all focus:border-[#c1272d]"
                          style={{ background: "#faf7f2", borderColor: "#e8e2d8", color: "#1a1210" }}
                        />
                      </div>
                      {cashNum >= cartTotal && cashNum > 0 && (
                        <div className="rounded-xl p-3 text-center" style={{ background: "#f0faf0", border: "1px solid #d4edda" }}>
                          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#6abf69" }}>Tu vuelto</p>
                          <p className="text-xl font-black" style={{ color: "#2e7d32" }}>$ {changeAmount.toLocaleString("es-CL")}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {paymentMethod === "transferencia" && (
                    <div className="space-y-3">
                      {/* Datos bancarios */}
                      <div className="rounded-xl p-4 space-y-2 border" style={{ borderColor: "#e8e2d8", background: "#faf7f2" }}>
                        <p className="text-[11px] font-semibold mb-2" style={{ color: "#8c7e6a" }}>Datos para transferir</p>
                        {bankData.banco ? (
                          <>
                            <div className="space-y-1 text-sm" style={{ color: "#1a1210" }}>
                              <p><span className="text-xs" style={{ color: "#8c7e6a" }}>Banco:</span> {bankData.banco}</p>
                              <p><span className="text-xs" style={{ color: "#8c7e6a" }}>Tipo:</span> {bankData.tipoCuenta}</p>
                              <p><span className="text-xs" style={{ color: "#8c7e6a" }}>N° Cuenta:</span> {bankData.numeroCuenta}</p>
                              <p><span className="text-xs" style={{ color: "#8c7e6a" }}>RUT:</span> {bankData.rut}</p>
                              <p><span className="text-xs" style={{ color: "#8c7e6a" }}>Titular:</span> {bankData.titular}</p>
                            </div>
                            <div className="pt-2 border-t" style={{ borderColor: "#e8e2d8" }}>
                              <p className="text-sm font-bold" style={{ color: "#c1272d" }}>Total: $ {cartTotal.toLocaleString("es-CL")}</p>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-2">
                            <p className="text-sm" style={{ color: "#8c7e6a" }}>Los datos bancarios aún no están configurados.</p>
                            <p className="text-xs mt-1" style={{ color: "#b5a898" }}>Contacta al local para obtener los datos de transferencia.</p>
                          </div>
                        )}
                      </div>

                      {/* Subir comprobante */}
                      <div className="rounded-xl p-4 border space-y-3" style={{ borderColor: "#e8e2d8", background: "#fff" }}>
                        <p className="text-[11px] font-semibold" style={{ color: "#8c7e6a" }}>Sube tu comprobante de transferencia *</p>
                        <input
                          ref={receiptInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptUpload}
                          className="hidden"
                        />

                        {receiptPreview ? (
                          <div className="space-y-2">
                            <div className="relative rounded-lg overflow-hidden border" style={{ borderColor: "#e8e2d8" }}>
                              <img src={receiptPreview} alt="Comprobante" className="w-full max-h-48 object-contain bg-gray-50" />
                              <button
                                onClick={() => { setReceiptFile(null); setReceiptPreview(""); setReceiptUrl(""); setReceiptError("") }}
                                className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#2e7d32" }} />
                              <span className="text-[11px] font-medium" style={{ color: "#2e7d32" }}>Comprobante cargado</span>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => receiptInputRef.current?.click()}
                            className="w-full flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-6 transition-all active:scale-[0.98]"
                            style={{ borderColor: "#d4cfc7", color: "#8c7e6a" }}
                          >
                            <Upload className="h-7 w-7" />
                            <span className="text-xs font-semibold">Toca para subir imagen</span>
                            <span className="text-[10px]" style={{ color: "#b5a898" }}>JPG, PNG o captura de pantalla</span>
                          </button>
                        )}

                        {receiptError && (
                          <p className="text-[11px] text-center" style={{ color: "#c1272d" }}>{receiptError}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {paymentMethod === "tarjeta" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setCardType("debito")} disabled={deliveryType === "delivery" && debitBlocked}
                          className="rounded-xl p-3 border text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          style={cardType === "debito"
                            ? { borderColor: "#c1272d", background: "#fef7f7", color: "#c1272d" }
                            : { borderColor: "#e8e2d8", background: "#fff", color: "#8c7e6a" }
                          }
                        >
                          Débito
                        </button>
                        <button onClick={() => setCardType("credito")}
                          className="rounded-xl p-3 border text-xs font-bold transition-all"
                          style={cardType === "credito"
                            ? { borderColor: "#c1272d", background: "#fef7f7", color: "#c1272d" }
                            : { borderColor: "#e8e2d8", background: "#fff", color: "#8c7e6a" }
                          }
                        >
                          Crédito
                        </button>
                      </div>
                      {deliveryType === "delivery" && debitBlocked && (
                        <div className="rounded-xl p-3 text-center border" style={{ borderColor: "#fde68a", background: "#fef3cd" }}>
                          <p className="text-xs font-semibold" style={{ color: "#92400e" }}>Débito detenido por el momento por problemas técnicos. Crédito activo.</p>
                        </div>
                      )}
                      <div className="rounded-xl p-4 text-center border" style={{ borderColor: "#e8e2d8", background: "#faf7f2" }}>
                        <CreditCard className="h-8 w-8 mx-auto mb-2" style={{ color: "#b5a898" }} />
                        <p className="text-sm" style={{ color: "#1a1210" }}>Pago con tarjeta al momento de la entrega</p>
                      </div>
                    </div>
                  )}

                  {/* Resumen */}
                  <div className="rounded-xl p-4 space-y-2 border" style={{ borderColor: "#e8e2d8", background: "#faf7f2" }}>
                    <p className="text-[11px] font-semibold" style={{ color: "#8c7e6a" }}>Resumen</p>
                    <div className="space-y-1">
                      {cart.map(c => (
                        <div key={c.id} className="flex justify-between text-xs">
                          <span style={{ color: "#8c7e6a" }}>{c.name} x{c.quantity}</span>
                          <span className="font-medium" style={{ color: "#1a1210" }}>$ {(c.price * c.quantity).toLocaleString("es-CL")}</span>
                        </div>
                      ))}
                    </div>
                    {deliveryCost > 0 && (
                      <div className="flex justify-between text-xs pt-1 border-t" style={{ borderColor: "#e8e2d8" }}>
                        <span style={{ color: "#8c7e6a" }}>Subtotal</span>
                        <span className="font-medium" style={{ color: "#1a1210" }}>$ {cartSubtotal.toLocaleString("es-CL")}</span>
                      </div>
                    )}
                    {deliveryCost > 0 && (
                      <div className="flex justify-between text-xs">
                        <span style={{ color: "#8c7e6a" }}>Delivery</span>
                        <span className="font-medium" style={{ color: "#1a1210" }}>$ {deliveryCost.toLocaleString("es-CL")}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t" style={{ borderColor: "#e8e2d8" }}>
                      <span className="text-sm font-bold" style={{ color: "#1a1210" }}>Total</span>
                      <span className="text-sm font-black" style={{ color: "#c1272d" }}>$ {cartTotal.toLocaleString("es-CL")}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Enviado (placeholder, el modal real se muestra fuera del drawer) */}
            </div>

            {/* Footer checkout */}
            {cart.length > 0 && !orderSent && (
              <div className="px-5 py-4 flex-shrink-0 space-y-3 border-t" style={{ borderColor: "#f0ebe3" }}>
                {deliveryCost > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "#8c7e6a" }}>Subtotal: $ {cartSubtotal.toLocaleString("es-CL")} + Delivery: $ {deliveryCost.toLocaleString("es-CL")}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#8c7e6a" }}>{hasCustomBuild && checkoutStep === 3 ? "Precio ref." : "Total"}</span>
                  <span className="text-xl font-black" style={{ color: hasCustomBuild && checkoutStep === 3 ? "#d97706" : "#1a1210" }}>$ {cartTotal.toLocaleString("es-CL")}</span>
                </div>

                {/* Aceptación de retraso por alta demanda */}
                {highDemandMsg && checkoutStep === 3 && !acceptedDelay && (
                  <label className="flex items-start gap-2.5 rounded-xl p-3 cursor-pointer" style={{ background: "#fef3cd", border: "1px solid #fde68a" }}>
                    <input
                      type="checkbox"
                      checked={acceptedDelay}
                      onChange={(e) => setAcceptedDelay(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded accent-amber-600 flex-shrink-0"
                    />
                    <span className="text-xs font-medium" style={{ color: "#92400e" }}>
                      Entiendo que hay alta demanda y mi pedido podría tener un tiempo de espera mayor al habitual.
                    </span>
                  </label>
                )}

                {checkoutStep < 3 ? (
                  <button
                    onClick={() => {
                      if (checkoutStep === 0) {
                        const totalSalsas = SALSAS.reduce((sum, s) => sum + getItemQty(s.id), 0)
                        if (totalSalsas === 0) { setTriedContinue(true); return }
                      }
                      setCheckoutStep(s => s + 1)
                    }}
                    disabled={
                      (checkoutStep === 2 && deliveryType === "delivery" && (!clientPhone.trim() || !address.trim())) ||
                      (checkoutStep === 2 && deliveryType === "retiro" && (!clientName.trim() || !clientPhone.trim()))
                    }
                    className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "#1a1210" }}
                  >
                    {checkoutStep === 0 ? "Continuar" : "Siguiente"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : hasCustomBuild ? (
                  <button
                    onClick={handleSubmitOrder}
                    disabled={!canSubmit() || submittingOrder || !!(highDemandMsg && !acceptedDelay)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "#d97706" }}
                  >
                    {submittingOrder ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>🎨 Enviar pedido personalizado</>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitOrder}
                    disabled={!canSubmit() || uploadingReceipt || submittingOrder || !!(highDemandMsg && !acceptedDelay)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "#1a1210" }}
                  >
                    {uploadingReceipt ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Subiendo comprobante...
                      </>
                    ) : submittingOrder ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Enviando pedido...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        Confirmar Pedido
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ MODAL PEDIDO RECIBIDO ═══ */}
      {orderSent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "#faf7f2" }}>
          <div className="flex flex-col items-center justify-center px-8 text-center" style={{ animation: "fadeInUp 0.6s ease-out" }}>
            {/* Logo con animación */}
            <div className="relative mb-8" style={{ animation: "logoPulse 2s ease-in-out infinite" }}>
              <div className="relative h-28 w-28 rounded-3xl overflow-hidden shadow-xl" style={{ background: "#1a1210" }}>
                {logo ? (
                  <Image src={logo} alt="Logo" fill className="object-contain p-3" sizes="112px" />
                ) : (
                  <div className="flex items-center justify-center h-full w-full text-4xl">🍣</div>
                )}
              </div>
              {/* Círculo de éxito */}
              <div
                className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full shadow-lg"
                style={{ background: "#22c55e", animation: "popIn 0.4s ease-out 0.3s both" }}
              >
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
            </div>

            {/* Texto principal */}
            <h2 className="text-2xl font-black mb-2" style={{ color: "#1a1210", animation: "fadeInUp 0.6s ease-out 0.2s both" }}>
              ¡Pedido recibido!
            </h2>
            <p className="text-sm leading-relaxed max-w-xs mb-6" style={{ color: "#8c7e6a", animation: "fadeInUp 0.6s ease-out 0.4s both" }}>
              {hasCustomBuild
                ? "Tu pedido personalizado ya está en manos del local. Te enviaremos el precio final por WhatsApp."
                : "Tu pedido ya está en manos del local. ¡Lo estamos preparando con mucho cariño!"
              }
            </p>

            {/* Barra de progreso */}
            <div className="w-48 h-1 rounded-full overflow-hidden" style={{ background: "#e8e2d8" }}>
              <div className="h-full rounded-full" style={{ background: "#c1272d", animation: "progressBar 4.5s linear forwards" }} />
            </div>
            <p className="text-[10px] mt-2" style={{ color: "#b5a898", animation: "fadeInUp 0.6s ease-out 0.6s both" }}>
              {businessName}
            </p>
          </div>

          <style jsx>{`
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(24px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes logoPulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.05); }
            }
            @keyframes popIn {
              from { opacity: 0; transform: scale(0); }
              to { opacity: 1; transform: scale(1); }
            }
            @keyframes progressBar {
              from { width: 0%; }
              to { width: 100%; }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}

// ═══ TARJETA DE PRODUCTO — horizontal, legible, mobile-first ═══
function MenuCard({ item, qty, onAdd, onRemove, onImageClick, onBuildCustom }: { item: MenuItem; qty: number; onAdd: (item: MenuItem) => void; onRemove: (id: string) => void; onImageClick: (item: MenuItem) => void; onBuildCustom?: (item: MenuItem) => void }) {
  return (
    <div className="flex gap-3 rounded-xl p-2.5 transition-all" style={{ background: "#fff", border: qty > 0 ? "1.5px solid #c1272d" : "1px solid #f0ebe3" }}>
      {/* Imagen */}
      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg cursor-pointer" onClick={() => onImageClick(item)}>
        <Image src={optimizeCloudinaryUrl(item.image, 200)} alt={item.name} fill className="object-cover" sizes="96px" loading="lazy" />
        {isNewProduct(item.created_at) && (
          <div className="absolute top-1 left-1 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white shadow-sm animate-pulse" style={{ background: "#f59e0b" }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            Nuevo
          </div>
        )}
        {qty > 0 && (
          <div className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white" style={{ background: "#c1272d" }}>
            {qty}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <p className="text-[13px] font-semibold leading-tight" style={{ color: "#1a1210" }}>{item.name}</p>
          {isNewProduct(item.created_at) && (
            <p className="text-[10px] font-bold mt-0.5" style={{ color: "#d97706" }}>Prueba nuestro nuevo producto</p>
          )}
          {item.description && (
            <p className="text-[11px] leading-snug mt-0.5 line-clamp-2" style={{ color: "#8c7e6a" }}>{item.description}</p>
          )}
          <p className="text-[15px] font-bold mt-1" style={{ color: "#c1272d" }}>$ {item.price.toLocaleString("es-CL")}</p>
        </div>

        {/* Controles */}
        <div className="flex items-center justify-end gap-2 mt-1">
          {item.allow_custom_build && onBuildCustom && (
            <button onClick={() => onBuildCustom(item)}
              className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-bold transition-all border"
              style={{ borderColor: "#f59e0b", color: "#d97706", background: "#fffbeb" }}>
              <Palette className="h-3 w-3" />
              A tu pinta
            </button>
          )}
          {qty > 0 ? (
            <div className="flex items-center gap-2">
              <button onClick={() => onRemove(item.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full border transition-all"
                style={{ borderColor: "#e8e2d8", color: "#8c7e6a" }}>
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-5 text-center text-sm font-bold" style={{ color: "#1a1210" }}>{qty}</span>
              <button onClick={() => onAdd(item)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-all"
                style={{ background: "#c1272d" }}>
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => onAdd(item)}
              className="flex h-8 w-8 items-center justify-center rounded-full border transition-all"
              style={{ borderColor: "#c1272d", color: "#c1272d" }}>
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
