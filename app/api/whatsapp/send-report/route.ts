import { NextRequest, NextResponse } from "next/server"
import { sendFileByUpload, isGreenApiConfigured } from "@/lib/greenapi"
import { getAllConfig } from "@/lib/supabase-config"
import { verifyInternalRequest } from "@/lib/api-auth"

export async function POST(req: NextRequest) {
  const authError = verifyInternalRequest(req)
  if (authError) return authError

  if (!isGreenApiConfigured()) {
    return NextResponse.json({ error: "GreenAPI no configurado" }, { status: 500 })
  }

  try {
    const { fileBase64, fileName, caption } = await req.json()

    if (!fileBase64 || !fileName) {
      return NextResponse.json({ error: "Faltan parámetros: fileBase64, fileName" }, { status: 400 })
    }

    const config = await getAllConfig()
    const adminPhone = config.whatsappAdmin
    if (!adminPhone) {
      return NextResponse.json({ error: "No hay WhatsApp de admin configurado en ajustes" }, { status: 400 })
    }

    const result = await sendFileByUpload(adminPhone, fileBase64, fileName, caption || "")
    if (!result) {
      return NextResponse.json({ error: "Error al enviar archivo por WhatsApp" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, idMessage: result.idMessage })
  } catch (err: any) {
    console.error("send-report error:", err)
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 })
  }
}
