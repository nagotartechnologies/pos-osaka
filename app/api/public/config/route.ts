import { NextRequest, NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"
import { isDebitDeliveryBlocked } from "@/lib/debit-limit"

// Keys de config que se pueden exponer sin sesión. Todo lo demás (PINs,
// teléfono admin, límites internos, etc.) queda solo para el staff.
const BRANDING_KEYS = ["nombreNegocio", "logoPublicUrl", "themeColor"]
const CARTA_KEYS = [
  ...BRANDING_KEYS,
  "newProductDays", "whatsapp", "direccion", "deliveryFee", "highDemandMsg", "promoBanners",
  "ordersBlocked", "ordersBlockedMsg", "deliveryZoneEnabled", "deliveryZoneMsg", "cardPaymentsEnabled",
  "bankData", "schedule", "horaApertura", "horaCierre", "lastDayStart", "lastDayClose",
]

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") || ""
  const sb = getAdminClient()
  const { data, error } = await sb.from("config").select("key, value").in("key", [...CARTA_KEYS, "cartaCode"])
  if (error) return NextResponse.json({ error: "Error al cargar configuración" }, { status: 500 })

  const all: Record<string, string> = {}
  for (const r of data || []) all[r.key] = r.value
  const authorized = !!code && !!all.cartaCode && code === all.cartaCode

  const config: Record<string, string> = {}
  for (const k of authorized ? CARTA_KEYS : BRANDING_KEYS) if (all[k] !== undefined) config[k] = all[k]

  const debitBlocked = authorized ? await isDebitDeliveryBlocked().catch(() => false) : false
  return NextResponse.json({ authorized, debitBlocked, config }, { headers: { "Cache-Control": "no-store" } })
}
