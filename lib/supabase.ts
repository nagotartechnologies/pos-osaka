import { createClient, SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js"

export const STORAGE_BUCKET = "media"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// ── Token de sesión del staff (JWT emitido por /api/auth/*) ─────
// Sin sesión válida se usa la anon key, que con RLS solo puede leer el menú.
let _token: string | null = null
let _tokenExp = 0
let _noSessionUntil = 0
let _inflight: Promise<string | null> | null = null

const PUBLIC_PATHS = ["/carta", "/login"]
const isPublicPath = () => typeof window !== "undefined" && PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p))

export function setSessionToken(token: string | null, exp: number | null): void {
  _token = token
  _tokenExp = exp || 0
  _noSessionUntil = 0
  // Sin argumento: Realtime usa el callback accessToken, así el heartbeat
  // renueva el JWT antes de que expire y lo reenvía a los canales abiertos.
  if (_shared) _shared.realtime.setAuth()
}

export function clearSessionToken(): void {
  _token = null
  _tokenExp = 0
  if (_shared) _shared.realtime.setAuth(ANON_KEY)
}

async function fetchSessionToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
    if (!res.ok) {
      _noSessionUntil = Date.now() + 30_000
      if (res.status === 401) window.dispatchEvent(new Event("pos-osaka-session-expired"))
      return null
    }
    const j = await res.json()
    setSessionToken(j.token, j.exp)
    return j.token
  } catch {
    return null
  }
}

async function getAccessToken(): Promise<string> {
  if (_token && Date.now() < _tokenExp - 60_000) return _token
  if (isPublicPath() || Date.now() < _noSessionUntil) return ANON_KEY
  if (!_inflight) _inflight = fetchSessionToken().finally(() => { _inflight = null })
  return (await _inflight) || ANON_KEY
}

// ── Cliente compartido (singleton global) ───────────────────────
let _shared: SupabaseClient | null = null

export function getSharedClient(): SupabaseClient {
  if (_shared) return _shared
  if (typeof window === "undefined") {
    // En el servidor se usa service_role (la key nunca llega al bundle del cliente).
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    _shared = createClient(SUPABASE_URL, serviceKey || ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    return _shared
  }
  _shared = createClient(SUPABASE_URL, ANON_KEY, { accessToken: getAccessToken })
  return _shared
}

/**
 * Suscribe un canal Realtime recién cuando el JWT de sesión está cargado.
 * Si se suscribe antes, el join queda en buffer sin token, el servidor lo
 * registra como anon y la RLS no le entrega eventos (orders, chat, etc.).
 */
export function subscribeWithAuth(
  channel: RealtimeChannel,
  callback?: Parameters<RealtimeChannel["subscribe"]>[0],
): RealtimeChannel {
  const sb = getSharedClient()
  sb.realtime
    .setAuth()
    .catch(() => {})
    .finally(() => {
      if (sb.getChannels().includes(channel)) channel.subscribe(callback)
    })
  return channel
}

/**
 * Sube una imagen al bucket de Supabase Storage.
 * Retorna la URL pública de la imagen.
 */
export async function uploadProductImage(
  supabase: SupabaseClient,
  file: File,
  productId: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg"
  const fileName = `${productId}-${Date.now()}.${ext}`
  const filePath = `menu/${fileName}`

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    })

  if (error) throw error

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath)

  return data.publicUrl
}

/**
 * Elimina una imagen del bucket de Supabase Storage.
 */
export async function deleteProductImage(
  supabase: SupabaseClient,
  imageUrl: string
): Promise<void> {
  // Extraer el path del archivo desde la URL pública
  const bucketPath = imageUrl.split(`/storage/v1/object/public/${STORAGE_BUCKET}/`)[1]
  if (!bucketPath) return

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([bucketPath])

  if (error) throw error
}

/**
 * Prueba la conexión a Supabase verificando acceso al storage.
 */
export async function testConnection(
  url: string,
  anonKey: string
): Promise<{ success: boolean; message: string }> {
  try {
    const client = url && anonKey ? createClient(url, anonKey) : getSharedClient()
    const { error } = await client.from("config").select("key").limit(1)
    if (error) {
      return { success: false, message: error.message }
    }
    return { success: true, message: "Conexión exitosa" }
  } catch (e: any) {
    return { success: false, message: e.message || "Error de conexión" }
  }
}
