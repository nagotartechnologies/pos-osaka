import { NextRequest, NextResponse } from "next/server"
import { sendMessage, isGreenApiConfigured } from "@/lib/greenapi"
import { getAllConfig } from "@/lib/supabase-config"
import { verifyInternalRequest } from "@/lib/api-auth"

export async function POST(req: NextRequest) {
  const authError = verifyInternalRequest(req)
  if (authError) return authError

  if (!isGreenApiConfigured()) {
    return NextResponse.json({ error: "GreenAPI no configurado" }, { status: 500 })
  }

  try {
    const config = await getAllConfig()
    const adminPhone = config.whatsappAdmin
    if (!adminPhone) {
      return NextResponse.json({ error: "No hay WhatsApp de admin configurado" }, { status: 400 })
    }

    const { message } = await req.json()
    if (!message) {
      return NextResponse.json({ error: "Mensaje requerido" }, { status: 400 })
    }

    const result = await sendMessage(adminPhone, message)
    if (!result) {
      return NextResponse.json({ error: "Error al enviar mensaje" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, idMessage: result.idMessage })
  } catch (err: any) {
    console.error("Notify admin error:", err)
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 })
  }
}
