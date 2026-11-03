import type { Metadata } from "next"
import { getAdminClient } from "@/lib/supabase-admin"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://osakasushi.nagotartech.com"

// Metadatos Open Graph para que WhatsApp muestre la vista previa (logo + nombre)
// cuando se comparte el link de la carta.
export async function generateMetadata(): Promise<Metadata> {
  let bizName = "Nuestra carta"
  try {
    const sb = getAdminClient()
    const { data } = await sb.from("config").select("value").eq("key", "nombreNegocio").single()
    if (data?.value) bizName = data.value.trim()
  } catch {}

  const title = `${bizName} — Carta digital`
  const description = "Mira nuestra carta y haz tu pedido directamente aquí."
  const image = { url: "/api/logo?s=512", width: 512, height: 512 }

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: { title, description, type: "website", images: [image] },
    twitter: { card: "summary", title, description, images: [image.url] },
  }
}

export default function CartaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
