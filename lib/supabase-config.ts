import { getSharedClient } from "@/lib/supabase"

// ─── Key-Value config store en Supabase ───

export async function getConfigValue(key: string): Promise<string | null> {
  const supabase = getSharedClient()
  const { data, error } = await supabase
    .from("config")
    .select("value")
    .eq("key", key)
    .single()
  if (error || !data) return null
  return data.value
}

export async function setConfigValue(key: string, value: string): Promise<boolean> {
  const supabase = getSharedClient()
  const { error } = await supabase
    .from("config")
    .upsert({ key, value }, { onConflict: "key" })
  if (error) { console.error("setConfigValue error:", error); return false }
  invalidateConfigCache()
  return true
}

let _configCache: Record<string, string> | null = null
let _configCacheTime = 0
const CONFIG_CACHE_TTL = 60_000 // 60 segundos

export async function getAllConfig(): Promise<Record<string, string>> {
  const now = Date.now()
  if (_configCache && now - _configCacheTime < CONFIG_CACHE_TTL) return _configCache

  const supabase = getSharedClient()
  // Excluir las imágenes base64 pesadas (logo, logoLight): se descargaban en
  // CADA llamada, y getAllConfig se invoca en casi todas las páginas + la carta
  // pública de cada cliente — era la causa #1 del egress de PostgREST. Para
  // mostrar el logo se usa logoPublicUrl (URL liviana) o el endpoint /api/logo.
  const { data, error } = await supabase
    .from("config")
    .select("key, value")
    .neq("key", "logo")
    .neq("key", "logoLight")
  if (error || !data) return _configCache || {}
  const result: Record<string, string> = {}
  data.forEach((row: { key: string; value: string }) => { result[row.key] = row.value })
  _configCache = result
  _configCacheTime = now
  return result
}

/**
 * Trae las imágenes base64 del logo (logo, logoLight) explícitamente.
 * Se mantienen FUERA de getAllConfig() para no descargarlas en cada llamada
 * (eran la causa #1 del egress). Usar SOLO donde se necesita el base64, p. ej.
 * la página de configuración para editar/re-subir el logo.
 */
export async function getLogoConfig(): Promise<{ logo: string; logoLight: string }> {
  const supabase = getSharedClient()
  const { data } = await supabase
    .from("config")
    .select("key, value")
    .in("key", ["logo", "logoLight"])
  const map: Record<string, string> = {}
  ;(data || []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value })
  return { logo: map.logo || "", logoLight: map.logoLight || "" }
}

export function invalidateConfigCache(): void {
  _configCache = null
  _configCacheTime = 0
  if (typeof window !== "undefined") {
    // Notificar a otras pestañas para que invaliden su cache local
    localStorage.setItem("pos-osaka-config-invalidate", String(Date.now()))
    // Notificar a la MISMA pestaña (el evento `storage` no se dispara en el
    // documento que hizo el cambio). Permite refrescar el estado sin polling.
    window.dispatchEvent(new Event("pos-osaka-config-changed"))
  }
}

// Escuchar invalidaciones de cache desde otras pestañas
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "pos-osaka-config-invalidate") {
      _configCache = null
      _configCacheTime = 0
    }
  })
}

export async function setMultipleConfig(entries: Record<string, string>): Promise<boolean> {
  const rows = Object.entries(entries).map(([key, value]) => ({ key, value }))
  if (rows.length === 0) return true
  const supabase = getSharedClient()
  const { error } = await supabase
    .from("config")
    .upsert(rows, { onConflict: "key" })
  if (error) { console.error("setMultipleConfig error:", error); return false }
  invalidateConfigCache()
  return true
}

export async function deleteConfigValue(key: string): Promise<boolean> {
  const supabase = getSharedClient()
  const { error } = await supabase.from("config").delete().eq("key", key)
  if (error) { console.error("deleteConfigValue error:", error); return false }
  return true
}

export async function isDayOpen(): Promise<boolean> {
  const [lastStart, lastClose] = await Promise.all([
    getConfigValue("lastDayStart"),
    getConfigValue("lastDayClose"),
  ])
  if (!lastStart) return false
  if (!lastClose) return true
  return lastStart > lastClose
}
