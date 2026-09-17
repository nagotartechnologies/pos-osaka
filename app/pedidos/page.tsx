"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ClipboardList,
  ChefHat,
  Truck,
  CheckCircle2,
  Phone,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  Clock,
  ChevronRight,
  Trash2,
  MessageCircle,
  User,
  Store,
  XCircle,
  Eye,
  ShieldCheck,
  ShieldX,
  X,
  Printer,
  FileDown,
  Send,
  Plus,
  Pencil,
  Palette,
  DollarSign,
  Calendar,
  Flame,
  Ban,
  Tag,
} from "lucide-react"
import {
  subscribeToOrders,
  refreshOrders,
  applyLocalOrderChange,
  updateOrderStatus,
  updatePaymentStatus,
  updateOrderReceiptUrl,
  deleteOrder,
  clearDelivered,
  getTodayOrders,
  getOrdersByDate,
  getOrdersByDateRange,
  quoteOrderItems,
  updateOrderDiscount,
  type SupabaseOrder,
  type OrderStatus,
  type OrderItem,
} from "@/lib/supabase-orders"
import { loadWhatsApp, loadBusinessName, loadLogo, loadAddress } from "@/lib/config-store"
import { getAllConfig, getLogoConfig, setConfigValue } from "@/lib/supabase-config"
import { notifyOrderCancelled } from "@/lib/notifications"
import { downloadOrderReceipt, shareReceiptWhatsApp, downloadKitchenOrder, downloadDailyClosingComanda, type PaperWidth } from "@/lib/receipt-pdf"
import { deleteCloudinaryImage } from "@/lib/cloudinary"
import { getUnreadCounts, subscribeToChatMessages, getActiveConversations, deleteMessagesByOrder, deleteMessagesByPhone, type ChatMessage, type ChatConversation } from "@/lib/supabase-chat"
import dynamic from "next/dynamic"
const POSModal = dynamic(() => import("@/components/pos-modal").then(m => m.POSModal), { ssr: false })
const EditOrderModal = dynamic(() => import("@/components/edit-order-modal").then(m => m.EditOrderModal), { ssr: false })
import { ConfirmModal } from "@/components/confirm-modal"
import { ToastContainer, createToast, type ToastData } from "@/components/toast"
import { useNotificationSound } from "@/hooks/use-notification-sound"
import { useWhatsAppActions } from "@/hooks/use-whatsapp-actions"

interface PromoBanner {
  id: string
  text: string
  color: "red" | "green"
}

const COLUMNS: { id: OrderStatus; label: string; icon: typeof ClipboardList; color: string; bg: string; border: string; action: string }[] = [
  { id: "recibido",   label: "Recibido",   icon: ClipboardList, color: "text-blue-500",   bg: "bg-blue-500/10 border-blue-500/20",    border: "border-l-blue-500",   action: "Preparar" },
  { id: "cotizado",   label: "Cotizado",   icon: DollarSign,    color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/20", border: "border-l-orange-500", action: "Confirmar" },
  { id: "preparando", label: "Preparando", icon: ChefHat,       color: "text-amber-500",  bg: "bg-amber-500/10 border-amber-500/20",   border: "border-l-amber-500",  action: "Listo / Enviar" },
  { id: "en-camino",  label: "En Camino",  icon: Truck,         color: "text-purple-500", bg: "bg-purple-500/10 border-purple-500/20", border: "border-l-purple-500", action: "Entregado" },
  { id: "entregado",  label: "Entregado",  icon: CheckCircle2,  color: "text-emerald-500",bg: "bg-emerald-500/10 border-emerald-500/20",border: "border-l-emerald-500",action: "" },
  { id: "cancelado",  label: "Cancelado",  icon: XCircle,       color: "text-red-500",    bg: "bg-red-500/10 border-red-500/20",       border: "border-l-red-500",    action: "" },
]

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Ahora"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<SupabaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [storeWhatsApp, setStoreWhatsApp] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [statusMsgs, setStatusMsgs] = useState<Record<string, string>>({})
  const [logoUrl, setLogoUrl] = useState("")
  const [storeAddress, setStoreAddress] = useState("")
  const [paperWidth, setPaperWidth] = useState<PaperWidth>("75mm")
  const [receiptModal, setReceiptModal] = useState<SupabaseOrder | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<SupabaseOrder | null>(null)
  const [showPOS, setShowPOS] = useState(false)
  const [activeTab, setActiveTab] = useState<OrderStatus | "todos">("todos")
  const router = useRouter()
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [cartaCode, setCartaCode] = useState("")
  const [editingOrder, setEditingOrder] = useState<SupabaseOrder | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<SupabaseOrder | null>(null)
  const [downloadedComandas, setDownloadedComandas] = useState<Set<string>>(new Set())
  const [downloadedRecibos, setDownloadedRecibos] = useState<Set<string>>(new Set())
  const [redownloadConfirm, setRedownloadConfirm] = useState<{ orderId: string; type: "comanda" | "recibo" } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearChatsConfirm, setClearChatsConfirm] = useState(false)
  const [downloadingCierre, setDownloadingCierre] = useState(false)
  const [cierreDateModal, setCierreDateModal] = useState(false)
  const [selectedCierreDate, setSelectedCierreDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [discountModal, setDiscountModal] = useState<SupabaseOrder | null>(null)
  const [discountAmount, setDiscountAmount] = useState<string>("")
  const [rejectConfirm, setRejectConfirm] = useState<SupabaseOrder | null>(null)
  const [posOpen, setPosOpen] = useState(false)
  const [posInitialClient, setPosInitialClient] = useState<{ name: string; phone: string } | null>(null)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [toasts, setToasts] = useState<ToastData[]>([])
  const [dayOpen, setDayOpen] = useState(false)
  const [bizDayStart, setBizDayStart] = useState<string>("")
  const [bizDayClose, setBizDayClose] = useState<string>("")
  const [highDemandMsg, setHighDemandMsg] = useState("")
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastMsg, setBroadcastMsg] = useState("")
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [highDemandInput, setHighDemandInput] = useState("")
  const [highDemandOpen, setHighDemandOpen] = useState(false)
  const [ordersBlocked, setOrdersBlocked] = useState(false)
  const [ordersBlockedMsg, setOrdersBlockedMsg] = useState("")
  const [ordersBlockedInput, setOrdersBlockedInput] = useState("")
  const [ordersBlockedOpen, setOrdersBlockedOpen] = useState(false)
  const [promoBanners, setPromoBanners] = useState<PromoBanner[]>([])
  const [promoOpen, setPromoOpen] = useState(false)
  const [promoDraft, setPromoDraft] = useState<PromoBanner[]>([])
  const [promoNewText, setPromoNewText] = useState("")
  const [promoNewColor, setPromoNewColor] = useState<"red" | "green">("green")
  const addToast = (msg: string, variant: ToastData["variant"] = "success") => setToasts((t) => [...t, createToast(msg, variant)])
  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id))

  // Hooks extraídos
  const { playNotificationSound, showNativeNotification } = useNotificationSound()

  const clientDisplay = (o: SupabaseOrder) => {
    const n = (o.client_name || "").trim()
    const isPhone = /^\+?\d{7,15}$/.test(n.replace(/[\s\-]/g, ""))
    if (isPhone && o.delivery_type === "delivery" && o.address?.trim()) return o.address.trim()
    if (isPhone) return "Cliente"
    return n
  }
  const { sendWhatsAppNotification, sendReceiptByWhatsApp, notifyAdmin } = useWhatsAppActions({
    businessName, paperWidth, logoUrl, storeAddress, deliveryFee,
  })

  // Filtro de historial
  const [dateRange, setDateRange] = useState<1 | 7>(1)
  const [filterMode, setFilterMode] = useState<"range" | "date">("range")
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split("T")[0])
  const [openHourPedidos, setOpenHourPedidos] = useState<number>(0)
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)

  // Cotización "Ármalo a tu pinta"
  const [quoteModal, setQuoteModal] = useState<SupabaseOrder | null>(null)
  const [quotePrices, setQuotePrices] = useState<Record<number, string>>({})
  const [quoteSending, setQuoteSending] = useState(false)

  const openQuoteModal = (order: SupabaseOrder) => {
    setQuoteModal(order)
    setSelectedOrder(null)
    const prices: Record<number, string> = {}
    order.items.forEach((item: any, idx: number) => {
      if (item.customBuild) prices[idx] = item.quotedPrice != null ? String(item.quotedPrice) : ""
    })
    setQuotePrices(prices)
  }

  const handleQuoteSubmit = async () => {
    if (!quoteModal) return
    // Validar que todos los items custom build tengan precio
    const hasEmpty = quoteModal.items.some((item: any, idx: number) => item.customBuild && (!quotePrices[idx] || Number(quotePrices[idx]) <= 0))
    if (hasEmpty) { addToast("Asigna precio a todos los productos personalizados", "error"); return }

    setQuoteSending(true)
    const updatedItems: OrderItem[] = quoteModal.items.map((item: any, idx: number) => {
      if (item.customBuild && quotePrices[idx]) return { ...item, quotedPrice: Number(quotePrices[idx]) }
      return item
    })
    const hasAnyCustom = updatedItems.some((i: any) => i.customBuild)
    const itemsTotal = updatedItems.reduce((sum, item: any) => {
      const unitPrice = item.customBuild && item.quotedPrice != null 
        ? item.quotedPrice 
        : (item.price + (item.extras || []).reduce((s: number, e: any) => s + (Number(e.price) || 0), 0))
      return sum + unitPrice * item.quantity
    }, 0)
    // Agregar costo de delivery si aplica
    const deliveryCost = quoteModal.delivery_type === "delivery" ? deliveryFee : 0
    const newTotal = itemsTotal + deliveryCost

    const result = await quoteOrderItems(quoteModal.id, updatedItems, newTotal)
    if (result) {
      // Enviar WhatsApp al cliente con el precio
      if (quoteModal.client_phone) {
        const itemLines = updatedItems.map((i: any) => {
          const basePrice = i.price + (i.extras || []).reduce((s: number, e: any) => s + (Number(e.price) || 0), 0)
          const finalPrice = i.customBuild && i.quotedPrice != null 
            ? i.quotedPrice 
            : basePrice
          const totalItem = finalPrice * i.quantity
          
          if (i.customBuild) {
            // Para items custom, mostrar antes → después
            return `• ${i.quantity}× ${i.name} 🎨\n  Base: $${(basePrice * i.quantity).toLocaleString("es-CL")} → *Cotizado: $${totalItem.toLocaleString("es-CL")}*`
          } else {
            // Para items normales, solo mostrar precio
            return `• ${i.quantity}× ${i.name}: $${totalItem.toLocaleString("es-CL")}`
          }
        }).join("\n")
        // Agregar línea de delivery si aplica
        const deliveryLine = deliveryCost > 0 ? `\n🚚 *Delivery: $${deliveryCost.toLocaleString("es-CL")}*` : ""
        const msg = `🎨 *${clientDisplay(quoteModal)}*, hemos cotizado tu pedido *#${quoteModal.id}* en *${businessName}*:

${itemLines}${deliveryLine}

💰 *Total a pagar: $${newTotal.toLocaleString("es-CL")}*

Responde:
✅ *CONFIRMAR* para que comencemos a prepararlo
❌ *CANCELAR* si deseas anularlo

🍣`
        await sendWhatsAppNotification(quoteModal, msg)
      }
      addToast(`Cotización enviada a ${clientDisplay(quoteModal)}`)
      await refreshOrders()
    } else {
      addToast("Error al cotizar", "error")
    }
    setQuoteSending(false)
    setQuoteModal(null)
  }

  useEffect(() => {
    setStoreWhatsApp(loadWhatsApp())
    setBusinessName(loadBusinessName() || "Osaka")
    // El logo del recibo PDF debe ser base64 (jsPDF no carga URLs remotas).
    // Se usa el de localStorage; si falta, se trae UNA vez con getLogoConfig.
    // Ya no viene en getAllConfig para no inflar el egress.
    const localLogo = loadLogo("dark")
    setLogoUrl(localLogo)
    if (!localLogo) getLogoConfig().then((l) => { if (l.logo) setLogoUrl(l.logo) })
    setStoreAddress(loadAddress())
    getAllConfig().then((cfg) => {
      if (cfg.nombreNegocio) setBusinessName(cfg.nombreNegocio)
      if (cfg.direccion) setStoreAddress(cfg.direccion)
      if (cfg.deliveryFee) setDeliveryFee(Number(cfg.deliveryFee) || 0)
      if (cfg.cartaCode) setCartaCode(cfg.cartaCode)
      if (cfg.statusMsgs) { try { setStatusMsgs(JSON.parse(cfg.statusMsgs)) } catch {} }
      const open = !!cfg.lastDayStart && (!cfg.lastDayClose || cfg.lastDayStart > cfg.lastDayClose)
      setDayOpen(open)
      if (cfg.lastDayStart) setBizDayStart(cfg.lastDayStart)
      if (cfg.lastDayClose && cfg.lastDayStart && cfg.lastDayClose > cfg.lastDayStart) setBizDayClose(cfg.lastDayClose)
      if (cfg.horaApertura) {
        const [hh] = cfg.horaApertura.split(":").map(Number)
        setOpenHourPedidos(hh)
      }
      if (cfg.highDemandMsg) {
        setHighDemandMsg(cfg.highDemandMsg)
        setHighDemandInput(cfg.highDemandMsg)
      }
      if (cfg.ordersBlocked === "true") {
        setOrdersBlocked(true)
        const msg = cfg.ordersBlockedMsg || ""
        setOrdersBlockedMsg(msg)
        setOrdersBlockedInput(msg)
      }
      if (cfg.promoBanners) {
        try {
          const parsed = JSON.parse(cfg.promoBanners) as PromoBanner[]
          if (Array.isArray(parsed)) {
            setPromoBanners(parsed)
            setPromoDraft(parsed)
          }
        } catch {}
      }
    })
  }, [])

  // Cargar pedidos según el filtro activo
  const loadOrders = useCallback(async () => {
    setIsLoadingOrders(true)
    try {
      let data: SupabaseOrder[]
      if (filterMode === "date") {
        data = await getOrdersByDate(filterDate, openHourPedidos)
      } else if (filterMode === "range" && dateRange === 1) {
        // Vista "hoy": respetar estado del día (cerrado → vacío)
        const dayIsOpen = !!bizDayStart && (!bizDayClose || bizDayClose <= bizDayStart)
        if (!dayIsOpen) {
          setOrders([])
          return
        }
        const all = await getOrdersByDateRange(dateRange)
        data = all.filter((o) => o.created_at >= bizDayStart)
      } else {
        data = await getOrdersByDateRange(dateRange)
      }
      setOrders(data)
    } catch (err) {
      console.error("Error cargando pedidos:", err)
    } finally {
      setIsLoadingOrders(false)
      setLoading(false)
    }
  }, [dateRange, filterMode, filterDate, openHourPedidos, bizDayStart, bizDayClose])

  // Carga inicial — se re-ejecuta solo cuando cambian los filtros
  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // Suscripción Realtime — separada para evitar doble setOrders al cargar config
  useEffect(() => {
    if (filterMode === "date") return
    const unsub = subscribeToOrders((data) => {
      if (filterMode === "range" && dateRange === 1) {
        // Día abierto: mostrar pedidos desde dayStart. Día cerrado/no iniciado: vacío.
        const dayIsOpen = !!bizDayStart && (!bizDayClose || bizDayClose <= bizDayStart)
        if (dayIsOpen) {
          setOrders(data.filter((o) => o.created_at >= bizDayStart))
        } else {
          setOrders([])
        }
      } else {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - dateRange)
        cutoff.setHours(0, 0, 0, 0)
        setOrders(data.filter((o) => new Date(o.created_at) >= cutoff))
      }
    })
    return () => { unsub() }
  }, [dateRange, filterMode, bizDayStart, bizDayClose])


  // Refs para acceder a datos actualizados sin re-suscribir el canal
  const ordersRef = useRef(orders)
  useEffect(() => { ordersRef.current = orders }, [orders])
  const cartaCodeRef = useRef(cartaCode)
  useEffect(() => { cartaCodeRef.current = cartaCode }, [cartaCode])

  // Limpiar chats de pedidos entregados al cargar (una sola vez)
  const deliveredCleanedRef = useRef(false)
  useEffect(() => {
    if (deliveredCleanedRef.current || loading || orders.length === 0) return
    deliveredCleanedRef.current = true
    const delivered = orders.filter((o) => o.status === "entregado")
    if (delivered.length > 0) {
      Promise.all(delivered.map((o) => deleteMessagesByOrder(o.id, o.client_phone)))
        .then(() => {
          getUnreadCounts().then(setUnreadCounts)
          getActiveConversations().then(setConversations)
        })
    }
  }, [loading, orders])

  // Cargar unread counts + suscripción realtime de chat
  useEffect(() => {
    getUnreadCounts().then(setUnreadCounts)
    getActiveConversations().then(setConversations)
    const channel = subscribeToChatMessages(async (msg: ChatMessage) => {
      // Refrescar lista de conversaciones con cualquier mensaje nuevo
      getActiveConversations().then(setConversations)

      if (msg.direction === "incoming") {
        setUnreadCounts((prev) => ({
          ...prev,
          [msg.order_id]: (prev[msg.order_id] || 0) + 1,
        }))
        // Sonido + notificación nativa
        playNotificationSound()
        showNativeNotification("💬 Nuevo mensaje WhatsApp", msg.message.slice(0, 100))

        // Auto-confirmar/cancelar: detectar respuesta del cliente en pedidos cotizados
        // Usar word-level matching para evitar falsos positivos ("no sé" no debe cancelar)
        const msgWords = msg.message.trim().toLowerCase()
          .replace(/[^a-záéíóúñ0-9\s]/g, "")
          .split(/\s+/)
          .filter(Boolean)
        const isShortMsg = msgWords.length <= 3

        // Keywords largas: aplican en cualquier longitud de mensaje
        const confirmLong = ["confirmar", "confirmo", "dale", "perfecto", "acepto", "aceptar", "proceder", "hagalo", "hágalo", "vamos"]
        const cancelLong  = ["cancelar", "cancelo", "anular", "anulo", "rechazar", "rechazo"]
        // Keywords cortas: solo si el mensaje completo es ≤3 palabras
        const confirmShort = ["si", "sí", "ok", "bueno", "va"]
        const cancelShort  = ["no"]

        const isConfirm = confirmLong.some(kw => msgWords.includes(kw)) ||
                          (isShortMsg && confirmShort.some(kw => msgWords.includes(kw)))
        const isCancel  = cancelLong.some(kw => msgWords.includes(kw)) ||
                          (isShortMsg && cancelShort.some(kw => msgWords.includes(kw)))
        
        if (isConfirm) {
          const order = ordersRef.current.find((o) => o.id === msg.order_id)
          console.log("[WhatsApp] Order encontrado:", order?.id, "| Status:", order?.status)
          if (order && order.status === "cotizado") {
            await updateOrderStatus(order.id, "recibido")
            await refreshOrders()
            addToast(`✅ ${clientDisplay(order)} confirmó su pedido cotizado`, "success")
            playNotificationSound()
            // Notificar al cliente
            await sendWhatsAppNotification(order, `✅ ¡${clientDisplay(order)}! Tu pedido *#${order.id}* ha sido *confirmado*. Comenzaremos a prepararlo. ¡Gracias! 🍣`)
          }
        } else if (isCancel) {
          const order = ordersRef.current.find((o) => o.id === msg.order_id)
          console.log("[WhatsApp] Order encontrado para cancelar:", order?.id, "| Status:", order?.status)
          if (order && order.status === "cotizado") {
            await updateOrderStatus(order.id, "cancelado")
            await refreshOrders()
            // Enviar link de carta por WhatsApp
            const cartaPhoneParam = order.client_phone ? `?phone=${encodeURIComponent(order.client_phone)}` : ""
            const cartaNameParam = order.client_name ? `&name=${encodeURIComponent(order.client_name)}` : ""
            const cartaUrl = cartaCodeRef.current ? `${window.location.origin}/carta/${cartaCodeRef.current}${cartaPhoneParam}${cartaNameParam}` : ""
            const cancelMsg = `❌ *${clientDisplay(order)}*, tu pedido *#${order.id}* ha sido cancelado.

` +
              (cartaUrl ? `Si deseas hacer un nuevo pedido, puedes hacerlo aquí:\n👉 ${cartaUrl}\n\n` : "") +
              `¡Te esperamos! 🍣`
            await sendWhatsAppNotification(order, cancelMsg)
            addToast(`❌ ${clientDisplay(order)} canceló su pedido cotizado`, "warning")
            playNotificationSound()
          }
        }
      }
      // Refrescar lista de conversaciones
      getActiveConversations().then(setConversations)
    })
    return () => { channel.unsubscribe() }
  }, [])

  const handleOrderCreated = async () => {
    await refreshOrders()
    addToast("Pedido creado correctamente", "success")
  }

  const byStatus = useMemo(() => (status: OrderStatus) => orders.filter((o) => o.status === status), [orders])
  const totalUnreadChats = useMemo(() => conversations.reduce((sum, c) => sum + c.unreadCount, 0), [conversations])
  const filteredOrders = useMemo(() => {
    if (activeTab === "todos") return orders
    return byStatus(activeTab as OrderStatus)
  }, [activeTab, orders, byStatus])

  const handleAdvance = async (order: SupabaseOrder) => {
    // Si el pedido tiene items "a tu pinta" sin cotizar, abrir modal de cotización
    const hasUnquoted = order.items.some((i: any) => i.customBuild && i.quotedPrice == null)
    if (order.status === "recibido" && hasUnquoted) {
      openQuoteModal(order)
      return
    }
    const next: Record<string, OrderStatus> = {
      recibido: "preparando",
      cotizado: "recibido",
      preparando: "en-camino",
      "en-camino": "entregado",
    }
    const nextStatus = next[order.status]
    if (!nextStatus) return

    const updated = await updateOrderStatus(order.id, nextStatus)
    // Refleja el cambio al instante SIN refetch (refreshOrders descargaba 2 días
    // de pedidos en cada acción). El evento Realtime posterior es idempotente.
    if (updated) applyLocalOrderChange("UPDATE", updated)
    const labels: Record<string, string> = { preparando: "Preparando", "en-camino": "En camino", entregado: "Entregado" }
    addToast(`${clientDisplay(order)} → ${labels[nextStatus] || nextStatus}`, nextStatus === "entregado" ? "success" : "info")

    // Envíos de WhatsApp + side-effects en segundo plano: no bloquean la UI,
    // que ya muestra el nuevo estado. Antes cada await encadenado (mensaje,
    // recibo PDF + subida a Cloudinary, aviso al admin) congelaba el botón.
    void (async () => {
      if (order.client_phone) {
        const replaceVars = (tpl: string) => tpl
          .replace(/\{nombre\}/g, clientDisplay(order))
          .replace(/\{pedido\}/g, order.id)
          .replace(/\{negocio\}/g, businessName)

        const defaultMessages: Record<string, string> = {
          preparando: `👨‍🍳 ${clientDisplay(order)}, tu pedido *#${order.id}* en *${businessName}* está siendo preparado. ¡Ya falta poco!`,
          "en-camino": order.delivery_type === "delivery"
            ? `🚚 ${clientDisplay(order)}, tu pedido *#${order.id}* está en camino. ¡Prepárate para recibirlo!`
            : `✅ ${clientDisplay(order)}, tu pedido *#${order.id}* en *${businessName}* está *listo para retirar*. ¡Te esperamos!`,
          entregado: `✅ ${clientDisplay(order)}, tu pedido *#${order.id}* ha sido entregado. ¡Gracias por tu compra en *${businessName}*! 🙏`,
        }

        let msg: string | undefined
        if (nextStatus === "preparando" && statusMsgs.preparando) {
          msg = replaceVars(statusMsgs.preparando)
        } else if (nextStatus === "en-camino") {
          const key = order.delivery_type === "delivery" ? "enCaminoDelivery" : "enCaminoRetiro"
          msg = statusMsgs[key] ? replaceVars(statusMsgs[key]) : defaultMessages["en-camino"]
        } else if (nextStatus === "entregado" && statusMsgs.entregado) {
          msg = replaceVars(statusMsgs.entregado)
        } else {
          msg = defaultMessages[nextStatus]
        }
        if (msg) await sendWhatsAppNotification(order, msg)

        // Enviar recibo PDF al entregar
        if (nextStatus === "entregado") {
          await sendReceiptByWhatsApp(order)
          // Limpiar chat del cliente al entregar
          await deleteMessagesByOrder(order.id, order.client_phone)
          setUnreadCounts((prev) => { const next = { ...prev }; delete next[order.id]; return next })
          getActiveConversations().then(setConversations)
        }
      }

      // Notificar al admin por WhatsApp (en-camino y entregado)
      const adminMessages: Record<string, string> = {
        "en-camino": `🚚 Pedido *#${order.id}* de *${clientDisplay(order)}* está en camino — $${order.total.toLocaleString("es-CL")}`,
        entregado: `✅ Pedido *#${order.id}* de *${clientDisplay(order)}* fue entregado — $${order.total.toLocaleString("es-CL")}`,
      }
      if (adminMessages[nextStatus]) {
        notifyAdmin(adminMessages[nextStatus])
      }
    })()
  }

  const handleCancel = async (order: SupabaseOrder) => {
    const updated = await updateOrderStatus(order.id, "cancelado")
    if (updated) applyLocalOrderChange("UPDATE", updated)
    notifyOrderCancelled(order.id, clientDisplay(order))
    addToast(`Pedido de ${clientDisplay(order)} cancelado`, "error")
    setCancelConfirm(null)
    // WhatsApp + limpieza de chat en segundo plano (no bloquea la UI)
    void (async () => {
      // Notificar al cliente por WhatsApp
      if (order.client_phone) {
        const cancelMsg = statusMsgs.cancelado
          ? statusMsgs.cancelado.replace(/\{nombre\}/g, clientDisplay(order)).replace(/\{pedido\}/g, order.id).replace(/\{negocio\}/g, businessName)
          : `❌ ${clientDisplay(order)}, lamentamos informarte que tu pedido *#${order.id}* ha sido cancelado. Si tienes dudas, contáctanos.`
        await sendWhatsAppNotification(order, cancelMsg)
      }
      // Limpiar chat del cliente al cancelar
      await deleteMessagesByOrder(order.id, order.client_phone)
      setUnreadCounts((prev) => { const next = { ...prev }; delete next[order.id]; return next })
      getActiveConversations().then(setConversations)
      // Notificar al admin por WhatsApp
      notifyAdmin(`❌ Pedido *#${order.id}* de *${clientDisplay(order)}* fue *cancelado* — $${order.total.toLocaleString("es-CL")}`)
    })()
  }

  const handleDelete = async (id: string) => {
    await deleteOrder(id)
    applyLocalOrderChange("DELETE", { id })
    addToast("Pedido eliminado", "warning")
    setDeleteConfirm(null)
  }

  const handleApplyDiscount = async () => {
    if (!discountModal || !discountAmount || Number(discountAmount) <= 0) return
    const discount = Number(discountAmount)
    if (discount >= discountModal.total) {
      addToast("El descuento no puede ser mayor o igual al total", "error")
      return
    }
    const result = await updateOrderDiscount(discountModal.id, discount, discountModal.total)
    if (result) {
      addToast(`Descuento de $${discount.toLocaleString("es-CL")} aplicado`)
      await refreshOrders()
      setDiscountModal(null)
      setDiscountAmount("")
    } else {
      addToast("Error al aplicar descuento", "error")
    }
  }

  const handleClearDelivered = async () => {
    // Limpiar chats de pedidos entregados antes de borrarlos
    const deliveredOrders = orders.filter((o) => o.status === "entregado")
    await Promise.all(deliveredOrders.map((o) => deleteMessagesByOrder(o.id, o.client_phone)))
    await clearDelivered()
    await refreshOrders()
    getActiveConversations().then(setConversations)
    getUnreadCounts().then(setUnreadCounts)
    addToast("Pedidos entregados limpiados", "success")
    setClearConfirm(false)
  }

  const handleApprovePayment = async (order: SupabaseOrder) => {
    await updatePaymentStatus(order.id, "aprobado")
    if (order.receipt_url) {
      await deleteCloudinaryImage(order.receipt_url)
      await updateOrderReceiptUrl(order.id, null)
    }
    await refreshOrders()
    setReceiptModal(null)
    if (order.client_phone) {
      await sendWhatsAppNotification(order, `✅ ¡Hola ${clientDisplay(order)}! Tu comprobante de transferencia para el pedido de *${businessName}* ha sido *aprobado*. ¡Gracias!`)
    }
  }

  const handleRejectPayment = async (order: SupabaseOrder) => {
    await updatePaymentStatus(order.id, "rechazado")
    if (order.receipt_url) {
      await deleteCloudinaryImage(order.receipt_url)
      await updateOrderReceiptUrl(order.id, null)
    }
    await refreshOrders()
    setReceiptModal(null)
    setRejectConfirm(null)
    if (order.client_phone) {
      await sendWhatsAppNotification(order, `❌ Hola ${clientDisplay(order)}, el comprobante de transferencia para tu pedido de *${businessName}* fue *rechazado*. Por favor envía un comprobante válido o elige otro método de pago.`)
    }
  }

  const paymentLabel = (o: SupabaseOrder) => {
    if (o.payment_method === "efectivo") return "Efectivo"
    if (o.payment_method === "transferencia") return "Transferencia"
    if (o.card_type === "debito") return "Débito"
    if (o.card_type === "credito") return "Crédito"
    return "Tarjeta"
  }

  const PaymentIcon = ({ method }: { method: string }) => {
    if (method === "efectivo") return <Banknote className="h-3 w-3" />
    if (method === "transferencia") return <ArrowRightLeft className="h-3 w-3" />
    return <CreditCard className="h-3 w-3" />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Pedidos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {orders.filter(o => o.status !== "entregado" && o.status !== "cancelado").length} activos · {orders.length} en total
            {filterMode === "range" && dateRange > 1 && <span className="ml-1 text-primary">(últimos {dateRange} días)</span>}
            {filterMode === "date" && <span className="ml-1 text-primary capitalize">({new Date(filterDate + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long" })})</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          {/* Selector de filtro de fechas */}
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card px-1.5 py-1 shadow-sm">
            <button
              onClick={() => { setFilterMode("range"); setDateRange(1) }}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${filterMode === "range" && dateRange === 1 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >Hoy</button>
            <button
              onClick={() => { setFilterMode("range"); setDateRange(7) }}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${filterMode === "range" && dateRange === 7 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >7 días</button>
            <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors cursor-pointer ${filterMode === "date" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setFilterMode("date")}>
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <input
                type="date"
                value={filterDate}
                max={new Date().toISOString().split("T")[0]}
                onClick={(e) => { e.stopPropagation(); setFilterMode("date") }}
                onChange={(e) => { if (e.target.value) { setFilterDate(e.target.value); setFilterMode("date") } }}
                className={`bg-transparent text-xs font-semibold outline-none cursor-pointer w-[90px] ${filterMode === "date" ? "text-primary-foreground" : "text-muted-foreground"}`}
              />
            </div>
          </div>
          <button
            onClick={() => dayOpen ? setShowPOS(true) : null}
            disabled={!dayOpen}
            title={!dayOpen ? "Inicia el día desde la página de Ventas para crear pedidos" : undefined}
            className="flex items-center gap-1.5 sm:gap-2 rounded-xl bg-primary px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Nuevo Pedido</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2 sm:px-3 py-1.5 sm:py-2 shadow-sm">
            <Printer className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={paperWidth}
              onChange={(e) => setPaperWidth(e.target.value as PaperWidth)}
              className="bg-transparent text-xs font-medium text-card-foreground focus:outline-none cursor-pointer"
            >
              <option value="75mm">75mm</option>
              <option value="58mm">58mm</option>
            </select>
          </div>
          <button
            onClick={() => setCierreDateModal(true)}
            disabled={downloadingCierre}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shadow-sm disabled:opacity-50"
            title="Descargar cierre de fecha específica"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cierre del día</span>
          </button>
          <button
            onClick={() => setHighDemandOpen(!highDemandOpen)}
            className={`flex items-center gap-1.5 rounded-xl border px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold transition-colors shadow-sm ${
              highDemandMsg
                ? "border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            title={highDemandMsg ? "Alta demanda activa — click para editar" : "Activar aviso de alta demanda"}
          >
            <Flame className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{highDemandMsg ? "Alta demanda" : "Demanda"}</span>
          </button>
          <button
            onClick={() => setOrdersBlockedOpen(!ordersBlockedOpen)}
            className={`flex items-center gap-1.5 rounded-xl border px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold transition-colors shadow-sm ${
              ordersBlocked
                ? "border-red-500/40 bg-red-500/10 text-red-600 hover:bg-red-500/20"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            title={ordersBlocked ? "Pedidos pausados — click para editar" : "Pausar recepción de pedidos"}
          >
            <Ban className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{ordersBlocked ? "Pedidos pausados" : "Pausar"}</span>
          </button>
          <button
            onClick={() => { setPromoOpen(!promoOpen); setPromoDraft(promoBanners) }}
            className={`flex items-center gap-1.5 rounded-xl border px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold transition-colors shadow-sm ${
              promoBanners.length > 0
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            title={promoBanners.length > 0 ? `${promoBanners.length} banner(s) de promoción activo(s)` : "Gestionar banners de promoción"}
          >
            <Tag className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{promoBanners.length > 0 ? `Promos (${promoBanners.length})` : "Promos"}</span>
          </button>
        </div>
      </div>

      {/* Panel de pausa de pedidos */}
      {ordersBlockedOpen && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-red-500" />
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">Pausar recepción de pedidos</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Al activar, los clientes verán una pantalla especial en la carta indicando que no hay pedidos disponibles por el momento.
          </p>
          <textarea
            value={ordersBlockedInput}
            onChange={(e) => setOrdersBlockedInput(e.target.value)}
            placeholder="Ej: Debido a la alta demanda de hoy, no recibiremos más pedidos. ¡Vuelve mañana, muchas gracias!"
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const msg = ordersBlockedInput.trim() || "Debido a la alta demanda de hoy, no recibiremos más pedidos. ¡Vuelve mañana, muchas gracias! 🙏"
                await Promise.all([
                  setConfigValue("ordersBlocked", "true"),
                  setConfigValue("ordersBlockedMsg", msg),
                ])
                setOrdersBlocked(true)
                setOrdersBlockedMsg(msg)
                setOrdersBlockedInput(msg)
                setOrdersBlockedOpen(false)
                addToast("🚫 Recepción de pedidos pausada", "warning")
              }}
              className="rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
            >
              {ordersBlocked ? "Actualizar mensaje" : "Pausar pedidos"}
            </button>
            {ordersBlocked && (
              <button
                onClick={async () => {
                  await setConfigValue("ordersBlocked", "")
                  setOrdersBlocked(false)
                  setOrdersBlockedMsg("")
                  setOrdersBlockedInput("")
                  setOrdersBlockedOpen(false)
                  addToast("Recepción de pedidos reactivada", "success")
                }}
                className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Reactivar pedidos
              </button>
            )}
            <button
              onClick={() => setOrdersBlockedOpen(false)}
              className="ml-auto rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Panel de alta demanda */}
      {highDemandOpen && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Aviso de alta demanda</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Al activar, los clientes verán un banner de advertencia en la carta y deberán aceptar el posible retraso antes de pedir.
          </p>
          <textarea
            value={highDemandInput}
            onChange={(e) => setHighDemandInput(e.target.value)}
            placeholder="Ej: Estamos con alta demanda, tu pedido puede tardar 40-60 min"
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const msg = highDemandInput.trim() || "⚠️ Estamos con alta demanda. Tu pedido podría tener un tiempo de espera mayor al habitual."
                await setConfigValue("highDemandMsg", msg)
                setHighDemandMsg(msg)
                setHighDemandInput(msg)
                setHighDemandOpen(false)
                addToast("🔥 Aviso de alta demanda activado", "warning")
              }}
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
            >
              {highDemandMsg ? "Actualizar aviso" : "Activar aviso"}
            </button>
            {highDemandMsg && (
              <button
                onClick={async () => {
                  await setConfigValue("highDemandMsg", "")
                  setHighDemandMsg("")
                  setHighDemandInput("")
                  setHighDemandOpen(false)
                  addToast("Aviso de alta demanda desactivado", "success")
                }}
                className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Desactivar
              </button>
            )}
            <button
              onClick={() => setHighDemandOpen(false)}
              className="ml-auto rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Panel de banners de promoción */}
      {promoOpen && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Banners de promoción</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Crea uno o varios banners que verán los clientes en la parte superior de la carta. Úsalos para anunciar promociones, descuentos o ofertas especiales.
          </p>

          {/* Lista de banners existentes */}
          {promoDraft.length > 0 && (
            <div className="space-y-2">
              {promoDraft.map((banner, idx) => (
                <div key={banner.id} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2">
                  <div
                    className="mt-1.5 h-3 w-3 flex-shrink-0 rounded-full"
                    style={{ background: banner.color === "red" ? "#c1272d" : "#2e7d32" }}
                  />
                  <textarea
                    value={banner.text}
                    onChange={(e) => {
                      const next = [...promoDraft]
                      next[idx] = { ...banner, text: e.target.value }
                      setPromoDraft(next)
                    }}
                    rows={1}
                    placeholder="Ej: 2x1 en rolls los lunes 🎉"
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                  />
                  <select
                    value={banner.color}
                    onChange={(e) => {
                      const next = [...promoDraft]
                      next[idx] = { ...banner, color: e.target.value as "red" | "green" }
                      setPromoDraft(next)
                    }}
                    className="rounded-md border border-border bg-background px-1.5 py-1.5 text-xs focus:outline-none"
                  >
                    <option value="green">Verde</option>
                    <option value="red">Rojo</option>
                  </select>
                  <button
                    onClick={() => setPromoDraft(promoDraft.filter((b) => b.id !== banner.id))}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Eliminar banner"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Agregar nuevo banner */}
          <div className="rounded-lg border border-dashed border-border p-2.5 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Nuevo banner</p>
            <textarea
              value={promoNewText}
              onChange={(e) => setPromoNewText(e.target.value)}
              rows={1}
              placeholder="Ej: 2x1 en rolls los lunes 🎉"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
            />
            <div className="flex items-center gap-2">
              <select
                value={promoNewColor}
                onChange={(e) => setPromoNewColor(e.target.value as "red" | "green")}
                className="rounded-md border border-border bg-background px-1.5 py-1.5 text-xs focus:outline-none"
              >
                <option value="green">Verde</option>
                <option value="red">Rojo</option>
              </select>
              <button
                onClick={() => {
                  const text = promoNewText.trim()
                  if (!text) return
                  const newBanner: PromoBanner = { id: `promo-${Date.now()}`, text, color: promoNewColor }
                  setPromoDraft([...promoDraft, newBanner])
                  setPromoNewText("")
                }}
                disabled={!promoNewText.trim()}
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Agregar
              </button>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const cleaned = promoDraft.filter((b) => b.text.trim())
                const json = JSON.stringify(cleaned)
                await setConfigValue("promoBanners", json)
                setPromoBanners(cleaned)
                setPromoOpen(false)
                addToast(`🎉 ${cleaned.length} banner(s) de promoción guardado(s)`, "success")
              }}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
            >
              Guardar banners
            </button>
            {promoBanners.length > 0 && (
              <button
                onClick={async () => {
                  await setConfigValue("promoBanners", "")
                  setPromoBanners([])
                  setPromoDraft([])
                  setPromoOpen(false)
                  addToast("Banners de promoción eliminados", "success")
                }}
                className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Borrar todos
              </button>
            )}
            <button
              onClick={() => { setPromoOpen(false); setPromoDraft(promoBanners); setPromoNewText("") }}
              className="ml-auto rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Tabs de estado */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1 mb-4">
        <button
          onClick={() => setActiveTab("todos")}
          className={`flex-shrink-0 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
            activeTab === "todos"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-border/80"
          }`}
        >
          Todos
          {orders.length > 0 && (
            <span className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-md px-1 text-[10px] font-black tabular-nums ${
              activeTab === "todos" ? "bg-white/20 text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>{orders.length}</span>
          )}
        </button>
        {COLUMNS.map((col) => {
          const Icon = col.icon
          const count = byStatus(col.id).length
          const isActive = activeTab === col.id
          return (
            <button
              key={col.id}
              onClick={() => setActiveTab(col.id)}
              className={`flex-shrink-0 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? `${col.bg} ${col.color} shadow-sm border`
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-border/80"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{col.label}</span>
              {count > 0 && (
                <span className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-md px-1 text-[10px] font-black tabular-nums ${
                  isActive ? `bg-white/30 ${col.color}` : "bg-muted text-muted-foreground"
                }`}>{count}</span>
              )}
            </button>
          )
        })}
        <button
          onClick={() => router.push("/whatsapp")}
          className="flex-shrink-0 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all bg-card border border-border text-muted-foreground hover:text-foreground hover:border-border/80"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Chats</span>
          {totalUnreadChats > 0 && (
            <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-black tabular-nums bg-emerald-500 text-white animate-pulse">{totalUnreadChats}</span>
          )}
          {totalUnreadChats === 0 && conversations.length > 0 && (
            <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-md px-1 text-[10px] font-black tabular-nums bg-muted text-muted-foreground">{conversations.length}</span>
          )}
        </button>
      </div>

      {/* Lista de pedidos */}
      {<div className="space-y-2">
        {filteredOrders.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Sin pedidos</p>
          </div>
        )}

        {filteredOrders.map((order) => {
          const col = COLUMNS.find((c) => c.id === order.status)!
          const ColIcon = col.icon
          const hasUrgentAlert = (order.payment_method === "transferencia" && order.payment_status === "pendiente")
          const unread = unreadCounts[order.id] || 0
          return (
            <button
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className={`w-full text-left rounded-xl border border-border border-l-4 bg-card pl-3 pr-3 pt-2.5 pb-2.5 shadow-sm hover:shadow-md transition-all active:scale-[0.99] ${col.border} ${hasUrgentAlert ? "ring-1 ring-amber-500/30" : ""}`}
            >
              <div className="flex items-start gap-3">
                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  {/* Fila superior: nombre/dirección + total */}
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-card-foreground truncate">
                      {order.delivery_type === "delivery" ? (order.address || order.client_name) : order.client_name}
                    </p>
                    <span className="text-sm font-black text-card-foreground flex-shrink-0 ml-3 tabular-nums">
                      $ {order.total.toLocaleString("es-CL")}
                    </span>
                  </div>
                  {/* Items */}
                  <p className="text-[11px] text-muted-foreground truncate mb-2 leading-relaxed">
                    {order.items.map((i: any) => `${i.quantity}× ${i.name}`).join("  ·  ")}
                  </p>
                  {/* Badges + tiempo */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Estado — ahora más pequeño porque el borde ya lo comunica */}
                    <span className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ${col.bg} ${col.color}`}>
                      <ColIcon className="h-2.5 w-2.5" />
                      {col.label}
                    </span>
                    {/* Pago */}
                    <span className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${
                      order.payment_method === "efectivo"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : order.payment_method === "transferencia"
                        ? "bg-blue-500/10 text-blue-600"
                        : "bg-purple-500/10 text-purple-600"
                    }`}>
                      <PaymentIcon method={order.payment_method} />
                      {paymentLabel(order)}
                    </span>
                    {/* Delivery */}
                    <span className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${
                      order.delivery_type === "delivery"
                        ? "bg-orange-500/10 text-orange-600"
                        : "bg-zinc-500/10 text-zinc-500"
                    }`}>
                      {order.delivery_type === "delivery" ? <Truck className="h-2.5 w-2.5" /> : <Store className="h-2.5 w-2.5" />}
                      {order.delivery_type === "delivery" ? "Delivery" : "Retiro"}
                    </span>
                    {/* Alertas */}
                    {hasUrgentAlert && (
                      <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/15 text-amber-600">
                        <Eye className="h-2.5 w-2.5" />
                        Comprobante
                      </span>
                    )}
                    {order.modification_notes && (
                      <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold bg-amber-500/10 text-amber-600">
                        <Pencil className="h-2.5 w-2.5" />
                        Modificado
                      </span>
                    )}
                    {unread > 0 && (
                      <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/15 text-emerald-600 animate-pulse">
                        <MessageCircle className="h-2.5 w-2.5" />
                        {unread} msg
                      </span>
                    )}
                    {/* Tiempo — alineado a la derecha */}
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto flex-shrink-0 tabular-nums">
                      <Clock className="h-2.5 w-2.5" />
                      {timeAgo(order.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>}


      {/* Modal detalle de pedido */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px]" onClick={() => setSelectedOrder(null)}>
          <div
            className="w-full sm:max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — borde izquierdo de color por estado (firma ticket de cocina en modal) */}
            {(() => {
              const col = COLUMNS.find((c) => c.id === selectedOrder.status)!
              const ColIcon = col.icon
              return (
                <div className={`sticky top-0 z-10 flex items-center justify-between pl-4 pr-4 sm:pl-5 sm:pr-5 py-3 sm:py-4 border-b border-border bg-card border-l-4 ${col.border} rounded-tl-2xl sm:rounded-tl-2xl`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-base font-black text-card-foreground truncate tracking-tight">{clientDisplay(selectedOrder)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${col.color}`}>
                          <ColIcon className="h-2.5 w-2.5" />
                          {col.label}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">{selectedOrder.id}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {timeAgo(selectedOrder.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xl font-black text-card-foreground tabular-nums">
                      $ {selectedOrder.total.toLocaleString("es-CL")}
                    </span>
                    <button onClick={() => setSelectedOrder(null)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent transition-colors ml-1">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )
            })()}

            <div className="p-4 sm:p-5 space-y-3">
              {/* Contacto */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />{selectedOrder.client_phone}
                </span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${
                  selectedOrder.delivery_type === "delivery" ? "text-orange-600" : "text-muted-foreground"
                }`}>
                  {selectedOrder.delivery_type === "delivery" ? <Truck className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                  {selectedOrder.delivery_type === "delivery" ? (selectedOrder.address || "Delivery") : "Retiro en local"}
                </span>
              </div>

              {/* Items */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-3 py-2 bg-muted/40 border-b border-border">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Productos</p>
                </div>
                <div className="divide-y divide-border">
                  {selectedOrder.items.map((item: any, itemIdx: number) => (
                    <div key={`${item.id}-${itemIdx}`} className="flex items-start justify-between px-3 py-2.5 gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-card-foreground">
                          <span className="text-muted-foreground font-bold tabular-nums">{item.quantity}×</span> {item.name}
                          {item.customBuild && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-300">
                              🎨 A tu pinta
                            </span>
                          )}
                        </p>
                        {item.customBuildNotes && (
                          <p className="text-[10px] mt-0.5 pl-4 font-medium text-amber-700 bg-amber-50 rounded px-2 py-1 border border-amber-200">
                            🎨 {item.customBuildNotes}
                          </p>
                        )}
                        {item.notes && !item.customBuild && <p className="text-[10px] text-muted-foreground mt-0.5 pl-4">📝 {item.notes}</p>}
                        {item.extras && item.extras.length > 0 && (
                          <div className="mt-1 pl-4 space-y-0.5">
                            {item.extras.map((extra: any, idx: number) => (
                              <p key={idx} className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                                <span className="text-amber-400">✦</span>
                                {extra.description}
                                {extra.price > 0 && <span className="font-bold">+${Number(extra.price).toLocaleString("es-CL")}</span>}
                              </p>
                            ))}
                          </div>
                        )}
                        {item.customBuild && item.quotedPrice != null && (
                          <p className="text-[10px] mt-1 pl-4 font-bold text-emerald-600">
                            💰 Precio cotizado: ${Number(item.quotedPrice).toLocaleString("es-CL")}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-bold text-card-foreground flex-shrink-0 tabular-nums">
                        {item.customBuild && item.quotedPrice != null
                          ? `$ ${(Number(item.quotedPrice) * item.quantity).toLocaleString("es-CL")}`
                          : `$ ${((item.price + (item.extras || []).reduce((s: number, e: any) => s + (Number(e.price) || 0), 0)) * item.quantity).toLocaleString("es-CL")}`
                        }
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pago */}
              <div className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold ${
                    selectedOrder.payment_method === "efectivo"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : selectedOrder.payment_method === "transferencia"
                      ? "bg-blue-500/10 text-blue-600"
                      : "bg-purple-500/10 text-purple-600"
                  }`}>
                    <PaymentIcon method={selectedOrder.payment_method} />
                    {paymentLabel(selectedOrder)}
                  </span>
                  <span className="text-xs text-muted-foreground">Total del pedido</span>
                </div>

                {/* Mostrar descuento si existe */}
                {selectedOrder.discount && selectedOrder.discount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-600 font-medium">Descuento aplicado</span>
                    <span className="text-emerald-600 font-bold">- $ {selectedOrder.discount.toLocaleString("es-CL")}</span>
                  </div>
                )}

                {selectedOrder.payment_method === "efectivo" && selectedOrder.cash_amount && (
                  <div className="text-xs text-muted-foreground">
                    Paga con <span className="font-bold text-card-foreground">$ {selectedOrder.cash_amount.toLocaleString("es-CL")}</span>
                    {" → "}Vuelto: <span className="font-bold text-emerald-500">$ {(selectedOrder.change_amount || 0).toLocaleString("es-CL")}</span>
                  </div>
                )}

                {selectedOrder.payment_method === "transferencia" && (
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                    selectedOrder.payment_status === "pendiente" ? "bg-amber-500/5 border border-amber-500/20"
                    : selectedOrder.payment_status === "aprobado" ? "bg-emerald-500/5 border border-emerald-500/20"
                    : "bg-red-500/5 border border-red-500/20"
                  }`}>
                    <div className="flex items-center gap-1.5">
                      {selectedOrder.payment_status === "pendiente" && <Clock className="h-3 w-3 text-amber-500" />}
                      {selectedOrder.payment_status === "aprobado" && <ShieldCheck className="h-3 w-3 text-emerald-500" />}
                      {selectedOrder.payment_status === "rechazado" && <ShieldX className="h-3 w-3 text-red-500" />}
                      <span className={`text-[10px] font-bold ${
                        selectedOrder.payment_status === "pendiente" ? "text-amber-500"
                        : selectedOrder.payment_status === "aprobado" ? "text-emerald-500"
                        : "text-red-500"
                      }`}>
                        {selectedOrder.payment_status === "pendiente" ? "Comprobante pendiente"
                        : selectedOrder.payment_status === "aprobado" ? "Pago aprobado"
                        : "Pago rechazado"}
                      </span>
                    </div>
                    {selectedOrder.receipt_url && (
                      <button
                        onClick={() => { setSelectedOrder(null); setReceiptModal(selectedOrder) }}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold bg-card border border-border hover:bg-accent transition-colors text-card-foreground"
                      >
                        <Eye className="h-3 w-3" />
                        Ver
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Modification info */}
              {selectedOrder.modification_notes && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Pencil className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Pedido modificado</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{selectedOrder.modification_notes}</p>
                  {selectedOrder.original_total !== null && selectedOrder.original_total !== selectedOrder.total && (
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="text-muted-foreground">Original: <span className="line-through">$ {selectedOrder.original_total.toLocaleString("es-CL")}</span></span>
                      {selectedOrder.modification_fee > 0 && (
                        <span className="text-amber-500 font-semibold">Cargo: $ {selectedOrder.modification_fee.toLocaleString("es-CL")}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Recibo PDF + Comanda */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (downloadedComandas.has(selectedOrder.id)) {
                      setRedownloadConfirm({ orderId: selectedOrder.id, type: "comanda" })
                    } else {
                      downloadKitchenOrder(selectedOrder, paperWidth, businessName, deliveryFee)
                      setDownloadedComandas((prev) => new Set(prev).add(selectedOrder.id))
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-colors ${
                    downloadedComandas.has(selectedOrder.id)
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                      : "border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  }`}
                >
                  {downloadedComandas.has(selectedOrder.id) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ChefHat className="h-3.5 w-3.5" />}
                  Comanda
                </button>
                <button
                  onClick={() => {
                    if (downloadedRecibos.has(selectedOrder.id)) {
                      setRedownloadConfirm({ orderId: selectedOrder.id, type: "recibo" })
                    } else {
                      downloadOrderReceipt(selectedOrder, paperWidth, logoUrl, businessName, storeAddress, deliveryFee)
                      setDownloadedRecibos((prev) => new Set(prev).add(selectedOrder.id))
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-colors ${
                    downloadedRecibos.has(selectedOrder.id)
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {downloadedRecibos.has(selectedOrder.id) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <FileDown className="h-3.5 w-3.5" />}
                  Recibo
                </button>
                <button
                  onClick={() => { router.push("/whatsapp"); setSelectedOrder(null) }}
                  className="relative flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/20 py-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Chat
                  {(unreadCounts[selectedOrder.id] || 0) > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-black text-white">
                      {unreadCounts[selectedOrder.id]}
                    </span>
                  )}
                </button>
              </div>

              {/* Botón Cotizar para pedidos con items "a tu pinta" sin cotizar */}
              {selectedOrder.status === "recibido" && selectedOrder.items.some((i: any) => i.customBuild && i.quotedPrice == null) && (
                <button
                  onClick={() => openQuoteModal(selectedOrder)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all active:scale-[0.98]"
                >
                  <Palette className="h-4 w-4" />
                  Cotizar productos personalizados
                </button>
              )}

              {/* Acciones principales */}
              <div className="flex gap-2 pt-1">
                {(selectedOrder.status === "recibido" || selectedOrder.status === "preparando" || selectedOrder.status === "cotizado" || selectedOrder.status === "en-camino") && (
                  <button
                    onClick={() => { setEditingOrder(selectedOrder); setSelectedOrder(null) }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/20 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/30 transition-colors px-3 py-2.5 text-xs font-semibold"
                    title="Editar pedido"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar pedido
                  </button>
                )}
                {/* Botón de descuento - solo para pedidos no entregados ni cancelados */}
                {selectedOrder.status !== "entregado" && selectedOrder.status !== "cancelado" && (
                  <button
                    onClick={() => { setDiscountModal(selectedOrder); setSelectedOrder(null) }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-colors px-3 py-2.5 text-xs font-semibold"
                    title="Aplicar descuento"
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    Descuento
                  </button>
                )}
                {COLUMNS.find((c) => c.id === selectedOrder.status)?.action && (
                  <button
                    onClick={() => { handleAdvance(selectedOrder); setSelectedOrder(null) }}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${
                      selectedOrder.status === "recibido"
                        ? "bg-amber-500 text-white shadow-sm shadow-amber-500/20"
                        : selectedOrder.status === "cotizado"
                        ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                        : selectedOrder.status === "preparando"
                        ? "bg-purple-500 text-white shadow-sm shadow-purple-500/20"
                        : "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20"
                    }`}
                  >
                    {COLUMNS.find((c) => c.id === selectedOrder.status)?.action}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
                {selectedOrder.status !== "cancelado" && selectedOrder.status !== "entregado" && (
                  <button
                    onClick={() => { setCancelConfirm(selectedOrder); setSelectedOrder(null) }}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-colors"
                    title="Cancelar pedido"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal comprobante de transferencia */}
      {receiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setReceiptModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="text-sm font-bold text-card-foreground">Comprobante de Transferencia</p>
                <p className="text-xs text-muted-foreground">{receiptModal.id} — {receiptModal.client_name}</p>
              </div>
              <button onClick={() => setReceiptModal(null)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Imagen del comprobante */}
            <div className="p-4">
              {receiptModal.receipt_url ? (
                <img
                  src={receiptModal.receipt_url}
                  alt="Comprobante"
                  className="w-full max-h-96 object-contain rounded-xl border border-border bg-muted"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Eye className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Sin comprobante adjunto</p>
                </div>
              )}
            </div>

            {/* Info del pedido */}
            <div className="px-5 pb-3">
              <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold text-card-foreground">$ {receiptModal.total.toLocaleString("es-CL")}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Teléfono</span>
                  <span className="text-card-foreground">{receiptModal.client_phone}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Estado</span>
                  <span className={`font-bold ${
                    receiptModal.payment_status === "pendiente" ? "text-amber-500"
                    : receiptModal.payment_status === "aprobado" ? "text-emerald-500"
                    : "text-red-500"
                  }`}>
                    {receiptModal.payment_status === "pendiente" ? "Pendiente"
                    : receiptModal.payment_status === "aprobado" ? "Aprobado"
                    : "Rechazado"}
                  </span>
                </div>
              </div>
            </div>

            {/* Botones aprobar/rechazar */}
            {receiptModal.payment_status === "pendiente" && (
              <div className="flex gap-3 px-5 pb-5">
                <button
                  onClick={() => setRejectConfirm(receiptModal)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <ShieldX className="h-4 w-4" />
                  Rechazar
                </button>
                <button
                  onClick={() => handleApprovePayment(receiptModal)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Aprobar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POS Modal (también abre desde chat con cliente pre-cargado) */}
      <POSModal
        open={showPOS || posOpen}
        onClose={() => { setShowPOS(false); setPosOpen(false); setPosInitialClient(null) }}
        onOrderCreated={() => { handleOrderCreated(); setPosInitialClient(null) }}
        initialClientName={posInitialClient?.name}
        initialClientPhone={posInitialClient?.phone}
        noBackdrop={posOpen && !showPOS}
      />

      {/* Edit Order Modal */}
      <EditOrderModal
        open={!!editingOrder}
        order={editingOrder}
        onClose={() => setEditingOrder(null)}
        onOrderUpdated={refreshOrders}
      />

      {/* Confirmar cancelar pedido */}
      <ConfirmModal
        open={!!cancelConfirm}
        title="Cancelar pedido"
        description={cancelConfirm ? `¿Cancelar el pedido ${cancelConfirm.id} de ${cancelConfirm.client_name}?` : ""}
        confirmLabel="Cancelar Pedido"
        cancelLabel="Volver"
        variant="danger"
        icon={<XCircle className="h-6 w-6 text-red-500" />}
        onConfirm={() => cancelConfirm && handleCancel(cancelConfirm)}
        onCancel={() => setCancelConfirm(null)}
      />


      {/* Confirmar rechazar comprobante */}
      <ConfirmModal
        open={!!rejectConfirm}
        title="Rechazar comprobante"
        description={rejectConfirm ? `¿Rechazar el comprobante de ${rejectConfirm.client_name}? Se le notificará por WhatsApp.` : ""}
        confirmLabel="Rechazar"
        variant="danger"
        icon={<ShieldX className="h-6 w-6 text-red-500" />}
        onConfirm={() => rejectConfirm && handleRejectPayment(rejectConfirm)}
        onCancel={() => setRejectConfirm(null)}
      />

      {/* Confirmar borrar todas las conversaciones */}
      <ConfirmModal
        open={clearChatsConfirm}
        title="Borrar todas las conversaciones"
        description="¿Eliminar todos los mensajes de chat? Esta acción no se puede deshacer."
        confirmLabel="Borrar todo"
        variant="danger"
        icon={<Trash2 className="h-6 w-6 text-red-500" />}
        onConfirm={async () => {
          await Promise.all(conversations.map((c) => deleteMessagesByPhone(c.phone)))
          setConversations([])
          setClearChatsConfirm(false)
        }}
        onCancel={() => setClearChatsConfirm(false)}
      />

      {/* Modal Broadcast */}
      {broadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Send className="h-4 w-4 text-emerald-500" /> Broadcast WhatsApp
              </h3>
              <button onClick={() => { setBroadcastOpen(false); setBroadcastMsg("") }} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Envía un mensaje a todos los clientes con pedidos en los últimos 30 días. Usa <span className="font-mono font-bold">{"{nombre}"}</span> para personalizar.
            </p>
            <textarea
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder={"¡Hola {nombre}! 🍣\n\nTenemos novedades en nuestro menú...\n\n¡Te esperamos!"}
              rows={5}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setBroadcastOpen(false); setBroadcastMsg("") }}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!broadcastMsg.trim()) return
                  setBroadcastSending(true)
                  try {
                    const res = await fetch("/api/whatsapp/broadcast", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "x-internal-token": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" },
                      body: JSON.stringify({ message: broadcastMsg }),
                    })
                    const data = await res.json()
                    if (res.ok) {
                      addToast(`Broadcast enviado a ${data.sent} clientes`, "success")
                    } else {
                      addToast(data.error || "Error al enviar broadcast", "error")
                    }
                  } catch {
                    addToast("Error de conexión", "error")
                  }
                  setBroadcastSending(false)
                  setBroadcastOpen(false)
                  setBroadcastMsg("")
                }}
                disabled={broadcastSending || !broadcastMsg.trim()}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {broadcastSending ? <Clock className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                {broadcastSending ? "Enviando..." : "Enviar a todos"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Modal Cotización "Ármalo a tu pinta" */}
      {quoteModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setQuoteModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 fade-in duration-300 flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-amber-500" />
                  <h3 className="text-base font-bold text-card-foreground">Cotizar pedido #{quoteModal.id}</h3>
                </div>
                <button onClick={() => setQuoteModal(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cliente: <span className="font-semibold text-card-foreground">{quoteModal.client_name}</span> · {quoteModal.client_phone}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {quoteModal.items.map((item: any, idx: number) => (
                <div key={`${item.id}-${idx}`} className={`rounded-xl border p-3 ${item.customBuild ? "border-amber-300 bg-amber-50 dark:bg-amber-500/5" : "border-border"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-card-foreground">
                      {item.quantity}× {item.name}
                      {item.customBuild && <span className="ml-1.5 text-[9px] font-bold text-amber-700 bg-amber-200 px-1.5 py-0.5 rounded-full">🎨 A tu pinta</span>}
                    </p>
                    <span className="text-xs text-muted-foreground">Base: ${item.price.toLocaleString("es-CL")}</span>
                  </div>
                  {item.customBuildNotes && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-2 italic">&quot;{item.customBuildNotes}&quot;</p>
                  )}
                  {item.customBuild && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-amber-500" />
                      <input
                        type="number"
                        value={quotePrices[idx] || ""}
                        onChange={(e) => setQuotePrices((prev) => ({ ...prev, [idx]: e.target.value }))}
                        placeholder="Precio final"
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold text-card-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      />
                    </div>
                  )}
                  {!item.customBuild && (
                    <p className="text-[10px] text-muted-foreground">
                      {(() => {
                        const extrasTotal = (item.extras || []).reduce((s: number, e: any) => s + (Number(e.price) || 0), 0)
                        const unitPrice = item.price + extrasTotal
                        const totalPrice = unitPrice * item.quantity
                        return `Precio: $${totalPrice.toLocaleString("es-CL")}`
                      })()}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-border space-y-3">
              {(() => {
                const itemsSubtotal = quoteModal.items.reduce((sum: number, item: any, idx: number) => {
                  const price = item.customBuild && quotePrices[idx]
                    ? Number(quotePrices[idx])
                    : (item.price + (item.extras || []).reduce((s: number, e: any) => s + (Number(e.price) || 0), 0))
                  return sum + price * item.quantity
                }, 0)
                const quoteDeliveryCost = quoteModal.delivery_type === "delivery" ? deliveryFee : 0
                const quoteTotal = itemsSubtotal + quoteDeliveryCost
                return (
                  <div className="space-y-1">
                    {quoteDeliveryCost > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Productos</span>
                        <span className="text-xs text-card-foreground">${itemsSubtotal.toLocaleString("es-CL")}</span>
                      </div>
                    )}
                    {quoteDeliveryCost > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">🚚 Delivery</span>
                        <span className="text-xs text-card-foreground">${quoteDeliveryCost.toLocaleString("es-CL")}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total estimado</span>
                      <span className="text-lg font-black text-card-foreground">${quoteTotal.toLocaleString("es-CL")}</span>
                    </div>
                  </div>
                )
              })()}
              <button
                onClick={handleQuoteSubmit}
                disabled={quoteSending}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {quoteSending ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {quoteSending ? "Enviando..." : "Cotizar y enviar por WhatsApp"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación re-descarga */}
      {redownloadConfirm && (() => {
        const order = orders.find((o) => o.id === redownloadConfirm.orderId)
        if (!order) return null
        const isComanda = redownloadConfirm.type === "comanda"
        return (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setRedownloadConfirm(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-card p-5 space-y-4 animate-in zoom-in-95 fade-in duration-200 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-card-foreground">Ya descargaste esta {isComanda ? "comanda" : "recibo"}</p>
                  <p className="text-[11px] text-muted-foreground">Pedido #{order.id}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">¿Deseas descargar{isComanda ? " la comanda" : " el recibo"} nuevamente?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setRedownloadConfirm(null)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (isComanda) {
                      downloadKitchenOrder(order, paperWidth, businessName, deliveryFee)
                    } else {
                      downloadOrderReceipt(order, paperWidth, logoUrl, businessName, storeAddress, deliveryFee)
                    }
                    setRedownloadConfirm(null)
                  }}
                  className="flex-1 rounded-xl bg-card-foreground text-background py-2.5 text-xs font-bold hover:opacity-90 transition-opacity"
                >
                  Descargar de nuevo
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal seleccionar fecha para cierre */}
      {cierreDateModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setCierreDateModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 fade-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileDown className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-bold text-card-foreground">Cierre del día</h3>
                </div>
                <button onClick={() => setCierreDateModal(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Selecciona la fecha para generar el cierre
              </p>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Fecha</label>
                <input
                  type="date"
                  value={selectedCierreDate}
                  onChange={(e) => setSelectedCierreDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border flex gap-3">
              <button
                onClick={() => setCierreDateModal(false)}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium border border-border text-muted-foreground hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!selectedCierreDate) return
                  setDownloadingCierre(true)
                  try {
                    // Pasar el string YYYY-MM-DD directamente para evitar problemas de zona horaria
                    const dayOrders = await getOrdersByDate(selectedCierreDate)
                    if (dayOrders.length === 0) {
                      const dateStr = new Date(selectedCierreDate + 'T12:00:00').toLocaleDateString("es-CL")
                      addToast(`No hay pedidos para el ${dateStr}`, "error")
                      return
                    }
                    const date = new Date(selectedCierreDate + 'T12:00:00')
                    await downloadDailyClosingComanda(dayOrders, paperWidth, businessName, deliveryFee, date)
                    addToast(`Cierre del ${date.toLocaleDateString("es-CL")} descargado`)
                    setCierreDateModal(false)
                  } catch (e) {
                    addToast("Error al generar cierre", "error")
                  } finally {
                    setDownloadingCierre(false)
                  }
                }}
                disabled={downloadingCierre || !selectedCierreDate}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {downloadingCierre ? "Generando..." : "Descargar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para aplicar descuento */}
      {discountModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setDiscountModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 fade-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-base font-bold text-card-foreground">Aplicar descuento</h3>
                </div>
                <button onClick={() => setDiscountModal(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pedido #{discountModal.id} — Total actual: ${discountModal.total.toLocaleString("es-CL")}
              </p>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Monto del descuento ($)</label>
                <input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="Ej: 5000"
                  min="1"
                  max={discountModal.total - 1}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Nuevo total: ${(discountModal.total - (Number(discountAmount) || 0)).toLocaleString("es-CL")}
                </p>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border flex gap-3">
              <button
                onClick={() => setDiscountModal(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium border border-border text-muted-foreground hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyDiscount}
                disabled={!discountAmount || Number(discountAmount) <= 0 || Number(discountAmount) >= discountModal.total}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
