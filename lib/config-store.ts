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
const AUTH_KEY = "pos-osaka-auth"
const DEFAULT_ADMIN_PIN = "1234"
const DEFAULT_VENDOR_PIN = "0000"

export type UserRole = "admin" | "vendedor"

export function checkPin(pin: string): UserRole | null {
  if (typeof window === "undefined") return null
  const adminPin = localStorage.getItem(AUTH_KEY + "-pin-admin") || DEFAULT_ADMIN_PIN
  const vendorPin = localStorage.getItem(AUTH_KEY + "-pin-vendedor") || DEFAULT_VENDOR_PIN
  if (pin === adminPin) return "admin"
  if (pin === vendorPin) return "vendedor"
  return null
}

/**
 * Verifica PIN contra Supabase config, con fallback a localStorage.
 */
export async function checkPinAsync(pin: string): Promise<UserRole | null> {
  if (typeof window === "undefined") return null
  try {
    const { getAllConfig } = await import("@/lib/supabase-config")
    const cfg = await getAllConfig()
    const adminPin = cfg.pinAdmin || localStorage.getItem(AUTH_KEY + "-pin-admin") || DEFAULT_ADMIN_PIN
    const vendorPin = cfg.pinVendedor || localStorage.getItem(AUTH_KEY + "-pin-vendedor") || DEFAULT_VENDOR_PIN
    // Sincronizar a localStorage para acceso rápido futuro
    if (cfg.pinAdmin) localStorage.setItem(AUTH_KEY + "-pin-admin", cfg.pinAdmin)
    if (cfg.pinVendedor) localStorage.setItem(AUTH_KEY + "-pin-vendedor", cfg.pinVendedor)
    if (pin === adminPin) return "admin"
    if (pin === vendorPin) return "vendedor"
    return null
  } catch {
    // Fallback a localStorage si Supabase falla
    return checkPin(pin)
  }
}

export function savePin(pin: string, role?: UserRole): void {
  if (typeof window === "undefined") return
  if (role) {
    localStorage.setItem(AUTH_KEY + "-pin-" + role, pin)
  } else {
    localStorage.setItem(AUTH_KEY + "-pin-admin", pin)
  }
}

/**
 * Guarda PIN en Supabase config además de localStorage.
 */
export async function savePinToSupabase(pin: string, role: UserRole): Promise<void> {
  savePin(pin, role)
  try {
    const { setConfigValue } = await import("@/lib/supabase-config")
    const key = role === "admin" ? "pinAdmin" : "pinVendedor"
    await setConfigValue(key, pin)
  } catch {
    // Si falla Supabase, al menos queda en localStorage
  }
}

export function loadPin(role: UserRole): string {
  if (typeof window === "undefined") return ""
  const key = AUTH_KEY + "-pin-" + role
  const defaultPin = role === "admin" ? DEFAULT_ADMIN_PIN : DEFAULT_VENDOR_PIN
  return localStorage.getItem(key) || defaultPin
}

const SESSION_TTL = 24 * 60 * 60 * 1000 // 24 horas

export function setSession(role: UserRole = "admin"): void {
  if (typeof window === "undefined") return
  localStorage.setItem(AUTH_KEY + "-session", "1")
  localStorage.setItem(AUTH_KEY + "-role", role)
  localStorage.setItem(AUTH_KEY + "-session-ts", String(Date.now()))
}

export function clearSession(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(AUTH_KEY + "-session")
  localStorage.removeItem(AUTH_KEY + "-role")
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  if (localStorage.getItem(AUTH_KEY + "-session") !== "1") return false
  const ts = Number(localStorage.getItem(AUTH_KEY + "-session-ts") || "0")
  if (ts && Date.now() - ts > SESSION_TTL) {
    clearSession()
    return false
  }
  return true
}

export function getUserRole(): UserRole {
  if (typeof window === "undefined") return "vendedor"
  return (localStorage.getItem(AUTH_KEY + "-role") as UserRole) || "admin"
}
