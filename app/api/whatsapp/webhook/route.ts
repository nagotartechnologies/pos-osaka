import { NextRequest, NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"
import crypto from "crypto"
import { sendMessage, sendTyping, isWhatsAppConfigured, downloadFile, type WhatsAppProvider } from "@/lib/whatsapp"
import { normalizePhone, chatIdFromPhone } from "@/lib/phone"
import { parseSchedule, checkStoreOpen, DAY_LABELS } from "@/lib/schedule"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || ""
const WEBHOOK_TOKEN = process.env.GREENAPI_WEBHOOK_TOKEN || ""
const OPENWA_WEBHOOK_SECRET = process.env.OPENWA_WEBHOOK_SECRET || ""
const GREENAPI_ID_INSTANCE = process.env.GREENAPI_ID_INSTANCE || ""
const GREEN_API_BASE_URL = process.env.GREEN_API_BASE_URL || ""
const STORAGE_BUCKET = "media"

function getServerClient() {
  return getAdminClient()
}

// Sube un buffer al bucket de Supabase Storage y devuelve su URL publica.
async function uploadMediaToStorage(buffer: Buffer, path: string, contentType: string): Promise<string | null> {
  try {
    const sb = getServerClient()
    const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, buffer, {
      contentType,
      upsert: true,
      cacheControl: "3600",
    })
    if (error) return null
    const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    return data.publicUrl || null
  } catch {
    return null
  }
}

// ── Extraer número limpio del chatId (56912345678@c.us → 56912345678) ──
function extractPhone(chatId: string): string {
  return chatId.replace("@c.us", "").replace("@g.us", "")
}

// Resultado normalizado de cualquier proveedor para el flujo común
type ParsedIncoming = {
  phone: string
  messageText: string
  msgType: "text" | "image" | "audio"
  mediaUrl: string | null
  provider: WhatsAppProvider
  messageId: string
  sentAt: number | null // epoch ms en que el cliente envió el mensaje
}

// ── Protección contra respuestas repetidas ──────────────────────────
// El proceso es uno solo (contenedor osaka-app), así que basta memoria.
// 1) Webhooks duplicados del proveedor: se ignora un messageId ya procesado.
// 2) Ráfagas: si llegan varios mensajes a la vez, cada webhook consultaba la DB
//    en paralelo antes de que existiera el registro de la respuesta y todos
//    respondían. El "claim" síncrono por teléfono deja pasar solo al primero.
// 3) Mensajes atrasados: al reconectarse, OpenWA entrega de golpe mensajes de
//    hace horas. Se guardan en el chat pero no disparan respuestas automáticas.
const SEEN_TTL_MS = 60 * 60 * 1000
const CLAIM_TTL_MS = 2 * 60 * 1000
const STALE_MS = 10 * 60 * 1000
const seenMessages = new Map<string, number>()
const autoReplyClaims = new Map<string, number>()

function prune(map: Map<string, number>, ttl: number) {
  const now = Date.now()
  for (const [k, t] of map) if (now - t > ttl) map.delete(k)
}

function alreadySeen(provider: string, messageId: string): boolean {
  if (!messageId) return false
  prune(seenMessages, SEEN_TTL_MS)
  const key = `${provider}:${messageId}`
  if (seenMessages.has(key)) return true
  seenMessages.set(key, Date.now())
  return false
}

/** Check-and-set síncrono: true solo para el primer webhook del teléfono en la ventana. */
function claimAutoReply(phone: string): boolean {
  prune(autoReplyClaims, CLAIM_TTL_MS)
  if (autoReplyClaims.has(phone)) return false
  autoReplyClaims.set(phone, Date.now())
  return true
}

function toEpochMs(ts: unknown): number | null {
  const n = typeof ts === "string" ? Number(ts) : typeof ts === "number" ? ts : NaN
  if (!Number.isFinite(n) || n <= 0) return null
  return n < 1e12 ? n * 1000 : n
}

// ── Verificar firma HMAC del webhook de OpenWA (X-OpenWA-Signature: sha256=<hex>) ──
function verifyOpenWaSignature(rawBody: string, signature: string | null): boolean {
  if (!OPENWA_WEBHOOK_SECRET) return false
  if (!signature || !signature.startsWith("sha256=")) return false
  const expected = "sha256=" + crypto.createHmac("sha256", OPENWA_WEBHOOK_SECRET).update(rawBody).digest("hex")
  if (expected.length !== signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

// ── Anti-SSRF: solo descargar media desde dominios del proveedor ──
function isAllowedMediaUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== "https:") return false
    const host = u.hostname.toLowerCase()
    if (host === "greenapi.com" || host.endsWith(".greenapi.com")) return true
    if (host === "green-api.com" || host.endsWith(".green-api.com")) return true
    if (GREEN_API_BASE_URL) {
      const base = new URL(GREEN_API_BASE_URL)
      if (host === base.hostname.toLowerCase()) return true
    }
    return false
  } catch {
    return false
  }
}

// ── Parsear mensaje entrante de GreenAPI ──
async function parseGreenApi(body: any): Promise<ParsedIncoming | null> {
  const messageData = body.messageData
  const senderData = body.senderData
  const chatId = senderData?.chatId || ""
  const phone = extractPhone(chatId)

  if (!phone || !messageData) return null

  // Extraer texto del mensaje y detectar imágenes
  let messageText = ""
  let mediaUrl: string | null = null
  let msgType: "text" | "image" | "audio" = "text"
  const typeMessage = messageData.typeMessage

  if (typeMessage === "textMessage") {
    messageText = messageData.textMessageData?.textMessage || ""
  } else if (typeMessage === "extendedTextMessage") {
    messageText = messageData.extendedTextMessageData?.text || ""
  } else if (typeMessage === "imageMessage") {
    messageText = messageData.fileMessageData?.caption || "📷 Imagen"
    msgType = "image"
    // Descargar imagen de GreenAPI y subir a Cloudinary
    const downloadUrl = messageData.fileMessageData?.downloadUrl
    if (downloadUrl && isAllowedMediaUrl(downloadUrl)) {
      const buffer = await downloadFile(downloadUrl)
      if (buffer) {
        const storedUrl = await uploadMediaToStorage(buffer, `pos-osaka/chat-media/chat-${Date.now()}.jpg`, "image/jpeg")
        if (storedUrl) mediaUrl = storedUrl
      }
    }
  } else if (typeMessage === "audioMessage") {
    messageText = "🎤 Audio"
    msgType = "audio"
    const downloadUrl = messageData.fileMessageData?.downloadUrl
    if (downloadUrl && isAllowedMediaUrl(downloadUrl)) {
      const buffer = await downloadFile(downloadUrl)
      if (buffer) {
        const storedUrl = await uploadMediaToStorage(buffer, `pos-osaka/chat-media/audio-${Date.now()}.ogg`, "audio/ogg")
        if (storedUrl) mediaUrl = storedUrl
      }
    }
  } else if (typeMessage === "documentMessage" || typeMessage === "videoMessage") {
    messageText = messageData.fileMessageData?.caption || `[${typeMessage}]`
  } else {
    messageText = `[${typeMessage}]`
  }

  return {
    phone, messageText, msgType, mediaUrl, provider: "greenapi",
    messageId: String(body.idMessage || ""),
    sentAt: toEpochMs(body.timestamp),
  }
}

// ── Parsear mensaje entrante de OpenWA ──
// data.from/data.chatId llegan como "56912345678@c.us" (u otro sufijo como "@lid");
// nos quedamos solo con los dígitos antes de la "@".
async function parseOpenWa(body: any): Promise<ParsedIncoming | null> {
  const data = body.data || {}

  // Ignorar mensajes propios y de grupos
  if (data.fromMe === true || data.isGroup === true) return null

  const rawChat = data.from || data.chatId || ""
  const phone = String(rawChat).split("@")[0].replace(/\D/g, "")
  if (!phone) return null

  const bodyText = data.body || ""
  const type = data.type || "text"

  let messageText = bodyText
  let mediaUrl: string | null = null
  let msgType: "text" | "image" | "audio" = "text"

  // Media adjunta: { mimetype, data: base64 } o { mimetype, omitted: true }
  const media = data.media || null
  const mediaBase64: string | null = media?.data && !media.omitted ? media.data : null

  if (type === "text" || type === "chat") {
    messageText = bodyText
  } else if (type === "image") {
    messageText = bodyText || "📷 Imagen"
    msgType = "image"
    if (mediaBase64) {
      const buffer = Buffer.from(mediaBase64, "base64")
      const storedUrl = await uploadMediaToStorage(buffer, `pos-osaka/chat-media/chat-${Date.now()}.jpg`, "image/jpeg")
      if (storedUrl) mediaUrl = storedUrl
    }
  } else if (type === "audio" || type === "ptt") {
    messageText = bodyText || "🎤 Audio"
    msgType = "audio"
    if (mediaBase64) {
      const buffer = Buffer.from(mediaBase64, "base64")
      const storedUrl = await uploadMediaToStorage(buffer, `pos-osaka/chat-media/audio-${Date.now()}.ogg`, "audio/ogg")
      if (storedUrl) mediaUrl = storedUrl
    }
  } else if (type === "video" || type === "document") {
    messageText = bodyText || `[${type}]`
  } else {
    messageText = bodyText || `[${type}]`
  }

  const rawId = data.id?._serialized ?? data.id ?? data.messageId ?? ""
  return {
    phone, messageText, msgType, mediaUrl, provider: "openwa",
    messageId: String(rawId),
    sentAt: toEpochMs(data.timestamp ?? body.timestamp),
  }
}

export async function POST(req: NextRequest) {
  try {
    // Leer el cuerpo como texto crudo (necesario para verificar la firma HMAC de OpenWA)
    const rawBody = await req.text()
    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ ok: true })
    }

    // Detectar proveedor: OpenWA envía header x-openwa-event o un campo "event" string
    const isOpenWa = !!req.headers.get("x-openwa-event") || typeof body.event === "string"

    let parsed: ParsedIncoming | null = null

    if (isOpenWa) {
      if (!verifyOpenWaSignature(rawBody, req.headers.get("x-openwa-signature"))) {
        return NextResponse.json({ error: "Firma inválida" }, { status: 401 })
      }

      // Solo procesamos mensajes entrantes
      if (body.event !== "message.received") {
        return NextResponse.json({ ok: true })
      }

      parsed = await parseOpenWa(body)
    } else {
      // Verificar que el webhook realmente venga de GreenAPI:
      // token compartido (header/body) o el idInstance propio del payload.
      const token = req.headers.get("x-webhook-token") || body.webhookToken || ""
      const tokenOk = !!WEBHOOK_TOKEN && token === WEBHOOK_TOKEN
      const idOk = !!GREENAPI_ID_INSTANCE && String(body.instanceData?.idInstance ?? "") === GREENAPI_ID_INSTANCE
      if (!tokenOk && !idOk) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 })
      }

      // GreenAPI envía diferentes tipos de webhook
      const typeWebhook = body.typeWebhook

      // Solo procesamos mensajes entrantes
      if (typeWebhook !== "incomingMessageReceived") {
        return NextResponse.json({ ok: true })
      }

      parsed = await parseGreenApi(body)
    }

    if (!parsed || !parsed.messageText) {
      return NextResponse.json({ ok: true })
    }

    const { phone, messageText, msgType, mediaUrl, provider, messageId, sentAt } = parsed

    // Webhook repetido del proveedor: ya se guardó y respondió
    if (alreadySeen(provider, messageId)) {
      return NextResponse.json({ ok: true })
    }
    const isStale = sentAt !== null && Date.now() - sentAt > STALE_MS

    // Buscar el pedido más reciente asociado a este teléfono
    const sb = getServerClient()

    // Buscar pedidos activos con este teléfono (últimos 7 días, no entregados ni cancelados)
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: orders } = await sb
      .from("orders")
      .select("id, client_phone")
      .gte("created_at", since)
      .not("status", "in", '("entregado","cancelado")')
      .order("created_at", { ascending: false })

    // Buscar el pedido que coincida con el teléfono
    const phoneNorm = normalizePhone(phone)
    const matchedOrder = (orders || []).find((o: any) =>
      normalizePhone(o.client_phone) === phoneNorm
    )

    if (!matchedOrder) {
      // Usar siempre el mismo chatId basado en los últimos 9 dígitos del teléfono
      const chatOrderId = chatIdFromPhone(phone)

      // Siempre guardar el mensaje (con o sin pedido)
      const chatInsert: Record<string, any> = {
        order_id: chatOrderId,
        phone,
        direction: "incoming",
        message: messageText,
        type: msgType,
        read: false,
      }
      if (mediaUrl) chatInsert.media_url = mediaUrl
      const { error: chatInsertErr } = await sb.from("chat_messages").insert(chatInsert)
      if (chatInsertErr) console.error("Webhook chat insert error:", chatInsertErr)

      // Cargar config una vez
      const { data: configRows } = await sb
        .from("config")
        .select("key, value")
        .in("key", ["cartaCode", "nombreNegocio", "autoReplyMsg", "closedMsg", "schedule", "horaApertura", "horaCierre", "lastDayStart", "lastDayClose"])
      const cfg: Record<string, string> = {}
      ;(configRows || []).forEach((r: any) => { cfg[r.key] = r.value })

      const bizName = cfg.nombreNegocio || "nuestro restaurante"

      // ── Verificar si el negocio está abierto ──────────
      // 1) Verificar día iniciado manualmente
      const dayIsOpen = !!cfg.lastDayStart && (!cfg.lastDayClose || cfg.lastDayStart > cfg.lastDayClose)

      // 2) Verificar horario semanal
      // Construir fecha en hora local de Santiago sin depender de timezone del servidor
      const santiagoStr = new Date().toLocaleString("sv-SE", { timeZone: "America/Santiago" })
      const [sDt, sTm] = santiagoStr.split(" ")
      const [sY, sM, sD] = sDt.split("-").map(Number)
      const [sH, sMin] = sTm.split(":").map(Number)
      const chileNow = new Date(sY, sM - 1, sD, sH, sMin, 0)
      const weekSchedule = parseSchedule(cfg.schedule || null, cfg.horaApertura, cfg.horaCierre)
      const { isOpen: scheduleOpen, nextOpenDay, nextOpenTime, currentDayKey } = checkStoreOpen(weekSchedule, chileNow)

      // Cerrado si el día no fue iniciado O el schedule dice cerrado
      const isOpen = dayIsOpen && scheduleOpen

      // Las respuestas automáticas salen por el mismo canal por donde llegó el mensaje.
      // Mensajes atrasados o ráfagas del mismo teléfono: solo se guardan, sin responder.
      if (isStale || !claimAutoReply(phone)) {
        return NextResponse.json({ ok: true })
      }
      const waConfigured = await isWhatsAppConfigured(provider)

      if (!isOpen && waConfigured) {
        // Anti-spam cerrado: 1 mensaje cada 4 horas (buscar por teléfono, no order_id)
        const since4h = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
        const { data: recentClosed } = await sb
          .from("chat_messages")
          .select("id")
          .eq("phone", phone)
          .eq("direction", "outgoing")
          .ilike("message", "%[AUTO-CERRADO]%")
          .gte("created_at", since4h)
          .limit(1)
        const closedAlreadySent = (recentClosed?.length || 0) > 0

        if (!closedAlreadySent) {
          const esHoy = nextOpenDay !== null && nextOpenDay === currentDayKey
          const nextDayDisplay = nextOpenDay
            ? (esHoy ? "*hoy*" : `el *${DAY_LABELS[nextOpenDay]}*`)
            : ""
          const nextInfo = nextOpenDay && nextOpenTime
            ? ` Volvemos ${nextDayDisplay} a las *${nextOpenTime}* hs.`
            : ""
          const proximoDiaLabel = nextOpenDay
            ? (esHoy ? "hoy" : DAY_LABELS[nextOpenDay])
            : ""
          const closedMsg = cfg.closedMsg
            ? cfg.closedMsg.replace(/\{negocio\}/g, bizName).replace(/\{proximoDia\}/g, proximoDiaLabel).replace(/\{proximaHora\}/g, nextOpenTime || "")
            : `🌙 Hola! En este momento *${bizName}* está cerrado.${nextInfo}\n\n¡Te esperamos pronto! 🙏`
          try {
            await sendTyping(phone, provider)
            await sendMessage(phone, closedMsg, provider)
            await sb.from("chat_messages").insert({
              order_id: chatOrderId, phone, direction: "outgoing",
              message: `${closedMsg}\n[AUTO-CERRADO]`, type: "text", read: true,
            })
          } catch (e) { console.error("Closed msg error:", e) }
        }
        return NextResponse.json({ ok: true })
      }

      // ── Enviar carta (negocio abierto, 1 vez cada 24h por teléfono) ──────────
      // Solo filtrar auto-replies (que contienen /carta/) para no bloquear por mensajes manuales del admin
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: recentAutoReply } = await sb
        .from("chat_messages")
        .select("id")
        .eq("phone", phone)
        .eq("direction", "outgoing")
        .ilike("message", "%/carta/%")
        .gte("created_at", since24h)
        .limit(1)
      const alreadySent = (recentAutoReply?.length || 0) > 0
      if (!alreadySent && waConfigured) {
        if (cfg.cartaCode) {
          const siteUrl = SITE_URL || "https://osakaoculto20261003.vercel.app"
          const phoneParam = phone ? `?phone=${encodeURIComponent(phone)}` : ""
          const cartaLink = `${siteUrl}/carta/${cfg.cartaCode}${phoneParam}`

          let autoMsg: string
          if (cfg.autoReplyMsg) {
            autoMsg = cfg.autoReplyMsg
              .replace(/\{negocio\}/g, bizName)
              .replace(/\{link\}/g, cartaLink)
          } else {
            autoMsg = `¡Hola! 👋 Bienvenido a *${bizName}*.\n\nPuedes ver nuestra carta y hacer tu pedido directamente aquí:\n👉 ${cartaLink}\n\n¡Te esperamos! 🍣`
          }
          try {
            await sendTyping(phone, provider)
            await sendMessage(phone, autoMsg, provider)
            await sb.from("chat_messages").insert({
              order_id: chatOrderId, phone, direction: "outgoing",
              message: autoMsg, type: "text", read: true,
            })
          } catch (e) { console.error("Auto-reply send error:", e) }
        }
      }

      return NextResponse.json({ ok: true })
    }

    // Guardar mensaje entrante en Supabase
    const orderInsert: Record<string, any> = {
      order_id: matchedOrder.id,
      phone,
      direction: "incoming",
      message: messageText,
      type: msgType,
      read: false,
    }
    if (mediaUrl) orderInsert.media_url = mediaUrl
    const { error: orderInsertErr } = await sb.from("chat_messages").insert(orderInsert)
    if (orderInsertErr) console.error("Webhook order insert error:", orderInsertErr)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("Webhook error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GreenAPI también puede enviar GET para verificar el webhook
export async function GET() {
  return NextResponse.json({ status: "active" })
}
