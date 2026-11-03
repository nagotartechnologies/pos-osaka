import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto"
import { getAdminClient } from "@/lib/supabase-admin"
import type { StaffRole } from "@/lib/server/session"

/**
 * PINs del staff (solo servidor). Se guardan hasheados con scrypt en
 * config.pinAdminHash / config.pinVendedorHash. Las keys legacy en texto plano
 * (pinAdmin / pinVendedor) se migran al hash en el primer login exitoso.
 */

const HASH_KEY: Record<StaffRole, string> = { admin: "pinAdminHash", vendedor: "pinVendedorHash" }
const LEGACY_KEY: Record<StaffRole, string> = { admin: "pinAdmin", vendedor: "pinVendedor" }
const INITIAL_ENV: Record<StaffRole, string> = { admin: "INITIAL_ADMIN_PIN", vendedor: "INITIAL_VENDOR_PIN" }

export const PIN_REGEX = /^\d{4}$/

export function hashPin(pin: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(pin, salt, 32)
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`
}

function verifyHash(pin: string, stored: string): boolean {
  const [algo, saltHex, hashHex] = stored.split("$")
  if (algo !== "scrypt" || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, "hex")
  const actual = scryptSync(pin, Buffer.from(saltHex, "hex"), expected.length)
  return timingSafeEqual(actual, expected)
}

function plainEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export async function savePinHash(role: StaffRole, pin: string): Promise<boolean> {
  const sb = getAdminClient()
  const { error } = await sb.from("config").upsert({ key: HASH_KEY[role], value: hashPin(pin) }, { onConflict: "key" })
  if (error) { console.error("savePinHash error:", error); return false }
  await sb.from("config").delete().eq("key", LEGACY_KEY[role])
  return true
}

/** Devuelve el rol cuyo PIN coincide (admin tiene prioridad) o null. */
export async function resolveRoleForPin(pin: string): Promise<StaffRole | null> {
  const sb = getAdminClient()
  const keys = [HASH_KEY.admin, HASH_KEY.vendedor, LEGACY_KEY.admin, LEGACY_KEY.vendedor]
  const { data, error } = await sb.from("config").select("key, value").in("key", keys)
  if (error) { console.error("resolveRoleForPin error:", error); return null }
  const cfg: Record<string, string> = {}
  for (const r of data || []) cfg[r.key] = r.value

  for (const role of ["admin", "vendedor"] as StaffRole[]) {
    const hash = cfg[HASH_KEY[role]]
    if (hash) {
      if (verifyHash(pin, hash)) return role
      continue
    }
    const legacy = cfg[LEGACY_KEY[role]] || process.env[INITIAL_ENV[role]] || ""
    if (legacy && plainEqual(pin, legacy)) {
      await savePinHash(role, pin)
      return role
    }
  }
  return null
}

// ── Rate limit en memoria (por IP + global) ─────────────────────────
const WINDOW_MS = 10 * 60 * 1000
const MAX_FAILS_PER_IP = 5
const MAX_FAILS_GLOBAL = 30
const fails = new Map<string, { count: number; resetAt: number }>()

function bucket(key: string) {
  const now = Date.now()
  let b = fails.get(key)
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + WINDOW_MS }
    fails.set(key, b)
  }
  return b
}

export function isRateLimited(ip: string): boolean {
  return bucket(`ip:${ip}`).count >= MAX_FAILS_PER_IP || bucket("global").count >= MAX_FAILS_GLOBAL
}

export function registerFailure(ip: string): void {
  bucket(`ip:${ip}`).count++
  bucket("global").count++
}

export function clearFailures(ip: string): void {
  fails.delete(`ip:${ip}`)
}

export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") || headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown"
}
