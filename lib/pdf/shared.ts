import { loadBusinessName } from "@/lib/config-store"

export type PaperWidth = "58mm" | "75mm"

export interface PaperConfig {
  width: number
  margin: number
  logoSize: number
  titleSize: number
  bodySize: number
  smallSize: number
  maxNameLen: number
}

export const PAPER: Record<PaperWidth, PaperConfig> = {
  "58mm": { width: 58, margin: 4, logoSize: 14, titleSize: 9, bodySize: 7, smallSize: 5.5, maxNameLen: 18 },
  "75mm": { width: 75, margin: 5, logoSize: 18, titleSize: 11, bodySize: 9, smallSize: 7, maxNameLen: 24 },
}

export function fmt(n: number): string {
  return n.toLocaleString("es-CL")
}

export function getBizName(name?: string): string {
  return name || loadBusinessName() || "Osaka POS"
}

// ── Helpers A4 ────────────────────────────────────────────────────
export function drawTableHeader(doc: any, cols: { label: string; x: number; w: number }[], y: number, pageW: number) {
  doc.setFillColor(40, 40, 40)
  doc.rect(14, y - 4, pageW - 28, 7, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  for (const col of cols) doc.text(col.label, col.x, y)
  doc.setTextColor(0, 0, 0)
}

export function drawRow(doc: any, cols: { value: string; x: number; align?: "right" | "left" }[], y: number, shade: boolean, pageW: number) {
  if (shade) { doc.setFillColor(245, 245, 245); doc.rect(14, y - 3.5, pageW - 28, 6, "F") }
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(30, 30, 30)
  for (const col of cols) {
    if (col.align === "right") {
      doc.text(col.value, col.x, y, { align: "right" })
    } else {
      doc.text(col.value, col.x, y)
    }
  }
}
