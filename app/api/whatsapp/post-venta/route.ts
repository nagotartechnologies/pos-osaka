import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendMessage, sendTyping, isGreenApiConfigured } from "@/lib/greenapi"
import { normalizePhone } from "@/lib/phone"
import { verifyInternalRequest } from "@/lib/api-auth"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

function getServerClient() {
  return createClient(supabaseUrl, supabaseKey)
}

export async function POST(req: NextRequest) {
  const authError = verifyInternalRequest(req)
  if (authError) return authError

  if (!isGreenApiConfigured()) {
    return NextResponse.json({ error: "GreenAPI no configurado" }, { status: 500 })
  }

  const sb = getServerClient()

  // Obtener config del negocio
  const { data: configRows } = await sb
    .from("config")
    .select("key, value")
    .in("key", ["nombreNegocio", "postVentaMsg", "lastPostVenta", "postVentaEnabled"])
  const cfg: Record<string, string> = {}
  ;(configRows || []).forEach((r: any) => { cfg[r.key] = r.value })

  const bizName = cfg.nombreNegocio || "nuestro restaurante"

  // Si está desactivado manualmente, no enviar
  if (cfg.postVentaEnabled !== "true") {
    return NextResponse.json({ ok: true, skipped: true, reason: "Post-venta desactivado" })
  }

  // Evitar enviar más de 1 vez al día
  const today = new Date().toISOString().split("T")[0]
  if (cfg.lastPostVenta === today) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Ya enviado hoy" })
  }

  // Buscar pedidos entregados de ayer (entre ayer 00:00 y hoy 00:00)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: deliveredOrders } = await sb
    .from("orders")
    .select("id, client_name, client_phone, total, address, delivery_type")
    .eq("status", "entregado")
    .gte("updated_at", yesterday.toISOString())
    .lt("updated_at", todayStart.toISOString())

  if (!deliveredOrders || deliveredOrders.length === 0) {
    // Marcar como enviado para no reintentar
    await sb.from("config").upsert({ key: "lastPostVenta", value: today })
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // Agrupar por teléfono normalizado para no enviar duplicados
  const sentPhones = new Set<string>()
  let sentCount = 0

  const defaultMsg = `¡Hola {nombre}! 😊\n\n¿Qué tal estuvo tu pedido de *${bizName}*? Tu opinión nos ayuda a mejorar.\n\n¡Gracias por preferirnos! 🙏`

  for (const order of deliveredOrders) {
    if (!order.client_phone) continue
    const phoneNorm = normalizePhone(order.client_phone)
    if (sentPhones.has(phoneNorm)) continue
    sentPhones.add(phoneNorm)

    const displayName = /^\+?\d{7,15}$/.test((order.client_name || "").replace(/[\s\-]/g, ""))
      ? (order.delivery_type === "delivery" && order.address?.trim() ? order.address.trim() : "Cliente")
      : (order.client_name || "")
    const msg = (cfg.postVentaMsg || defaultMsg)
      .replace(/\{nombre\}/g, displayName)
      .replace(/\{pedido\}/g, order.id || "")
      .replace(/\{negocio\}/g, bizName)

    try {
      await sendTyping(order.client_phone)
      await sendMessage(order.client_phone, msg)
      sentCount++
    } catch (e) {
      console.error("Post-venta send error:", e)
    }
  }

  // Marcar como enviado hoy
  await sb.from("config").upsert({ key: "lastPostVenta", value: today })

  return NextResponse.json({ ok: true, sent: sentCount })
}
