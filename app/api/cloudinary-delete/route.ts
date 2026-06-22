import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { verifyInternalRequest } from "@/lib/api-auth"

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ""
const API_KEY = process.env.CLOUDINARY_API_KEY || ""
const API_SECRET = process.env.CLOUDINARY_API_SECRET || ""

/**
 * Extrae el public_id de una URL de Cloudinary.
 * Ej: https://res.cloudinary.com/du4lzw4tt/image/upload/v1234/pos-osaka/comprobantes/abc123.jpg
 * → pos-osaka/comprobantes/abc123
 */
function extractPublicId(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.*?)(?:\.\w+)?$/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const authError = verifyInternalRequest(req)
  if (authError) return authError

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return NextResponse.json({ error: "Cloudinary no configurado" }, { status: 500 })
  }

  const { url } = await req.json()
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL requerida" }, { status: 400 })
  }

  const publicId = extractPublicId(url)
  if (!publicId) {
    return NextResponse.json({ error: "No se pudo extraer public_id" }, { status: 400 })
  }

  // Generar firma para la API de Cloudinary
  const timestamp = Math.floor(Date.now() / 1000)
  const toSign = `public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`
  const signature = crypto.createHash("sha1").update(toSign).digest("hex")

  const formData = new URLSearchParams()
  formData.append("public_id", publicId)
  formData.append("timestamp", String(timestamp))
  formData.append("api_key", API_KEY)
  formData.append("signature", signature)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
    method: "POST",
    body: formData,
  })

  const data = await res.json()

  if (data.result === "ok" || data.result === "not found") {
    return NextResponse.json({ ok: true, result: data.result })
  }

  return NextResponse.json({ error: data.error?.message || "Error al eliminar", result: data.result }, { status: 500 })
}
