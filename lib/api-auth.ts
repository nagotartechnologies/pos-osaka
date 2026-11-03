import { NextRequest, NextResponse } from "next/server"
import { getSession, type StaffRole } from "@/lib/server/session"

/**
 * Protege las API routes internas. Acepta:
 *  - la cookie de sesión del staff (llamadas desde el navegador), o
 *  - el header x-internal-token = INTERNAL_API_SECRET (servidor a servidor / cron).
 * La anon key de Supabase YA NO es un token válido (es pública).
 * Retorna null si pasa, o un NextResponse 401/403 si falla.
 */
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || ""

export async function verifyInternalRequest(req: NextRequest, requiredRole?: StaffRole): Promise<NextResponse | null> {
  const token = req.headers.get("x-internal-token")
  if (INTERNAL_SECRET && token && token === INTERNAL_SECRET) return null

  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (requiredRole === "admin" && session.role !== "admin") {
    return NextResponse.json({ error: "Requiere rol administrador" }, { status: 403 })
  }
  return null
}

/**
 * Headers para fetch() a rutas internas. Desde el navegador basta la cookie
 * (same-origin); desde el servidor se envía INTERNAL_API_SECRET.
 */
export function internalHeaders(): Record<string, string> {
  return typeof window !== "undefined"
    ? { "Content-Type": "application/json" }
    : { "Content-Type": "application/json", "x-internal-token": INTERNAL_SECRET }
}
