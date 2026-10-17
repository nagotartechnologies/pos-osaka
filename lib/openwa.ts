/**
 * Cliente para OpenWA (WhatsApp HTTP API).
 * Las credenciales se leen desde variables de entorno del servidor.
 */
import { formatPhone } from "@/lib/greenapi"

const BASE = (process.env.OPENWA_BASE_URL || "").replace(/\/+$/, "")
const API_KEY = process.env.OPENWA_API_KEY || ""
const SESSION = process.env.OPENWA_SESSION_ID || ""

export function isOpenWaConfigured(): boolean {
  return !!(BASE && API_KEY && SESSION)
}

function apiUrl(path: string): string {
  return `${BASE}/api/sessions/${SESSION}${path}`
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
  }
}

// ── Enviar mensaje de texto ──
export async function sendMessage(phone: string, message: string): Promise<{ idMessage: string } | null> {
  if (!isOpenWaConfigured()) return null

  try {
    const res = await fetch(apiUrl("/messages/send-text"), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        chatId: formatPhone(phone),
        text: message,
        // En Baileys la vista previa de enlaces es opcional: pedirla solo si hay URL
        ...(/https?:\/\//.test(message) ? { linkPreview: true } : {}),
      }),
    })
    if (!res.ok) {
      console.error("OpenWA sendMessage error:", res.status, await res.text())
      return null
    }
    const data = await res.json()
    return { idMessage: data.messageId }
  } catch (err) {
    console.error("OpenWA sendMessage exception:", err)
    return null
  }
}

// ── Elegir ruta y mimetype según la extensión: las imágenes van por send-image
// (se ven como foto en WhatsApp); el resto por send-document ──
const IMAGE_MIMES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
}

function mediaInfo(fileName: string): { route: string; mimetype: string } {
  const ext = (fileName.split(".").pop() || "").toLowerCase()
  if (IMAGE_MIMES[ext]) return { route: "/messages/send-image", mimetype: IMAGE_MIMES[ext] }
  return { route: "/messages/send-document", mimetype: ext === "pdf" ? "application/pdf" : "application/octet-stream" }
}

// ── Enviar archivo por URL (para recibo PDF) ──
export async function sendFileByUrl(
  phone: string,
  fileUrl: string,
  fileName: string,
  caption?: string
): Promise<{ idMessage: string } | null> {
  if (!isOpenWaConfigured()) return null

  try {
    const { route, mimetype } = mediaInfo(fileName)
    const res = await fetch(apiUrl(route), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        chatId: formatPhone(phone),
        url: fileUrl,
        filename: fileName,
        mimetype,
        caption: caption || "",
      }),
    })
    if (!res.ok) {
      console.error("OpenWA sendFileByUrl error:", res.status, await res.text())
      return null
    }
    const data = await res.json()
    return { idMessage: data.messageId }
  } catch (err) {
    console.error("OpenWA sendFileByUrl exception:", err)
    return null
  }
}

// ── Enviar archivo por upload (base64 en el body) ──
export async function sendFileByUpload(
  phone: string,
  fileBase64: string,
  fileName: string,
  caption?: string
): Promise<{ idMessage: string } | null> {
  if (!isOpenWaConfigured()) return null

  try {
    const { route, mimetype } = mediaInfo(fileName)
    const res = await fetch(apiUrl(route), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        chatId: formatPhone(phone),
        base64: fileBase64,
        filename: fileName,
        mimetype,
        caption: caption || "",
      }),
    })
    if (!res.ok) {
      console.error("OpenWA sendFileByUpload error:", res.status, await res.text())
      return null
    }
    const data = await res.json()
    return { idMessage: data.messageId }
  } catch (err) {
    console.error("OpenWA sendFileByUpload exception:", err)
    return null
  }
}

// ── Enviar indicador "escribiendo..." ──
export async function sendTyping(phone: string): Promise<void> {
  if (!isOpenWaConfigured()) return
  try {
    await fetch(apiUrl("/chats/typing"), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        chatId: formatPhone(phone),
        state: "typing",
      }),
    })
  } catch {}
}

// ── Obtener estado de la sesión ──
// OpenWA devuelve "ready" cuando está conectado; se mapea a "authorized"
// para mantener compatibilidad con la UI existente.
export async function getStateInstance(): Promise<string | null> {
  if (!isOpenWaConfigured()) return null

  try {
    const res = await fetch(`${BASE}/api/sessions/${SESSION}`, {
      method: "GET",
      headers: headers(),
    })
    if (!res.ok) return null
    const data = await res.json()
    const status = data.status || null
    return status === "ready" ? "authorized" : status
  } catch {
    return null
  }
}
