import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * Sirve el logo del negocio como imagen real.
 * Convierte el data URL guardado en Supabase a una respuesta binaria.
 * Uso: <img src="/api/logo" /> o en el manifest como ícono PWA.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const size = searchParams.get("s") // "192" o "512"

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return fallbackIcon(request.url)

    const supabase = createClient(url, key)

    // Intentar logoPublicUrl primero (Cloudinary)
    const { data: pubData } = await supabase
      .from("config")
      .select("value")
      .eq("key", "logoPublicUrl")
      .single()

    if (pubData?.value) {
      // Redirigir a la URL de Storage con transformación de tamaño (imgproxy)
      const s = size === "512" ? 512 : 192
      const transformed = pubData.value.includes("/storage/v1/object/public/")
        ? `${pubData.value.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=${s}&height=${s}&resize=contain`
        : pubData.value
      return NextResponse.redirect(transformed, { status: 302 })
    }

    // Fallback: convertir data URL a binario
    const { data } = await supabase
      .from("config")
      .select("value")
      .eq("key", "logo")
      .single()

    if (!data?.value || !data.value.startsWith("data:")) return fallbackIcon(request.url)

    const [header, base64] = data.value.split(",")
    const mimeMatch = header.match(/data:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : "image/png"
    const buffer = Buffer.from(base64, "base64")

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch {
    return fallbackIcon(request.url)
  }
}

function fallbackIcon(requestUrl?: string) {
  const base = requestUrl ? new URL(requestUrl).origin : "https://osakasushivic.netlify.app"
  return NextResponse.redirect(new URL("/icon-512.png", base), { status: 302 })
}
