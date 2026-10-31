import { NextRequest, NextResponse } from "next/server"
import { sendMessage, isWhatsAppConfigured } from "@/lib/whatsapp"
import { getTodaySales } from "@/lib/supabase-orders"
import { getAllConfig, getConfigValue } from "@/lib/supabase-config"
import { verifyInternalRequest } from "@/lib/api-auth"

export async function POST(req: NextRequest) {
  const authError = verifyInternalRequest(req)
  if (authError) return authError

  if (!(await isWhatsAppConfigured())) {
    return NextResponse.json({ error: "WhatsApp no configurado" }, { status: 500 })
  }

  try {
    const config = await getAllConfig()
    const adminPhone = config.whatsappAdmin
    if (!adminPhone) {
      return NextResponse.json({ error: "No hay WhatsApp de admin configurado" }, { status: 400 })
    }

    const businessName = config.nombreNegocio || "Tu negocio"
    // Usar la ventana real del día laboral (Iniciar Día → Cerrar Día), que puede
    // cruzar la medianoche. Si no hay inicio registrado, cae a medianoche.
    const [lastStart, lastClose] = await Promise.all([getConfigValue("lastDayStart"), getConfigValue("lastDayClose")])
    const start = lastStart || undefined
    const close = start && lastClose && lastClose > start ? lastClose : undefined
    const { total, count } = await getTodaySales(start, close)
    const totalFmt = total.toLocaleString("es-CL")

    const message = count > 0
      ? `📊 *Resumen del día — ${businessName}*\n\n` +
        `📦 Pedidos: *${count}*\n` +
        `💰 Recaudación: *$${totalFmt}*\n` +
        `📈 Promedio: *$${Math.round(total / count).toLocaleString("es-CL")}* por pedido\n\n` +
        `¡Buen trabajo! 💪`
      : `📊 *Resumen del día — ${businessName}*\n\nNo hubo ventas registradas hoy.`

    const result = await sendMessage(adminPhone, message)
    if (!result) {
      return NextResponse.json({ error: "Error al enviar mensaje" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, count, total })
  } catch (err: any) {
    console.error("Daily summary error:", err)
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 })
  }
}
