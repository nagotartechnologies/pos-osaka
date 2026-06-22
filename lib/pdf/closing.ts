import type { SupabaseOrder } from "@/lib/supabase-orders"
import { PAPER, getBizName, type PaperWidth } from "./shared"

/**
 * Genera el cierre del día: resumen de pedidos para impresora térmica.
 */
export async function generateDailyClosingComanda(
  orders: SupabaseOrder[],
  paper: PaperWidth = "75mm",
  businessName?: string,
  deliveryFee?: number,
): Promise<any> {
  const { jsPDF } = await import("jspdf")

  const cfg = PAPER[paper]
  const { width, margin } = cfg
  const lh = paper === "58mm" ? 3.5 : 4.2
  const kcfg = { titleSize: cfg.titleSize - 1, bodySize: cfg.bodySize - 1, smallSize: cfg.smallSize - 1 }

  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0)
  const efectivo = orders.filter((o) => o.payment_method === "efectivo")
  const transferencia = orders.filter((o) => o.payment_method === "transferencia")
  const delivery = orders.filter((o) => o.delivery_type === "delivery")
  const retiro = orders.filter((o) => o.delivery_type === "retiro")

  // Agrupar items vendidos
  const itemMap = new Map<string, { qty: number; total: number }>()
  for (const o of orders) {
    for (const it of o.items) {
      const key = it.name
      const prev = itemMap.get(key) || { qty: 0, total: 0 }
      itemMap.set(key, { qty: prev.qty + it.quantity, total: prev.total + it.price * it.quantity })
    }
  }
  const itemRows = Array.from(itemMap.entries()).sort((a, b) => b[1].qty - a[1].qty)

  const baseHeight = 80 + orders.length * lh * 2.2 + itemRows.length * lh * 1.8 + 60
  const doc = new jsPDF({ unit: "mm", format: [width, baseHeight] })

  const biz = getBizName(businessName)
  const dateStr = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })

  let y = 6

  // ── Título ──
  doc.setFontSize(kcfg.titleSize + 3)
  doc.setFont("helvetica", "bold")
  doc.text("CIERRE DEL DÍA", width / 2, y, { align: "center" })
  y += lh + 1
  doc.setFontSize(kcfg.bodySize)
  doc.setFont("helvetica", "normal")
  doc.text(biz, width / 2, y, { align: "center" })
  y += lh * 0.8
  doc.text(dateStr, width / 2, y, { align: "center" })
  y += lh + 1

  doc.setLineWidth(1.2)
  doc.setLineDashPattern([], 0)
  doc.line(margin, y, width - margin, y)
  y += 3

  // ── Resumen ──
  doc.setFontSize(kcfg.bodySize)
  doc.setFont("helvetica", "bold")
  doc.text(`Pedidos:`, margin, y)
  doc.text(`${orders.length}`, width - margin, y, { align: "right" })
  y += lh
  doc.text(`Total:`, margin, y)
  doc.text(`$${totalRevenue.toLocaleString("es-CL")}`, width - margin, y, { align: "right" })
  y += lh
  if (orders.length > 0) {
    doc.setFont("helvetica", "normal")
    doc.text(`Promedio:`, margin, y)
    doc.text(`$${Math.round(totalRevenue / orders.length).toLocaleString("es-CL")}`, width - margin, y, { align: "right" })
    y += lh
  }

  y += 1
  doc.setLineDashPattern([1, 1], 0)
  doc.line(margin, y, width - margin, y)
  y += 3

  // ── Métodos de pago ──
  doc.setFontSize(kcfg.smallSize)
  doc.setFont("helvetica", "bold")
  doc.text("COBROS", margin, y)
  y += lh * 0.9
  doc.setFont("helvetica", "normal")
  doc.text(`Efectivo (${efectivo.length}):`, margin, y)
  doc.text(`$${efectivo.reduce((s, o) => s + o.total, 0).toLocaleString("es-CL")}`, width - margin, y, { align: "right" })
  y += lh * 0.9
  doc.text(`Transferencia (${transferencia.length}):`, margin, y)
  doc.text(`$${transferencia.reduce((s, o) => s + o.total, 0).toLocaleString("es-CL")}`, width - margin, y, { align: "right" })
  y += lh * 0.9
  doc.text(`Delivery: ${delivery.length}   Retiro: ${retiro.length}`, margin, y)
  y += lh + 1

  doc.setLineDashPattern([1, 1], 0)
  doc.line(margin, y, width - margin, y)
  y += 3

  // ── Items vendidos ──
  doc.setFontSize(kcfg.smallSize)
  doc.setFont("helvetica", "bold")
  doc.text("ITEMS VENDIDOS", margin, y)
  y += lh * 0.9
  doc.setFont("helvetica", "normal")
  for (const [name, { qty, total }] of itemRows) {
    const label = `${qty}x ${name.length > cfg.maxNameLen ? name.slice(0, cfg.maxNameLen) + "…" : name}`
    doc.text(label, margin, y)
    doc.text(`$${total.toLocaleString("es-CL")}`, width - margin, y, { align: "right" })
    y += lh * 0.9
  }
  y += 1

  doc.setLineDashPattern([1, 1], 0)
  doc.line(margin, y, width - margin, y)
  y += 3

  // ── Lista de pedidos ──
  doc.setFontSize(kcfg.smallSize)
  doc.setFont("helvetica", "bold")
  doc.text("PEDIDOS DEL DÍA", margin, y)
  y += lh * 0.9
  for (const o of orders) {
    doc.setFont("helvetica", "bold")
    doc.text(`#${o.id}`, margin, y)
    doc.text(`$${o.total.toLocaleString("es-CL")}`, width - margin, y, { align: "right" })
    y += lh * 0.8
    doc.setFont("helvetica", "normal")
    const timeStr = new Date(o.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
    const clientLabel = o.client_name.length > cfg.maxNameLen ? o.client_name.slice(0, cfg.maxNameLen) + "…" : o.client_name
    doc.setFontSize(kcfg.smallSize - 0.5)
    doc.text(`${timeStr} · ${clientLabel} · ${o.payment_method}`, margin, y)
    y += lh * 0.9
  }

  return doc
}

/**
 * Descarga el cierre del día como PDF.
 */
export async function downloadDailyClosingComanda(
  orders: SupabaseOrder[],
  paper: PaperWidth = "75mm",
  businessName?: string,
  deliveryFee?: number,
  date?: Date,
): Promise<void> {
  const doc = await generateDailyClosingComanda(orders, paper, businessName, deliveryFee)
  const dateStr = (date || new Date()).toLocaleDateString("es-CL").replace(/\//g, "-")
  doc.save(`cierre-${dateStr}.pdf`)
}
