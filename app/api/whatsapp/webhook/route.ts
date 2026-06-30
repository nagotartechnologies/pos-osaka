import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendMessage, sendTyping, isGreenApiConfigured, formatPhone, downloadFile } from "@/lib/greenapi"
import { normalizePhone, chatIdFromPhone } from "@/lib/phone"
import { parseSchedule, checkStoreOpen, DAY_LABELS } from "@/lib/schedule"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || ""
const WEBHOOK_TOKEN = process.env.GREENAPI_WEBHOOK_TOKEN || ""
const STORAGE_BUCKET = "media"

function getServerClient() {
  return createClient(supabaseUrl, supabaseKey)
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Verificar token de webhook si está configurado
    if (WEBHOOK_TOKEN && body.stateInstance !== undefined) {
      // GreenAPI envía el instanceId — verificar que coincida con nuestro token secreto
      const token = req.headers.get("x-webhook-token") || body.webhookToken || ""
      if (WEBHOOK_TOKEN && token && token !== WEBHOOK_TOKEN) {
        return NextResponse.json({ error: "Token inválido" }, { status: 403 })
      }
    }

    // GreenAPI envía diferentes tipos de webhook
    const typeWebhook = body.typeWebhook

    // Solo procesamos mensajes entrantes
    if (typeWebhook !== "incomingMessageReceived") {
      return NextResponse.json({ ok: true })
    }

    const messageData = body.messageData
    const senderData = body.senderData
    const chatId = senderData?.chatId || ""
    const phone = extractPhone(chatId)

    if (!phone || !messageData) {
      return NextResponse.json({ ok: true })
    }

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
      if (downloadUrl) {
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
      if (downloadUrl) {
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

    if (!messageText) {
      return NextResponse.json({ ok: true })
    }

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

      if (!isOpen && isGreenApiConfigured()) {
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
            await sendTyping(phone)
            await sendMessage(phone, closedMsg)
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
      if (!alreadySent && isGreenApiConfigured()) {
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
            await sendTyping(phone)
            await sendMessage(phone, autoMsg)
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
