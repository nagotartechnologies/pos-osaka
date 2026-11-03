/**
 * Fachada de WhatsApp: delega los envíos al proveedor activo
 * (GreenAPI u OpenWA) según la configuración guardada en Supabase.
 * No hay fallback automático: se usa siempre el proveedor elegido.
 */
import { getSharedClient } from "@/lib/supabase"
import * as greenapi from "@/lib/greenapi"
import * as openwa from "@/lib/openwa"

export type WhatsAppProvider = "greenapi" | "openwa"

// Cache en memoria del proveedor activo (15 s) para no consultar la DB en cada envío
const PROVIDER_CACHE_MS = 15_000
let cachedProvider: WhatsAppProvider | null = null
let cachedAt = 0

export async function getActiveProvider(): Promise<WhatsAppProvider> {
  if (cachedProvider && Date.now() - cachedAt < PROVIDER_CACHE_MS) {
    return cachedProvider
  }

  try {
    const sb = getSharedClient()
    const { data } = await sb
      .from("config")
      .select("value")
      .eq("key", "whatsappProvider")
      .single()
    cachedProvider = data?.value === "openwa" ? "openwa" : "greenapi"
  } catch {
    cachedProvider = "greenapi"
  }
  cachedAt = Date.now()
  return cachedProvider
}

function client(provider: WhatsAppProvider) {
  return provider === "openwa" ? openwa : greenapi
}

async function resolve(provider?: WhatsAppProvider): Promise<WhatsAppProvider> {
  return provider || (await getActiveProvider())
}

// ── Enviar mensaje de texto ──
export async function sendMessage(
  phone: string,
  message: string,
  provider?: WhatsAppProvider
): Promise<{ idMessage: string } | null> {
  return client(await resolve(provider)).sendMessage(phone, message)
}

// ── Enviar archivo por URL ──
export async function sendFileByUrl(
  phone: string,
  fileUrl: string,
  fileName: string,
  caption?: string,
  provider?: WhatsAppProvider
): Promise<{ idMessage: string } | null> {
  return client(await resolve(provider)).sendFileByUrl(phone, fileUrl, fileName, caption)
}

// ── Enviar archivo por upload (base64) ──
export async function sendFileByUpload(
  phone: string,
  fileBase64: string,
  fileName: string,
  caption?: string,
  provider?: WhatsAppProvider
): Promise<{ idMessage: string } | null> {
  return client(await resolve(provider)).sendFileByUpload(phone, fileBase64, fileName, caption)
}

// ── Enviar indicador "escribiendo..." ──
export async function sendTyping(phone: string, provider?: WhatsAppProvider): Promise<void> {
  return client(await resolve(provider)).sendTyping(phone)
}

// ── Obtener estado de la instancia/sesión ──
export async function getStateInstance(provider?: WhatsAppProvider): Promise<string | null> {
  return client(await resolve(provider)).getStateInstance()
}

// ── Verificar si el proveedor activo (o el indicado) está configurado ──
export async function isWhatsAppConfigured(provider?: WhatsAppProvider): Promise<boolean> {
  const p = await resolve(provider)
  return p === "openwa" ? openwa.isOpenWaConfigured() : greenapi.isGreenApiConfigured()
}

// Re-exportar utilidades compartidas
export { formatPhone, downloadFile } from "@/lib/greenapi"
