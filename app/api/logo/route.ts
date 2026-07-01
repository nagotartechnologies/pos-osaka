import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * Sirve el logo del negocio como imagen binaria directa (sin redirect).
 * Los navegadores NO siguen 302 para favicons ni iconos PWA/manifest,
 * por eso esta ruta actúa como proxy y devuelve los bytes de la imagen.
 *
 * Prioridad:
 *  1. data URL base64 guardado en config.logo  (más rápido, sin red extra)
 *  2. logoPublicUrl en Storage (proxy de bytes via fetch)
 *  3. Fallback PNG estático en /icon-512.png
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const size = searchParams.get("s") // "192" o "512"

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return fallbackIcon()

    const supabase = createClient(url, key)

    // 1. Intentar data URL base64 del logo (logo o logoLight)
    const { data: rows } = await supabase
      .from("config")
      .select("key, value")
      .in("key", ["logo", "logoPublicUrl"])

    const cfg: Record<string, string> = {}
    for (const r of rows || []) cfg[r.key] = r.value

    const s = size === "512" ? 512 : 192

    // 1. logoPublicUrl en Storage → imgproxy redimensiona al tamaño exacto pedido
    //    Esto garantiza que el PNG devuelto sea exactamente SxS px (requerido por Chrome PWA)
    if (cfg.logoPublicUrl) {
      const storageUrl = cfg.logoPublicUrl.includes("/storage/v1/object/public/")
        ? `${cfg.logoPublicUrl.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=${s}&height=${s}&resize=fill&background=0x00000000`
        : cfg.logoPublicUrl
      const imgRes = await fetch(storageUrl)
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer()
        const ct = imgRes.headers.get("content-type") ?? "image/png"
        return new NextResponse(buf, {
          headers: {
            "Content-Type": ct,
            "Cache-Control": "public, max-age=3600",
          },
        })
      }
    }

    // 2. Fallback: data URL base64 (imagen original sin redimensionar)
    if (cfg.logo && cfg.logo.startsWith("data:")) {
      const [header, b64] = cfg.logo.split(",")
      const mime = header.match(/data:(.*?);/)?.[1] ?? "image/png"
      const buffer = Buffer.from(b64, "base64")
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "public, max-age=3600",
        },
      })
    }

    return fallbackIcon()
  } catch {
    return fallbackIcon()
  }
}

function fallbackIcon() {
  // SVG genérico inline — no requiere archivos estáticos ni red
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
    <rect width="192" height="192" rx="32" fill="#1a1210"/>
    <text x="96" y="120" font-size="100" text-anchor="middle" fill="#c1272d" font-family="serif">🍣</text>
  </svg>`
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=60" },
  })
}
