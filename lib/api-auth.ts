import { NextRequest, NextResponse } from "next/server"

/**
 * Token compartido para proteger API routes internas.
 * Se genera automáticamente si no está configurado en env vars.
 * En producción, definir INTERNAL_API_SECRET en las variables de entorno.
 */
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || ""
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

/**
 * Verifica que un request a una API route interna tenga el token correcto.
 * Acepta INTERNAL_API_SECRET o NEXT_PUBLIC_SUPABASE_ANON_KEY como tokens válidos.
 * Retorna null si la verificación pasa, o un NextResponse con error 401 si falla.
 */
export function verifyInternalRequest(req: NextRequest): NextResponse | null {
  const token = req.headers.get("x-internal-token")
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (INTERNAL_SECRET && token === INTERNAL_SECRET) return null
  if (ANON_KEY && token === ANON_KEY) return null
  return NextResponse.json({ error: "No autorizado" }, { status: 401 })
}

/**
 * Headers que deben incluirse en fetch() a rutas internas desde el cliente.
 */
export function internalHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-internal-token": typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")
      : INTERNAL_SECRET,
  }
}
