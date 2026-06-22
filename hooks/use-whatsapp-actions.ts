"use client"

import { useCallback } from "react"
import { insertMessage } from "@/lib/supabase-chat"
import { getOrderReceiptBlob, type PaperWidth } from "@/lib/receipt-pdf"
import { uploadPdfToCloudinary, deleteCloudinaryImage } from "@/lib/cloudinary"
import type { SupabaseOrder } from "@/lib/supabase-orders"

interface WhatsAppActionsConfig {
  businessName: string
  paperWidth: PaperWidth
  logoUrl: string
  storeAddress: string
  deliveryFee: number
}

/**
 * Hook que centraliza las acciones de WhatsApp: enviar mensaje, recibo y notificación al admin.
 */
export function useWhatsAppActions(config: WhatsAppActionsConfig) {
  const { businessName, paperWidth, logoUrl, storeAddress, deliveryFee } = config
  const token = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

  const sendWhatsAppNotification = useCallback(async (
    order: SupabaseOrder,
    message: string,
    type: "text" | "status" = "status"
  ) => {
    if (!order.client_phone) return
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-token": token },
        body: JSON.stringify({ phone: order.client_phone, message }),
      })
      if (!res.ok) console.error("WhatsApp send failed:", res.status)
      // Siempre guardar en Supabase para que el admin vea el mensaje
      await insertMessage({
        order_id: order.id,
        phone: order.client_phone,
        direction: "outgoing",
        message,
        type,
      })
    } catch (err) {
      console.error("Error enviando WhatsApp:", err)
    }
  }, [token])

  const sendReceiptByWhatsApp = useCallback(async (order: SupabaseOrder) => {
    if (!order.client_phone) return

    // 1. Siempre enviar resumen como texto (fiable, sin dependencias)
    try {
      const items = order.items.map((i: any) => {
        const unitP = i.customBuild && i.quotedPrice != null ? i.quotedPrice : i.price
        return `  • ${i.quantity}x ${i.name} — $${(unitP * i.quantity).toLocaleString("es-CL")}`
      }).join("\n")
      const receiptText = `📄 *Recibo — Pedido #${order.id}*\n` +
        `📍 *${businessName}*\n\n` +
        `${items}\n\n` +
        `💰 *Total: $${order.total.toLocaleString("es-CL")}*\n` +
        `💳 Pago: ${order.payment_method}\n` +
        `📦 ${order.delivery_type === "delivery" ? "Delivery" : "Retiro en local"}\n\n` +
        `¡Gracias por tu compra! 🙏`
      await sendWhatsAppNotification(order, receiptText)
    } catch (err) {
      console.error("Error enviando recibo texto:", err)
    }

    // 2. Intentar enviar PDF como bonus (si falla, el texto ya llegó)
    try {
      const blob = await getOrderReceiptBlob(order, paperWidth, logoUrl, businessName, storeAddress, deliveryFee)
      const fileName = `recibo-${order.id}.pdf`
      const pdfUrl = await uploadPdfToCloudinary(blob, fileName)

      await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-token": token },
        body: JSON.stringify({
          phone: order.client_phone,
          type: "url",
          fileUrl: pdfUrl,
          fileName,
          caption: `📄 Recibo #${order.id}`,
        }),
      })

      // Eliminar PDF de Cloudinary después de 30 segundos
      setTimeout(() => {
        deleteCloudinaryImage(pdfUrl).catch(() => {})
      }, 30_000)
    } catch (err) {
      console.error("Error enviando recibo PDF (texto ya enviado):", err)
    }

    await insertMessage({
      order_id: order.id,
      phone: order.client_phone,
      direction: "outgoing",
      message: `📄 Recibo enviado — $${order.total.toLocaleString("es-CL")}`,
      type: "file",
    })
  }, [businessName, paperWidth, logoUrl, storeAddress, deliveryFee, token, sendWhatsAppNotification])

  const notifyAdmin = useCallback(async (message: string) => {
    try {
      await fetch("/api/whatsapp/notify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-token": token },
        body: JSON.stringify({ message }),
      })
    } catch {}
  }, [token])

  return { sendWhatsAppNotification, sendReceiptByWhatsApp, notifyAdmin }
}
