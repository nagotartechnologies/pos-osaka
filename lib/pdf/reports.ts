import { getBizName, drawTableHeader, drawRow } from "./shared"

// ── Tipos para reportes ────────────────────────────────────────────
export interface ReportTransaction {
  date: string
  type: "ingreso" | "egreso"
  category: string
  description: string
  paymentMethod: string
  amount: number
}

export interface ReportInventoryItem {
  name: string
  category: string
  stock: number
  min_stock: number
  unit: string
  cost_per_unit: number
  supplier: string
}

/**
 * Genera reporte de finanzas en A4.
 */
export async function downloadFinanzasReport(
  transactions: ReportTransaction[],
  period: string,
  businessName?: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" })
  const pageW = 210
  const margin = 14

  const biz = getBizName(businessName)
  const dateStr = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })
  const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`

  const ingresos = transactions.filter((t) => t.type === "ingreso").reduce((s, t) => s + t.amount, 0)
  const egresos = transactions.filter((t) => t.type === "egreso").reduce((s, t) => s + t.amount, 0)
  const balance = ingresos - egresos

  let y = 18

  // Encabezado
  doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(20, 20, 20)
  doc.text("Reporte de Finanzas", margin, y); y += 6
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100)
  doc.text(`${biz}  ·  Período: ${period}  ·  Generado: ${dateStr}`, margin, y); y += 8

  // Línea separadora
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(margin, y, pageW - margin, y); y += 6

  // Tarjetas resumen
  const cards = [
    { label: "Ingresos", value: fmt(ingresos), color: [34, 197, 94] as [number, number, number] },
    { label: "Egresos", value: fmt(egresos), color: [239, 68, 68] as [number, number, number] },
    { label: "Balance", value: fmt(balance), color: balance >= 0 ? [59, 130, 246] as [number, number, number] : [249, 115, 22] as [number, number, number] },
  ]
  const cardW = (pageW - margin * 2 - 8) / 3
  for (let i = 0; i < cards.length; i++) {
    const cx = margin + i * (cardW + 4)
    doc.setFillColor(cards[i].color[0], cards[i].color[1], cards[i].color[2])
    doc.roundedRect(cx, y, cardW, 14, 2, 2, "F")
    doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont("helvetica", "bold")
    doc.text(cards[i].label, cx + 3, y + 5)
    doc.setFontSize(10); doc.text(cards[i].value, cx + 3, y + 11)
  }
  y += 20

  // Tabla transacciones
  const cols = [
    { label: "FECHA", x: margin + 1, w: 20 },
    { label: "TIPO", x: margin + 22, w: 16 },
    { label: "CATEGORÍA", x: margin + 39, w: 30 },
    { label: "DESCRIPCIÓN", x: margin + 70, w: 65 },
    { label: "MÉTODO", x: margin + 136, w: 24 },
    { label: "MONTO", x: pageW - margin - 1, w: 20 },
  ]
  drawTableHeader(doc, cols, y, pageW); y += 5

  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  let shade = false
  for (const t of sorted) {
    if (y > 270) { doc.addPage(); y = 18 }
    const descTrunc = t.description.length > 48 ? t.description.slice(0, 47) + "…" : t.description
    drawRow(doc, [
      { value: t.date, x: margin + 1 },
      { value: t.type === "ingreso" ? "Ingreso" : "Egreso", x: margin + 22 },
      { value: t.category.length > 20 ? t.category.slice(0, 19) + "…" : t.category, x: margin + 39 },
      { value: descTrunc, x: margin + 70 },
      { value: t.paymentMethod, x: margin + 136 },
      { value: fmt(t.amount), x: pageW - margin - 1, align: "right" },
    ], y, shade, pageW)
    // Color de tipo
    doc.setFontSize(6.5); doc.setFont("helvetica", "bold")
    doc.setTextColor(t.type === "ingreso" ? 34 : 220, t.type === "ingreso" ? 150 : 50, t.type === "ingreso" ? 50 : 50)
    doc.text(t.type === "ingreso" ? "Ingreso" : "Egreso", margin + 22, y)
    doc.setTextColor(30, 30, 30)
    shade = !shade; y += 5.5
  }

  // Totales finales
  y += 2
  doc.setDrawColor(180, 180, 180); doc.line(margin, y, pageW - margin, y); y += 5
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(20, 20, 20)
  doc.text(`Total ingresos: ${fmt(ingresos)}`, margin, y)
  doc.text(`Total egresos: ${fmt(egresos)}`, margin + 60, y)
  doc.setTextColor(balance >= 0 ? 34 : 220, balance >= 0 ? 150 : 50, balance >= 0 ? 50 : 50)
  doc.text(`Balance: ${fmt(balance)}`, margin + 125, y)

  const filename = `finanzas-${period.replace(/\s/g, "-")}-${dateStr.replace(/\//g, "-")}.pdf`
  doc.save(filename)
}

/**
 * Genera reporte de inventario en A4.
 */
export async function downloadInventarioReport(
  items: ReportInventoryItem[],
  businessName?: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" })
  const pageW = 297
  const margin = 14

  const biz = getBizName(businessName)
  const dateStr = new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })
  const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`

  const bajoStock = items.filter((i) => i.stock <= i.min_stock)
  const valorTotal = items.reduce((s, i) => s + i.stock * i.cost_per_unit, 0)

  let y = 18

  // Encabezado
  doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(20, 20, 20)
  doc.text("Reporte de Inventario", margin, y); y += 6
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100)
  doc.text(`${biz}  ·  Generado: ${dateStr}  ·  ${items.length} productos  ·  ${bajoStock.length} bajo stock`, margin, y); y += 8

  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(margin, y, pageW - margin, y); y += 6

  // Tarjetas
  const cards = [
    { label: "Total productos", value: String(items.length), color: [59, 130, 246] as [number, number, number] },
    { label: "Bajo stock", value: String(bajoStock.length), color: [239, 68, 68] as [number, number, number] },
    { label: "Valor en stock", value: fmt(valorTotal), color: [34, 197, 94] as [number, number, number] },
  ]
  const cardW = (pageW - margin * 2 - 8) / 3
  for (let i = 0; i < cards.length; i++) {
    const cx = margin + i * (cardW + 4)
    doc.setFillColor(cards[i].color[0], cards[i].color[1], cards[i].color[2])
    doc.roundedRect(cx, y, cardW, 14, 2, 2, "F")
    doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont("helvetica", "bold")
    doc.text(cards[i].label, cx + 3, y + 5)
    doc.setFontSize(10); doc.text(cards[i].value, cx + 3, y + 11)
  }
  y += 20

  // Tabla
  const cols = [
    { label: "NOMBRE", x: margin + 1, w: 55 },
    { label: "CATEGORÍA", x: margin + 57, w: 35 },
    { label: "STOCK", x: margin + 93, w: 20 },
    { label: "MÍN.", x: margin + 114, w: 16 },
    { label: "UNIDAD", x: margin + 131, w: 22 },
    { label: "COSTO UNIT.", x: margin + 154, w: 30 },
    { label: "VALOR TOTAL", x: margin + 185, w: 30 },
    { label: "PROVEEDOR", x: margin + 216, w: 40 },
    { label: "ESTADO", x: pageW - margin - 1, w: 20 },
  ]
  drawTableHeader(doc, cols, y, pageW); y += 5

  const sorted = [...items].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  let shade = false
  for (const item of sorted) {
    if (y > 190) { doc.addPage(); y = 18 }
    const bajo = item.stock <= item.min_stock
    drawRow(doc, [
      { value: item.name.length > 36 ? item.name.slice(0, 35) + "…" : item.name, x: margin + 1 },
      { value: item.category.length > 22 ? item.category.slice(0, 21) + "…" : item.category, x: margin + 57 },
      { value: String(item.stock), x: margin + 93 },
      { value: String(item.min_stock), x: margin + 114 },
      { value: item.unit, x: margin + 131 },
      { value: fmt(item.cost_per_unit), x: margin + 154 },
      { value: fmt(item.stock * item.cost_per_unit), x: margin + 185 },
      { value: item.supplier.length > 26 ? item.supplier.slice(0, 25) + "…" : item.supplier, x: margin + 216 },
      { value: "", x: pageW - margin - 1 },
    ], y, shade, pageW)
    // Badge estado
    doc.setFontSize(6.5); doc.setFont("helvetica", "bold")
    if (bajo) {
      doc.setFillColor(254, 226, 226); doc.roundedRect(pageW - margin - 18, y - 3.2, 16, 4.5, 1, 1, "F")
      doc.setTextColor(185, 28, 28); doc.text("BAJO", pageW - margin - 10, y, { align: "center" })
    } else {
      doc.setFillColor(220, 252, 231); doc.roundedRect(pageW - margin - 18, y - 3.2, 16, 4.5, 1, 1, "F")
      doc.setTextColor(21, 128, 61); doc.text("OK", pageW - margin - 10, y, { align: "center" })
    }
    doc.setTextColor(30, 30, 30)
    shade = !shade; y += 5.5
  }

  doc.save(`inventario-${dateStr.replace(/\//g, "-")}.pdf`)
}
