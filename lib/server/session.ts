/**
 * Sesión del staff (solo servidor).
 * - Cookie httpOnly firmada con HMAC-SHA256 que guarda { role, exp }.
 * - JWT de Supabase (HS256) con role "authenticated" + app_role, firmado con
 *   el JWT_SECRET del backend, para que el navegador consulte la base con RLS.
 * Usa Web Crypto para funcionar tanto en proxy.ts como en API routes.
 */

export type StaffRole = "admin" | "vendedor"

export interface StaffSession {
  role: StaffRole
  exp: number // epoch ms
}

export const SESSION_COOKIE = "pos_session"
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000
const SUPABASE_JWT_TTL_MS = 60 * 60 * 1000

const enc = new TextEncoder()

function sessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.INTERNAL_API_SECRET || ""
}

function b64url(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function b64urlFromString(s: string): string {
  return b64url(enc.encode(s))
}

function stringFromB64url(s: string): string {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : ""
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad)
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data))
  return b64url(new Uint8Array(sig))
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function createSessionValue(role: StaffRole): Promise<{ value: string; exp: number }> {
  const secret = sessionSecret()
  if (!secret) throw new Error("SESSION_SECRET no configurado")
  const exp = Date.now() + SESSION_TTL_MS
  const payload = b64urlFromString(JSON.stringify({ role, exp }))
  return { value: `${payload}.${await hmac(secret, payload)}`, exp }
}

export async function verifySessionValue(value: string | undefined | null): Promise<StaffSession | null> {
  const secret = sessionSecret()
  if (!value || !secret) return null
  const [payload, sig] = value.split(".")
  if (!payload || !sig) return null
  if (!safeEqual(sig, await hmac(secret, payload))) return null
  try {
    const data = JSON.parse(stringFromB64url(payload)) as StaffSession
    if (data.role !== "admin" && data.role !== "vendedor") return null
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null
    return data
  } catch {
    return null
  }
}

type CookieReader = { cookies: { get(name: string): { value: string } | undefined } }

export function getSession(req: CookieReader): Promise<StaffSession | null> {
  return verifySessionValue(req.cookies.get(SESSION_COOKIE)?.value)
}

export function sessionCookieOptions(exp: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(exp),
  }
}

/** JWT para PostgREST/Realtime/Storage. null si no hay SUPABASE_JWT_SECRET. */
export async function signSupabaseJwt(session: StaffSession): Promise<{ token: string; exp: number } | null> {
  const secret = process.env.SUPABASE_JWT_SECRET || ""
  if (!secret) return null
  const exp = Math.min(session.exp, Date.now() + SUPABASE_JWT_TTL_MS)
  const header = b64urlFromString(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = b64urlFromString(JSON.stringify({
    role: "authenticated",
    aud: "authenticated",
    iss: "pos-osaka",
    // UUID fijo por rol: Storage guarda `sub` como owner (columna uuid)
    sub: session.role === "admin" ? "00000000-0000-4000-8000-000000000001" : "00000000-0000-4000-8000-000000000002",
    app_role: session.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(exp / 1000),
  }))
  const unsigned = `${header}.${body}`
  return { token: `${unsigned}.${await hmac(secret, unsigned)}`, exp }
}
