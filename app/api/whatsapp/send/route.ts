import { NextRequest, NextResponse } from "next/server"
import { sendMessage, sendFileByUpload, sendFileByUrl, sendTyping, isGreenApiConfigured } from "@/lib/greenapi"
import { verifyInternalRequest } from "@/lib/api-auth"

export async function POST(req: NextRequest) {
  const authError = verifyInternalRequest(req)
  if (authError) return authError

  if (!isGreenApiConfigured()) {
    return NextResponse.json({ error: "GreenAPI no configurado" }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { phone, message, type, fileBase64, fileUrl, fileName, caption } = body

    if (!phone) {
      return NextResponse.json({ error: "Teléfono requerido" }, { status: 400 })
    }

    // Enviar archivo por URL (PDF desde Cloudinary)
    if (type === "url" && fileUrl && fileName) {
      const result = await sendFileByUrl(phone, fileUrl, fileName, caption)
      if (!result) {
        return NextResponse.json({ error: "Error al enviar archivo por URL" }, { status: 500 })
      }
      return NextResponse.json({ ok: true, idMessage: result.idMessage })
    }

    // Enviar archivo por base64 (fallback)
    if (type === "file" && fileBase64 && fileName) {
      const result = await sendFileByUpload(phone, fileBase64, fileName, caption)
      if (!result) {
        return NextResponse.json({ error: "Error al enviar archivo" }, { status: 500 })
      }
      return NextResponse.json({ ok: true, idMessage: result.idMessage })
    }

    // Enviar mensaje de texto
    if (!message) {
      return NextResponse.json({ error: "Mensaje requerido" }, { status: 400 })
    }

    // Mostrar "escribiendo..." (best-effort, no bloqueante): evita añadir un
    // round-trip extra a GreenAPI antes de cada mensaje real.
    sendTyping(phone).catch(() => {})

    const result = await sendMessage(phone, message)
    if (!result) {
      return NextResponse.json({ error: "Error al enviar mensaje" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, idMessage: result.idMessage })
  } catch (err: any) {
    console.error("WhatsApp send error:", err)
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 })
  }
}
