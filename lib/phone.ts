/**
 * Utilidades para normalizar y comparar números de teléfono.
 * Los teléfonos chilenos pueden llegar en distintos formatos:
 *   - "912345678"        (9 dígitos, sin código de país)
 *   - "56912345678"      (11 dígitos, con código 56)
 *   - "+56912345678"     (con +)
 *   - "56 9 1234 5678"   (con espacios)
 * Esta utilidad normaliza todo a los últimos 9 dígitos para comparar.
 */

/** Retorna los últimos 9 dígitos del teléfono (sin espacios ni símbolos). */
export function normalizePhone(phone: string): string {
  if (!phone) return ""
  return phone.replace(/[^0-9]/g, "").slice(-9)
}

/** Retorna true si dos teléfonos corresponden al mismo número. */
export function samePhone(a: string, b: string): boolean {
  const na = normalizePhone(a)
  const nb = normalizePhone(b)
  if (!na || !nb) return false
  return na === nb
}

/** Retorna el chatId virtual para un teléfono dado (CHAT-{últimos9}). */
export function chatIdFromPhone(phone: string): string {
  return `CHAT-${normalizePhone(phone)}`
}
