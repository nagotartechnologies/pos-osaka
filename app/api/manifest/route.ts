import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase-admin"

export async function GET() {
  let businessName = "Osaka POS"

  // Cargar nombre del negocio desde Supabase
  try {
    const { data } = await getAdminClient().from("config").select("value").eq("key", "nombreNegocio").single()
    if (data?.value) businessName = data.value
  } catch {}

  const manifest = {
    name: businessName,
    short_name: businessName.length > 12 ? businessName.slice(0, 12) : businessName,
    description: `Sistema de punto de venta - ${businessName}`,
    start_url: "/",
    display: "standalone",
    background_color: "#1a1210",
    theme_color: "#c1272d",
    orientation: "any",
    icons: [
      {
        src: "/api/logo?s=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/api/logo?s=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300",
    },
  })
}
