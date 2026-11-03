import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/server/session"
import { PIN_REGEX, savePinHash } from "@/lib/server/pin"

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.role !== "admin") return NextResponse.json({ error: "Solo el administrador puede cambiar PINs" }, { status: 403 })

  const { role, pin } = await req.json().catch(() => ({}))
  if (role !== "admin" && role !== "vendedor") return NextResponse.json({ error: "Rol inválido" }, { status: 400 })
  if (typeof pin !== "string" || !PIN_REGEX.test(pin)) {
    return NextResponse.json({ error: "El PIN debe tener exactamente 4 dígitos" }, { status: 400 })
  }

  const ok = await savePinHash(role, pin)
  if (!ok) return NextResponse.json({ error: "No se pudo guardar el PIN" }, { status: 500 })
  return NextResponse.json({ ok: true })
}
