import { NextRequest, NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"
import { addOrder, type AddOrderData, type OrderItem } from "@/lib/supabase-orders"
import { isDebitDeliveryBlocked } from "@/lib/debit-limit"
import { sendMessage, isWhatsAppConfigured } from "@/lib/whatsapp"
import { normalizePhone } from "@/lib/phone"
import { STORAGE_BUCKET } from "@/lib/supabase"
import { getEffectivePrice, isProductOnSchedule, type Product } from "@/lib/supabase-menu"
import { SALSAS } from "@/lib/carta-salsas"

/**
 * Crea un pedido desde la carta pública. anon ya no puede leer ni escribir
 * la tabla orders: todo pasa por aquí, validado en el servidor.
 */

const RECEIPT_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}/storage/v1/object/public/${STORAGE_BUCKET}/pos-osaka/comprobantes/`

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)

interface RawItem {
  id: string
  quantity: number
  category: string
  notes: string
  customBuild: boolean
  customBuildNotes: string
  proteinName: string
  wrapperName: string
  unitExtras: string[]
}

function sanitizeItems(raw: unknown): RawItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) return null
  const items: RawItem[] = []
  for (const it of raw) {
    const quantity = num(it?.quantity)
    const id = str(it?.id, 100)
    if (!id || quantity === null || quantity < 1 || quantity > 100) return null
    // Extras descriptivos (elecciones por unidad, p. ej. "2x Salmón"): siempre $0.
    // Proteína/envoltura se reconstruyen en el servidor desde el producto.
    const unitExtras = Array.isArray(it.extras)
      ? it.extras.slice(0, 20).map((e: any) => str(e?.description, 200))
          .filter((d: string) => d && !d.startsWith("Proteína:") && !d.startsWith("Envoltura:"))
      : []
    items.push({
      id,
      quantity: Math.floor(quantity),
      category: str(it.category, 100),
      notes: str(it.notes, 500),
      customBuild: it.customBuild === true,
      customBuildNotes: str(it.customBuildNotes, 1000),
      proteinName: str(it.proteinName, 200),
      wrapperName: str(it.wrapperName, 200),
      unitExtras,
    })
  }
  return items
}

type PricingResult = { items: OrderItem[]; subtotal: number } | { error: string }

/** Recalcula precios desde la tabla products (con descuentos vigentes). */
async function priceItems(raw: RawItem[]): Promise<PricingResult> {
  const productIds = [...new Set(raw.filter((i) => !i.id.startsWith("salsa-")).map((i) => i.id))]
  const { data: products, error } = productIds.length
    ? await getAdminClient().from("products").select("*").in("id", productIds)
    : { data: [] as Product[], error: null }
  if (error) return { error: "No se pudo validar el pedido" }
  const byId = new Map(((products || []) as Product[]).map((p) => [p.id, p]))
  const now = Date.now()

  const items: OrderItem[] = []
  let subtotal = 0
  for (const it of raw) {
    const salsa = SALSAS.find((s) => s.id === it.id)
    if (salsa) {
      items.push({ id: salsa.id, name: salsa.name, price: salsa.price, quantity: it.quantity, category: salsa.category, notes: it.notes, customBuild: false, customBuildNotes: "" })
      subtotal += salsa.price * it.quantity
      continue
    }
    const p = byId.get(it.id)
    if (!p || !p.available) return { error: "Uno de los productos ya no está disponible. Revisa tu carrito." }
    if (!isProductOnSchedule(p, now)) return { error: `"${p.name}" ya no está disponible en este horario.` }

    const extras: { description: string; price: number }[] = it.unitExtras.map((d) => ({ description: d, price: 0 }))
    let extrasTotal = 0
    if (it.proteinName) {
      const opt = (p.protein_options || []).find((o) => o.name === it.proteinName)
      if (!opt) return { error: `La opción "${it.proteinName}" ya no está disponible.` }
      extras.push({ description: `Proteína: ${opt.name}`, price: Number(opt.price) || 0 })
      extrasTotal += Number(opt.price) || 0
    }
    if (it.wrapperName) {
      const opt = (p.wrapper_options || []).find((o) => o.name === it.wrapperName)
      if (!opt) return { error: `La opción "${it.wrapperName}" ya no está disponible.` }
      extras.push({ description: `Envoltura: ${opt.name}`, price: Number(opt.price) || 0 })
      extrasTotal += Number(opt.price) || 0
    }

    const unit = getEffectivePrice(p, now)
    items.push({
      id: p.id,
      name: p.name,
      price: unit,
      quantity: it.quantity,
      category: it.category || p.category,
      notes: it.notes,
      extras: extras.length > 0 ? extras : undefined,
      customBuild: it.customBuild,
      customBuildNotes: it.customBuildNotes,
    })
    subtotal += (unit + extrasTotal) * it.quantity
  }
  return { items, subtotal }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })

  const sb = getAdminClient()
  const { data: cfgRows } = await sb
    .from("config")
    .select("key, value")
    .in("key", ["cartaCode", "ordersBlocked", "lastDayStart", "lastDayClose", "nombreNegocio", "deliveryFee"])
  const cfg: Record<string, string> = {}
  for (const r of cfgRows || []) cfg[r.key] = r.value

  if (!cfg.cartaCode || body.code !== cfg.cartaCode) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const dayIsOpen = !!cfg.lastDayStart && (!cfg.lastDayClose || cfg.lastDayStart > cfg.lastDayClose)
  if (!dayIsOpen) return NextResponse.json({ error: "El local está cerrado" }, { status: 409 })
  if (cfg.ordersBlocked === "true") return NextResponse.json({ error: "No estamos recibiendo pedidos" }, { status: 409 })

  const o = body.order || {}
  const rawItems = sanitizeItems(o.items)
  const clientTotal = num(o.total)
  const clientPhone = str(o.clientPhone, 30)
  const deliveryType = o.deliveryType === "retiro" ? "retiro" : o.deliveryType === "delivery" ? "delivery" : null
  const paymentMethod = ["efectivo", "transferencia", "tarjeta"].includes(o.paymentMethod) ? o.paymentMethod : null
  const cardType = paymentMethod === "tarjeta" && ["debito", "credito"].includes(o.cardType) ? o.cardType : null
  const address = deliveryType === "delivery" ? str(o.address, 300) : ""
  const receiptUrl = str(o.receiptUrl, 500)

  if (!rawItems || clientTotal === null || !deliveryType || !paymentMethod) {
    return NextResponse.json({ error: "Datos del pedido inválidos" }, { status: 400 })
  }
  if (normalizePhone(clientPhone).length < 8) return NextResponse.json({ error: "Teléfono inválido" }, { status: 400 })
  if (deliveryType === "delivery" && !address) return NextResponse.json({ error: "Dirección requerida" }, { status: 400 })
  if (paymentMethod === "tarjeta" && !cardType) return NextResponse.json({ error: "Tipo de tarjeta requerido" }, { status: 400 })
  if (receiptUrl && !receiptUrl.startsWith(RECEIPT_PREFIX)) {
    return NextResponse.json({ error: "Comprobante inválido" }, { status: 400 })
  }
  if (deliveryType === "delivery" && cardType === "debito" && (await isDebitDeliveryBlocked())) {
    return NextResponse.json({ error: "Débito no disponible para delivery en este momento" }, { status: 409 })
  }

  // Precio real calculado en el servidor: se ignora lo que mande el navegador
  const priced = await priceItems(rawItems)
  if ("error" in priced) return NextResponse.json({ error: priced.error, code: "PRICE_MISMATCH" }, { status: 409 })
  const deliveryFee = deliveryType === "delivery" ? Number(cfg.deliveryFee) || 0 : 0
  const total = priced.subtotal + deliveryFee
  if (Math.round(total) !== Math.round(clientTotal)) {
    return NextResponse.json(
      { error: "Los precios de la carta cambiaron. Revisa el total actualizado e intenta de nuevo.", code: "PRICE_MISMATCH", total },
      { status: 409 },
    )
  }
  const cashAmount = paymentMethod === "efectivo" ? num(o.cashAmount) : null

  const data: AddOrderData = {
    items: priced.items,
    total,
    clientName: str(o.clientName, 120) || clientPhone,
    clientPhone,
    deliveryType,
    address,
    paymentMethod,
    cardType,
    cashAmount,
    change: cashAmount !== null && cashAmount > total ? cashAmount - total : paymentMethod === "efectivo" ? 0 : null,
    receiptUrl: receiptUrl || null,
  }

  const order = await addOrder(data)
  if (!order) return NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 500 })

  // Confirmación por WhatsApp al cliente (best-effort, no bloquea la respuesta)
  if (await isWhatsAppConfigured()) {
    const businessName = cfg.nombreNegocio || "Osaka Sushi Restaurant"
    const name = str(o.clientName, 120)
    const msg = `¡Hola ${name}! 🍣\n\nTu pedido *#${order.id}* ya está en manos de *${businessName}*.\n\nTe avisaremos por WhatsApp cuando comencemos a prepararlo.\n\n¡Gracias por preferirnos!`
    sendMessage(clientPhone, msg).catch((err) => console.error("Error enviando confirmación WhatsApp:", err))
  }

  return NextResponse.json({ id: order.id })
}
