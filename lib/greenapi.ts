/**
 * Cliente para GreenAPI (WhatsApp Business API).
 * Las credenciales se leen desde variables de entorno del servidor.
 */

const ID_INSTANCE = process.env.GREENAPI_ID_INSTANCE || ""
const API_TOKEN = process.env.GREENAPI_API_TOKEN || ""
const API_HOST = process.env.GREEN_API_BASE_URL || "https://7107.api.greenapi.com"

const BASE_URL = `${API_HOST}/waInstance${ID_INSTANCE}`

export function isGreenApiConfigured(): boolean {
  return !!(ID_INSTANCE && API_TOKEN)
}

function apiUrl(method: string): string {
  return `${BASE_URL}/${method}/${API_TOKEN}`
}

// ── Formatear teléfono a formato GreenAPI (56912345678@c.us) ──
export function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, "")
  // Si empieza con +, quitar el +
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1)
  // Si empieza con 56 9... (Chile), ya está ok
  // Si empieza con 9 (sin código país), agregar 56
  if (cleaned.startsWith("9") && cleaned.length === 9) cleaned = "56" + cleaned
  return `${cleaned}@c.us`
}

// ── Enviar mensaje de texto ──
export async function sendMessage(phone: string, message: string): Promise<{ idMessage: string } | null> {
  if (!isGreenApiConfigured()) return null

  try {
    const res = await fetch(apiUrl("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: formatPhone(phone),
        message,
      }),
    })
    if (!res.ok) {
      console.error("GreenAPI sendMessage error:", res.status, await res.text())
      return null
    }
    return await res.json()
  } catch (err) {
    console.error("GreenAPI sendMessage exception:", err)
    return null
  }
}

// ── Enviar archivo por URL (para recibo PDF) ──
export async function sendFileByUrl(
  phone: string,
  fileUrl: string,
  fileName: string,
  caption?: string
): Promise<{ idMessage: string } | null> {
  if (!isGreenApiConfigured()) return null

  try {
    const res = await fetch(apiUrl("sendFileByUrl"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: formatPhone(phone),
        urlFile: fileUrl,
        fileName,
        caption: caption || "",
      }),
    })
    if (!res.ok) {
      console.error("GreenAPI sendFileByUrl error:", res.status, await res.text())
      return null
    }
    return await res.json()
  } catch (err) {
    console.error("GreenAPI sendFileByUrl exception:", err)
    return null
  }
}

// ── Enviar archivo por upload (base64 → multipart/form-data) ──
export async function sendFileByUpload(
  phone: string,
  fileBase64: string,
  fileName: string,
  caption?: string
): Promise<{ idMessage: string } | null> {
  if (!isGreenApiConfigured()) return null

  try {
    const fileBuffer = Buffer.from(fileBase64, "base64")
    const mimeType = fileName.endsWith(".pdf") ? "application/pdf" : "application/octet-stream"
    const blob = new Blob([fileBuffer], { type: mimeType })

    const form = new FormData()
    form.append("chatId", formatPhone(phone))
    form.append("caption", caption || "")
    form.append("file", blob, fileName)

    const res = await fetch(apiUrl("sendFileByUpload"), {
      method: "POST",
      body: form,
    })
    if (!res.ok) {
      console.error("GreenAPI sendFileByUpload error:", res.status, await res.text())
      return null
    }
    return await res.json()
  } catch (err) {
    console.error("GreenAPI sendFileByUpload exception:", err)
    return null
  }
}

// ── Enviar indicador "escribiendo..." ──
export async function sendTyping(phone: string): Promise<void> {
  if (!isGreenApiConfigured()) return
  try {
    await fetch(`${BASE_URL}/setChatAction/${API_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: formatPhone(phone),
        action: "typing",
      }),
    })
  } catch {}
}

// ── Descargar archivo de GreenAPI ──
export async function downloadFile(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

// ── Recibir notificación (polling) ──
export async function receiveNotification(): Promise<any | null> {
  if (!isGreenApiConfigured()) return null

  try {
    const res = await fetch(apiUrl("receiveNotification"), { method: "GET" })
    if (!res.ok) return null
    const data = await res.json()
    return data // null si no hay notificaciones pendientes
  } catch {
    return null
  }
}

// ── Eliminar notificación procesada ──
export async function deleteNotification(receiptId: number): Promise<boolean> {
  if (!isGreenApiConfigured()) return false

  try {
    const res = await fetch(`${BASE_URL}/deleteNotification/${API_TOKEN}/${receiptId}`, {
      method: "DELETE",
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Obtener estado de la instancia ──
export async function getStateInstance(): Promise<string | null> {
  if (!isGreenApiConfigured()) return null

  try {
    const res = await fetch(apiUrl("getStateInstance"), { method: "GET" })
    if (!res.ok) return null
    const data = await res.json()
    return data.stateInstance || null
  } catch {
    return null
  }
}

