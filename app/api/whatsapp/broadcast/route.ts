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

  const { message, days = 30 } = await req.json()
  if (!message?.trim()) {
    return NextResponse.json({ error: "Mensaje requerido" }, { status: 400 })
  }

  const sb = getServerClient()

  // Obtener nombre del negocio para la variable {negocio}
  const { data: bizRow } = await sb.from("config").select("value").eq("key", "nombreNegocio").single()
  const bizName = bizRow?.value || ""

  // Buscar clientes únicos con pedidos en los últimos N días
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data: orders } = await sb
    .from("orders")
    .select("client_phone, client_name, address, delivery_type")
    .gte("created_at", since)
    .not("client_phone", "is", null)

  if (!orders || orders.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // Deduplicar por teléfono normalizado
  const sentPhones = new Set<string>()
  let sentCount = 0
  let errorCount = 0

  for (const order of orders) {
    if (!order.client_phone) continue
    const phoneNorm = normalizePhone(order.client_phone)
    if (!phoneNorm || sentPhones.has(phoneNorm)) continue
    sentPhones.add(phoneNorm)

    const displayName = /^\+?\d{7,15}$/.test((order.client_name || "").replace(/[\s\-]/g, ""))
      ? (order.delivery_type === "delivery" && order.address?.trim() ? order.address.trim() : "Cliente")
      : (order.client_name || "")
    const personalMsg = message
      .replace(/\{nombre\}/g, displayName)
      .replace(/\{negocio\}/g, bizName)

    try {
      await sendTyping(order.client_phone)
      const result = await sendMessage(order.client_phone, personalMsg)
      if (result) sentCount++
      else errorCount++
    } catch {
      errorCount++
    }

    // Rate limit: esperar 1s entre mensajes para no saturar GreenAPI
    if (sentPhones.size < orders.length) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  return NextResponse.json({ ok: true, sent: sentCount, errors: errorCount, total: sentPhones.size })
}
