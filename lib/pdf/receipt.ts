import type { SupabaseOrder } from "@/lib/supabase-orders"
import { loadLogo, loadAddress } from "@/lib/config-store"
import { PAPER, fmt, getBizName, type PaperWidth } from "./shared"

/**
 * Genera un recibo PDF estilo ticket para un pedido de Supabase.
 * jsPDF se carga dinámicamente para no inflar el bundle (~300KB).
 */
export async function generateOrderReceipt(
  order: SupabaseOrder,
  paper: PaperWidth = "75mm",
  logoUrl?: string,
  name?: string,
  addr?: string,
  deliveryFee?: number,
) {
  const { jsPDF } = await import("jspdf")

  const cfg = PAPER[paper]
  const { width, margin } = cfg
  const contentWidth = width - margin * 2
  const lh = paper === "58mm" ? 4.5 : 6.5

  const fee = order.delivery_type === "delivery" && deliveryFee && deliveryFee > 0 ? deliveryFee : 0
  const discount = order.discount && order.discount > 0 ? order.discount : 0
  const unitPrice = (it: any) => (it.customBuild && it.quotedPrice != null ? it.quotedPrice : it.price)
  const itemsSubtotal = order.items.reduce((sum: number, it: any) => {
    const extrasTotal = (it.extras || []).filter((e: any) => e.description?.trim()).reduce((s: number, e: any) => s + (Number(e.price) || 0), 0)
    return sum + (unitPrice(it) + extrasTotal) * it.quantity
  }, 0)
  const itemLines = order.items.reduce((acc: number, it: any) => {
    let lines = 2.6
    if (it.category) lines += 1
    if (it.customBuild) {
      lines += 1
      if (it.customBuildNotes?.trim()) lines += Math.ceil(it.customBuildNotes.trim().length / 25)
    }
    if (it.notes?.trim()) lines += 1
    lines += (it.extras || []).filter((e: any) => e.description?.trim()).length
    return acc + lines
  }, 0)
  const baseHeight = 120 + itemLines * lh + (order.payment_method === "efectivo" && order.cash_amount ? 12 : 0) + (fee > 0 ? 8 : 0) + (discount > 0 ? lh : 0)
  const doc = new jsPDF({ unit: "mm", format: [width, baseHeight] })

  const logo = logoUrl || loadLogo("dark")
  const businessName = getBizName(name)
  const address = addr || loadAddress()

  let y = 6

  // ── Logo ──
  if (logo) {
    try {
      const s = cfg.logoSize
      doc.addImage(logo, "PNG", width / 2 - s / 2, y, s, s)
      y += s + 3
    } catch {}
  }

  // ── Nombre del negocio ──
  doc.setFontSize(cfg.titleSize)
  doc.setFont("helvetica", "bold")
  doc.text(businessName, width / 2, y, { align: "center" })
  y += cfg.titleSize * 0.45 + 1

  // ── Dirección ──
  if (address) {
    doc.setFontSize(cfg.smallSize)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(20)
    doc.text(address, width / 2, y, { align: "center", maxWidth: contentWidth })
    y += cfg.smallSize * 0.4 + 1
    doc.setTextColor(0)
  }

  y += 1

  // ── Separador ──
  doc.setDrawColor(180)
  doc.setLineWidth(1.0)
  doc.setLineDashPattern([1, 1], 0)
  doc.line(margin, y, width - margin, y)
  y += 3

  // ── Pedido + Fecha ──
  const orderDate = new Date(order.created_at)
  const dateStr = orderDate.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })
  const timeStr = orderDate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })

  doc.setFontSize(cfg.bodySize)
  doc.setFont("helvetica", "bold")
  doc.text(`Pedido: ${order.id}`, margin, y)
  doc.setFont("helvetica", "normal")
  doc.text(`${dateStr} ${timeStr}`, width - margin, y, { align: "right" })
  y += lh + 1

  // ── Cliente ──
  doc.setFontSize(cfg.bodySize)
  doc.setFont("helvetica", "bold")
  doc.text(`Cliente: ${order.client_name}`, margin, y)
  y += lh
  doc.setFont("helvetica", "normal")
  doc.text(`Tel: ${order.client_phone}`, margin, y)
  y += lh

  // ── Entrega ──
  const deliveryLabel = order.delivery_type === "delivery" ? `Delivery: ${order.address || ""}` : "Retiro en local"
  doc.text(deliveryLabel.length > cfg.maxNameLen + 10 ? deliveryLabel.slice(0, cfg.maxNameLen + 10) + "..." : deliveryLabel, margin, y)
  y += lh + 1

  // ── Separador ──
  doc.setLineWidth(1.0)
  doc.line(margin, y, width - margin, y)
  y += 3

  // ── Encabezado items ──
  doc.setFontSize(cfg.bodySize)
  doc.setFont("helvetica", "bold")
  doc.text("Producto", margin, y)
  doc.text("Cant", margin + contentWidth * 0.62, y)
  doc.text("Total", width - margin, y, { align: "right" })
  y += lh + 1

  // ── Items ──
  doc.setFont("helvetica", "normal")
  doc.setFontSize(cfg.bodySize)
  order.items.forEach((item: any) => {
    const up = unitPrice(item)
    const itemTotal = fmt(up * item.quantity)
    const itemName = item.name.length > cfg.maxNameLen ? item.name.slice(0, cfg.maxNameLen) + "..." : item.name
    
    // Mostrar categoría si existe - en bold para impresora térmica
    if (item.category) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(cfg.bodySize)
      doc.setTextColor(0)
      doc.text(item.category.toUpperCase(), margin, y)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(cfg.bodySize)
      y += lh
    }

    doc.setFont("helvetica", "bold")
    doc.text(itemName, margin, y)
    doc.setFont("helvetica", "normal")
    doc.text(`${item.quantity}`, margin + contentWidth * 0.65, y)
    doc.text(`$${itemTotal}`, width - margin, y, { align: "right" })
    y += lh

    // Extras con precio
    if (item.extras && item.extras.length > 0) {
      item.extras.forEach((extra: any) => {
        if (!extra.description?.trim()) return
        doc.setFontSize(cfg.smallSize)
        doc.setTextColor(80)
        const extraLabel = extra.price > 0
          ? `+ ${extra.description.trim()} ($${fmt(extra.price)})`
          : `+ ${extra.description.trim()}`
        doc.text(extraLabel, margin + 2, y)
        y += lh * 0.8
        doc.setTextColor(0)
        doc.setFontSize(cfg.bodySize)
      })
    }

    // Notas de "ármalo a tu pinta"
    if (item.customBuild) {
      doc.setFontSize(cfg.smallSize)
      doc.setTextColor(80)
      doc.text("Ármalo a tu pinta", margin + 2, y)
      y += lh * 0.8
      if (item.customBuildNotes?.trim()) {
        const cleanNotes = item.customBuildNotes.trim()
        const noteLines = doc.splitTextToSize(cleanNotes, contentWidth - 4)
        noteLines.forEach((line: string) => {
          doc.text(line, margin + 2, y)
          y += lh * 0.8
        })
      }
      doc.setTextColor(0)
      doc.setFontSize(cfg.bodySize)
    }

    // Notas del cliente
    if (item.notes?.trim() && !item.customBuild) {
      doc.setFontSize(cfg.smallSize)
      doc.setTextColor(80)
      doc.text(`> ${item.notes.trim().slice(0, 40)}`, margin + 2, y)
      y += lh * 0.8
      doc.setTextColor(0)
      doc.setFontSize(cfg.bodySize)
    }

    y += 1
  })

  y += 2

  // ── Separador ──
  doc.setLineWidth(1.0)
  doc.setLineDashPattern([1, 1], 0)
  doc.line(margin, y, width - margin, y)
  y += 3

  // ── Subtotal, Delivery, Descuento ──
  doc.setFontSize(cfg.bodySize)
  doc.setFont("helvetica", "normal")
  if (fee > 0 || discount > 0) {
    doc.text("Subtotal", margin, y)
    doc.text(`$${fmt(itemsSubtotal)}`, width - margin, y, { align: "right" })
    y += lh
    if (fee > 0) {
      doc.text("Delivery", margin, y)
      doc.text(`$${fmt(fee)}`, width - margin, y, { align: "right" })
      y += lh
    }
    if (discount > 0) {
      doc.setTextColor(180, 0, 0)
      doc.text("Descuento", margin, y)
      doc.text(`-$${fmt(discount)}`, width - margin, y, { align: "right" })
      doc.setTextColor(0)
      y += lh
    }
    y += 1
  }

  // ── Total ──
  doc.setFont("helvetica", "bold")
  doc.setFontSize(cfg.titleSize)
  doc.text("TOTAL", margin, y)
  doc.text(`$${fmt(order.total)}`, width - margin, y, { align: "right" })
  y += lh + 3

  // ── Método de pago ──
  doc.setFont("helvetica", "normal")
  doc.setFontSize(cfg.bodySize)
  const payLabel = order.payment_method === "efectivo" ? "Efectivo" : order.payment_method === "transferencia" ? "Transferencia" : "Tarjeta"
  doc.text(`Pago: ${payLabel}`, margin, y)
  y += lh

  // ── Vuelto (efectivo) ──
  if (order.payment_method === "efectivo" && order.cash_amount) {
    doc.text(`Paga con: $${fmt(order.cash_amount)}`, margin, y)
    y += lh
    doc.setFont("helvetica", "bold")
    doc.text(`Vuelto: $${fmt(order.change_amount || 0)}`, margin, y)
    doc.setFont("helvetica", "normal")
    y += lh + 1
  }

  y += 2

  // ── Separador ──
  doc.line(margin, y, width - margin, y)
  y += 4

  // ── Pie ──
  doc.setFontSize(cfg.smallSize)
  doc.setTextColor(100)
  doc.text("Gracias por su preferencia!", width / 2, y, { align: "center" })
  y += lh
  doc.text("Vuelva pronto", width / 2, y, { align: "center" })
  doc.setTextColor(0)

  return doc
}

/**
 * Genera el PDF y lo descarga directamente.
 */
export async function downloadOrderReceipt(order: SupabaseOrder, paper: PaperWidth = "75mm", logoUrl?: string, name?: string, addr?: string, deliveryFee?: number): Promise<void> {
  const doc = await generateOrderReceipt(order, paper, logoUrl, name, addr, deliveryFee)
  doc.save(`recibo-${order.id}.pdf`)
}

/**
 * Genera el PDF y retorna un Blob para compartir.
 */
export async function getOrderReceiptBlob(order: SupabaseOrder, paper: PaperWidth = "75mm", logoUrl?: string, name?: string, addr?: string, deliveryFee?: number): Promise<Blob> {
  const doc = await generateOrderReceipt(order, paper, logoUrl, name, addr, deliveryFee)
  return doc.output("blob")
}

/**
 * Comparte el recibo por WhatsApp.
 */
export async function shareReceiptWhatsApp(order: SupabaseOrder, paper: PaperWidth = "75mm", logoUrl?: string, name?: string, addr?: string, deliveryFee?: number): Promise<void> {
  const blob = await getOrderReceiptBlob(order, paper, logoUrl, name, addr, deliveryFee)
  const file = new File([blob], `recibo-${order.id}.pdf`, { type: "application/pdf" })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: `Recibo ${order.id}`,
        text: `Recibo del pedido ${order.id} - $${fmt(order.total)}`,
        files: [file],
      })
      return
    } catch {}
  }

  await downloadOrderReceipt(order, paper, logoUrl, name, addr, deliveryFee)
  const phone = order.client_phone.replace(/[^0-9+]/g, "")
  const msg = encodeURIComponent(`Hola, te envío el recibo del pedido ${order.id} por $${fmt(order.total)}`)
  window.open(`https://wa.me/${phone}?text=${msg}`, "_blank")
}
