import type { SupabaseOrder } from "@/lib/supabase-orders"
import { PAPER, fmt, getBizName, type PaperWidth } from "./shared"

/**
 * Genera una comanda de cocina PDF estilo ticket.
 * Solo muestra: productos, cantidades, notas del cliente, entrega/dirección y delivery.
 */
export async function generateKitchenOrder(
  order: SupabaseOrder,
  paper: PaperWidth = "75mm",
  name?: string,
  deliveryFee?: number,
) {
  const { jsPDF } = await import("jspdf")

  const cfg = PAPER[paper]
  const { width, margin } = cfg
  const contentWidth = width - margin * 2
  const lh = paper === "58mm" ? 4.5 : 6.5

  // Fuentes 1pt más pequeñas para caber más info en la comanda
  const kcfg = {
    titleSize: cfg.titleSize - 1,
    bodySize: cfg.bodySize - 1,
    smallSize: cfg.smallSize - 1,
    maxNameLen: cfg.maxNameLen + 4,
  }

  // Filtrar salsas — no se muestran en la comanda de cocina
  const isSauce = (it: any) => typeof it?.id === "string" && it.id.startsWith("salsa-")
  const kitchenItems = order.items.filter((it: any) => !isSauce(it))
  const notesCount = kitchenItems.reduce((acc: number, it: any) => acc + (it.notes ? 1 : 0), 0)
  const extrasCount = kitchenItems.reduce((acc: number, it: any) => acc + ((it.extras || []).length), 0)
  const customBuildCount = kitchenItems.reduce((acc: number, it: any) => acc + (it.customBuild ? 1 : 0) + (it.customBuildNotes ? Math.ceil(it.customBuildNotes.length / 30) : 0), 0)
  const baseHeight = 60 + (kitchenItems.length + notesCount + extrasCount + customBuildCount * 2) * lh * 2.8 + (order.delivery_type === "delivery" ? 12 : 0) + (deliveryFee && deliveryFee > 0 ? 8 : 0)
  const doc = new jsPDF({ unit: "mm", format: [width, baseHeight] })

  const businessName = getBizName(name)

  let y = 6

  // ── Título COMANDA ──
  doc.setFontSize(kcfg.titleSize + 2)
  doc.setFont("helvetica", "bold")
  doc.text("COMANDA DE COCINA", width / 2, y, { align: "center" })
  y += kcfg.titleSize * 0.5 + 2

  // ── Notas de modificación (si existen) ──
  if (order.modification_notes?.trim()) {
    const modText = `MODIF: ${order.modification_notes.trim()}`
    doc.setFontSize(kcfg.smallSize)
    doc.setFont("helvetica", "bold")
    const textWidth = contentWidth - 6
    const lines = doc.splitTextToSize(modText, textWidth)
    const lineHeight = 3
    const boxHeight = 3 + lines.length * lineHeight

    doc.setFillColor(255, 243, 205)
    doc.setDrawColor(255, 193, 7)
    doc.roundedRect(margin, y - 1, contentWidth, boxHeight, 1, 1, "FD")

    doc.setTextColor(133, 100, 4)
    lines.forEach((line: string, idx: number) => {
      doc.text(line, margin + 3, y + 2 + idx * lineHeight)
    })
    doc.setTextColor(0)
    y += boxHeight + 2
  }

  // ── Separador ──
  doc.setDrawColor(0)
  doc.setLineWidth(1.2)
  doc.line(margin, y, width - margin, y)
  y += 3

  // ── Pedido + Fecha ──
  const orderDate = new Date(order.created_at)
  const timeStr = orderDate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })

  doc.setFontSize(kcfg.bodySize + 1)
  doc.setFont("helvetica", "bold")
  doc.text(`#${order.id}`, margin, y)
  doc.setFont("helvetica", "normal")
  doc.text(timeStr, width - margin, y, { align: "right" })
  y += lh + 1

  // ── Cliente ──
  const isPhoneName = /^\+?\d{7,15}$/.test((order.client_name || "").replace(/[\s\-]/g, ""))
  if (!isPhoneName) {
    doc.setFontSize(kcfg.bodySize)
    doc.setFont("helvetica", "bold")
    doc.text(order.client_name, margin, y)
    y += lh
  }

  // ── Entrega ──
  if (order.delivery_type === "delivery") {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(kcfg.smallSize)
    doc.setTextColor(80)
    doc.text("DELIVERY", margin, y)
    doc.setTextColor(0)
    y += lh * 0.9
    if (order.address) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(kcfg.bodySize + 1)
      const addrText = order.address.length > kcfg.maxNameLen + 15 ? order.address.slice(0, kcfg.maxNameLen + 15) + "..." : order.address
      doc.text(addrText, margin, y)
      y += lh
    }
  } else {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(kcfg.bodySize)
    doc.text("RETIRO EN LOCAL", margin, y)
    y += lh
  }

  y += 1

  // ── Separador ──
  doc.setDrawColor(0)
  doc.setLineDashPattern([1, 1], 0)
  doc.line(margin, y, width - margin, y)
  y += 3

  // ── Items ──
  doc.setLineWidth(0.8)
  kitchenItems.forEach((item: any) => {
    // Mostrar categoría primero (sin números al lado)
    if (item.category) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(kcfg.bodySize)
      doc.setTextColor(0)
      doc.text(item.category.toUpperCase(), margin, y)
      y += lh
    }

    // Cantidad + Nombre en bold grueso + Precio alineado a la derecha
    doc.setFont("helvetica", "bold")
    doc.setFontSize(kcfg.bodySize + 2)
    const itemName = item.name.length > kcfg.maxNameLen ? item.name.slice(0, kcfg.maxNameLen) + "..." : item.name
    const extrasPrice = (item.extras || []).reduce((s: number, e: any) => s + (Number(e.price) || 0), 0)
    const unitPrice = (item.customBuild && item.quotedPrice != null) ? item.quotedPrice : (item.price + extrasPrice)
    const lineTotal = unitPrice * item.quantity
    const priceLabel = `$${fmt(lineTotal)}`
    const namePart = `${item.quantity}x ${itemName}`
    doc.text(namePart, margin, y)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(kcfg.bodySize)
    doc.text(priceLabel, width - margin, y, { align: "right" })
    doc.setFont("helvetica", "bold")
    doc.setFontSize(kcfg.bodySize + 2)

    // Notas de personalización (solo para a tu pinta, pegado al producto)
    if (item.customBuild && item.customBuildNotes?.trim()) {
      y += lh * 0.8
      doc.setFont("helvetica", "bold")
      doc.setFontSize(kcfg.bodySize + 2)
      doc.setTextColor(0)
      // Limpiar emojis de las notas
      const cleanNotes = item.customBuildNotes.trim().replace(/[\u{1F300}-\u{1F9FF}]/gu, "").replace(/[\u{2600}-\u{26FF}]/gu, "")
      const noteLines = doc.splitTextToSize(cleanNotes, contentWidth - 2)
      noteLines.forEach((line: string) => {
        doc.text(line, margin, y)
        y += lh * 0.95
      })
      doc.setTextColor(0)
      y += lh
    } else {
      y += lh + 1
    }

    // Mostrar notes solo si no es un item custom build (para evitar duplicar customBuildNotes)
    if (item.notes?.trim() && !(item.customBuild && item.customBuildNotes?.trim())) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(kcfg.bodySize)
      doc.setTextColor(80)
      let cleanNotes = item.notes.trim().replace(/[\u{1F300}-\u{1F9FF}]/gu, "").replace(/[\u{2600}-\u{26FF}]/gu, "")
      cleanNotes = cleanNotes.replace(/^Ármalo a tu pinta:\s*/i, "")
      if (cleanNotes.trim()) {
        const noteLines = doc.splitTextToSize(cleanNotes.trim(), contentWidth - 6)
        noteLines.forEach((line: string) => {
          doc.text(`> ${line}`, margin, y)
          y += lh * 0.95
        })
      }
      doc.setTextColor(0)
    }

    if (item.extras && item.extras.length > 0) {
      item.extras.forEach((extra: any) => {
        if (!extra.description?.trim()) return
        doc.setFont("helvetica", "bold")
        doc.setFontSize(kcfg.bodySize + 1)
        doc.setTextColor(0)
        const extraLabel = extra.price > 0
          ? `+ ${extra.description.trim()} ($${fmt(extra.price)})`
          : `+ ${extra.description.trim()}`
        doc.text(extraLabel, margin + 4, y)
        y += lh + 1.5
      })
      doc.setTextColor(0)
    }
    y += lh
  })

  y += 2

  // ── Separador ──
  doc.setLineWidth(1.2)
  doc.setLineDashPattern([1, 1], 0)
  doc.line(margin, y, width - margin, y)
  y += 4

  // ── Total + Delivery ──
  doc.setFont("helvetica", "bold")
  doc.setFontSize(kcfg.titleSize)
  doc.text("TOTAL", margin, y)
  doc.text(`$${fmt(order.total)}`, width - margin, y, { align: "right" })
  y += lh + 1

  if (deliveryFee && deliveryFee > 0 && order.delivery_type === "delivery") {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(kcfg.smallSize)
    doc.setTextColor(100)
    doc.text(`(incluye delivery $${fmt(deliveryFee)})`, margin, y)
    doc.setTextColor(0)
    y += lh
  }

  return doc
}

/**
 * Descarga la comanda de cocina como PDF.
 */
export async function downloadKitchenOrder(order: SupabaseOrder, paper: PaperWidth = "75mm", name?: string, deliveryFee?: number): Promise<void> {
  const doc = await generateKitchenOrder(order, paper, name, deliveryFee)
  doc.save(`comanda-${order.id}.pdf`)
}
