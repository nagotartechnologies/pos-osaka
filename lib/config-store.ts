/**
 * Almacena y recupera la configuración de Supabase desde localStorage.
 * Esto permite que las credenciales configuradas en /configuracion
 * estén disponibles en /menu para subir imágenes.
 */

const SUPABASE_CONFIG_KEY = "pos-osaka-supabase-config"
const LOGO_DARK_KEY = "pos-osaka-logo"
const LOGO_LIGHT_KEY = "pos-osaka-logo-light"
const BUSINESS_NAME_KEY = "pos-osaka-business-name"

export function saveLogo(logoDataUrl: string, variant: "dark" | "light" = "dark"): void {
  if (typeof window === "undefined") return
  localStorage.setItem(variant === "light" ? LOGO_LIGHT_KEY : LOGO_DARK_KEY, logoDataUrl)
}

export function loadLogo(variant?: "dark" | "light"): string {
  if (typeof window === "undefined") return ""
  if (variant) {
    return localStorage.getItem(variant === "light" ? LOGO_LIGHT_KEY : LOGO_DARK_KEY) || ""
  }
  // Sin variante: retorna el logo oscuro (por defecto)
  return localStorage.getItem(LOGO_DARK_KEY) || ""
}

export function loadLogoForTheme(resolvedTheme: string | undefined): string {
  if (typeof window === "undefined") return ""
  if (resolvedTheme === "light") {
    const light = localStorage.getItem(LOGO_LIGHT_KEY)
    if (light) return light
  }
  return localStorage.getItem(LOGO_DARK_KEY) || ""
}

export function removeLogo(variant?: "dark" | "light"): void {
  if (typeof window === "undefined") return
  if (!variant || variant === "dark") localStorage.removeItem(LOGO_DARK_KEY)
  if (!variant || variant === "light") localStorage.removeItem(LOGO_LIGHT_KEY)
}

export function saveBusinessName(name: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(BUSINESS_NAME_KEY, name)
}

export function loadBusinessName(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(BUSINESS_NAME_KEY) || ""
}

const CATEGORIES_KEY = "pos-osaka-categories"

export interface CustomCategory {
  id: string
  name: string
}

export function saveCategories(cats: CustomCategory[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats))
}

export function loadCategories(): CustomCategory[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export interface SupabaseConfigData {
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceKey: string
  instanceName: string
}

export function saveSupabaseConfig(config: SupabaseConfigData): void {
  if (typeof window === "undefined") return
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config))
}

export function loadSupabaseConfig(): SupabaseConfigData {
  if (typeof window === "undefined") {
    return { supabaseUrl: "", supabaseAnonKey: "", supabaseServiceKey: "", instanceName: "" }
  }
  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_KEY)
    if (!raw) return { supabaseUrl: "", supabaseAnonKey: "", supabaseServiceKey: "", instanceName: "" }
    return JSON.parse(raw)
  } catch {
    return { supabaseUrl: "", supabaseAnonKey: "", supabaseServiceKey: "", instanceName: "" }
  }
}

// --- WhatsApp tienda ---
const WHATSAPP_KEY = "pos-osaka-whatsapp"

export function saveWhatsApp(phone: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(WHATSAPP_KEY, phone)
}

export function loadWhatsApp(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(WHATSAPP_KEY) || ""
}

// --- Datos bancarios ---
const BANK_KEY = "pos-osaka-bank"

export interface BankData {
  banco: string
  tipoCuenta: string
  numeroCuenta: string
  rut: string
  titular: string
}

const EMPTY_BANK: BankData = { banco: "", tipoCuenta: "", numeroCuenta: "", rut: "", titular: "" }

export function saveBankData(data: BankData): void {
  if (typeof window === "undefined") return
  localStorage.setItem(BANK_KEY, JSON.stringify(data))
}

export function loadBankData(): BankData {
  if (typeof window === "undefined") return EMPTY_BANK
  try {
    const raw = localStorage.getItem(BANK_KEY)
    if (!raw) return EMPTY_BANK
    return JSON.parse(raw)
  } catch {
    return EMPTY_BANK
  }
}

// --- Dirección del local ---
const ADDRESS_KEY = "pos-osaka-address"

export function saveAddress(addr: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ADDRESS_KEY, addr)
}

export function loadAddress(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(ADDRESS_KEY) || ""
}

// --- Auth con roles ---
// La sesión real vive en una cookie httpOnly validada por el servidor
// (/api/auth/*). En localStorage solo queda un "hint" de rol y expiración para
// la UI: alterarlo no da acceso a datos (proxy.ts + RLS lo impiden).
const AUTH_KEY = "pos-osaka-auth"
const ROLE_HINT_KEY = AUTH_KEY + "-role"
const EXP_HINT_KEY = AUTH_KEY + "-exp"

export type UserRole = "admin" | "vendedor"

// Limpieza de claves legacy que exponían PINs y sesión en localStorage
if (typeof window !== "undefined") {
  for (const k of ["-pin-admin", "-pin-vendedor", "-session", "-session-ts"]) localStorage.removeItem(AUTH_KEY + k)
}

function saveHint(role: UserRole, sessionExp: number): void {
  localStorage.setItem(ROLE_HINT_KEY, role)
  localStorage.setItem(EXP_HINT_KEY, String(sessionExp))
}

function clearHint(): void {
  localStorage.removeItem(ROLE_HINT_KEY)
  localStorage.removeItem(EXP_HINT_KEY)
}

/**
 * Valida el PIN en el servidor. Si es correcto, el servidor setea la cookie de
 * sesión y devuelve el token para consultar Supabase.
 */
export async function loginWithPin(pin: string): Promise<{ role?: UserRole; error?: string }> {
  if (typeof window === "undefined") return { error: "No disponible" }
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ pin }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return { error: j.error || "PIN incorrecto" }
    const { setSessionToken } = await import("@/lib/supabase")
    setSessionToken(j.token, j.exp)
    saveHint(j.role, j.sessionExp)
    return { role: j.role }
  } catch {
    return { error: "Error de conexión" }
  }
}

/** Cambia el PIN de un rol (solo admin, validado en el servidor). */
export async function savePinToSupabase(pin: string, role: UserRole): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ pin, role }),
    })
    const j = await res.json().catch(() => ({}))
    return res.ok ? { ok: true } : { ok: false, error: j.error || "No se pudo guardar el PIN" }
  } catch {
    return { ok: false, error: "Error de conexión" }
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return
  clearHint()
  import("@/lib/supabase").then(({ clearSessionToken }) => clearSessionToken()).catch(() => {})
  fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => {})
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  const role = localStorage.getItem(ROLE_HINT_KEY)
  const exp = Number(localStorage.getItem(EXP_HINT_KEY) || "0")
  if (!role || !exp || exp < Date.now()) {
    clearHint()
    return false
  }
  return true
}

export function getUserRole(): UserRole {
  if (typeof window === "undefined") return "vendedor"
  return localStorage.getItem(ROLE_HINT_KEY) === "admin" ? "admin" : "vendedor"
}

// Si el servidor rechaza la cookie (expirada o revocada), cerrar sesión en la UI
if (typeof window !== "undefined") {
  window.addEventListener("pos-osaka-session-expired", () => {
    if (!localStorage.getItem(ROLE_HINT_KEY)) return
    clearHint()
    if (!["/login", "/carta"].some((p) => window.location.pathname.startsWith(p))) window.location.replace("/login")
  })
}
