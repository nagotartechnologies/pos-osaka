/**
 * Barrel re-export — toda la lógica de PDFs vive en lib/pdf/*.
 * Este archivo mantiene compatibilidad con los imports existentes.
 */
export type { PaperWidth } from "./pdf/shared"
export { generateOrderReceipt, downloadOrderReceipt, getOrderReceiptBlob, shareReceiptWhatsApp } from "./pdf/receipt"
export { generateKitchenOrder, downloadKitchenOrder } from "./pdf/kitchen"
export { generateDailyClosingComanda, downloadDailyClosingComanda } from "./pdf/closing"
export { downloadFinanzasReport, downloadInventarioReport } from "./pdf/reports"
export type { ReportTransaction, ReportInventoryItem } from "./pdf/reports"
