/**
 * Almacenamiento de imágenes/archivos en Supabase Storage (self-host).
 * Mantiene la misma API pública que la versión anterior (Cloudinary)
 * para no romper los componentes que la consumen.
 */

import { getSharedClient, STORAGE_BUCKET } from "@/lib/supabase"

// Marcador de rutas públicas y de transformación de Supabase Storage.
const PUBLIC_OBJECT_SEG = "/storage/v1/object/public/"
const RENDER_IMAGE_SEG = "/storage/v1/render/image/public/"

function extFromMime(mime: string): string {
  if (mime.includes("webp")) return "webp"
  if (mime.includes("png")) return "png"
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg"
  if (mime.includes("gif")) return "gif"
  if (mime.includes("svg")) return "svg"
  if (mime.includes("pdf")) return "pdf"
  return "bin"
}

function randomName(ext: string): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${id}.${ext}`
}

/** Sube un Blob al bucket y devuelve su URL pública. */
async function uploadBlob(path: string, blob: Blob, contentType: string): Promise<string> {
  const sb = getSharedClient()
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: true,
    contentType,
  })
  if (error) throw new Error(error.message || "Error al subir archivo")
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Comprime una imagen en el cliente antes de subirla.
 * Reduce el tamaño máximo y la calidad para ahorrar ancho de banda y cuota.
 */
async function compressImage(file: File, maxWidth = 800, quality = 0.75): Promise<Blob> {
  // Si es menor a 100KB, no comprimir
  if (file.size < 100_000) return file

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      let w = img.width
      let h = img.height
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w)
        w = maxWidth
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => resolve(blob || file),
        "image/webp",
        quality,
      )
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Sube un archivo de imagen a Cloudinary.
 * Comprime automáticamente antes de subir para ahorrar cuota.
 * @param file - Archivo a subir
 * @param folder - Carpeta en Cloudinary (ej: "menu", "logos")
 * @returns URL segura de la imagen subida
 */
export async function uploadImage(file: File, folder: string = "menu"): Promise<string> {
  // Comprimir imagen antes de subir
  const maxW = folder === "comprobantes" ? 600 : 800
  const compressed = await compressImage(file, maxW, 0.75)
  const contentType = compressed.type || "image/webp"
  const path = `pos-osaka/${folder}/${randomName(extFromMime(contentType))}`
  return uploadBlob(path, compressed, contentType)
}

/**
 * Sube una imagen desde un data URL (base64) a Cloudinary.
 * Útil para logos que ya están en base64.
 */
export async function uploadBase64Image(dataUrl: string, folder: string = "logos"): Promise<string> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const contentType = blob.type || "image/png"
  const path = `pos-osaka/${folder}/${randomName(extFromMime(contentType))}`
  return uploadBlob(path, blob, contentType)
}

/**
 * Sube un PDF (Blob) a Cloudinary como archivo raw.
 * Retorna la URL pública del archivo.
 */
export async function uploadPdfToCloudinary(blob: Blob, fileName: string): Promise<string> {
  const path = `pos-osaka/recibos/${Date.now()}-${fileName}`
  return uploadBlob(path, blob, "application/pdf")
}

/**
 * Optimiza una URL de Cloudinary agregando transformaciones automáticas.
 * Esto permite delegar la optimización a Cloudinary en vez de a Next.js Image Optimization.
 * @param url - URL original de Cloudinary
 * @param width - Ancho deseado (default 400)
 * @param quality - Calidad (default "auto")
 */
export function optimizeCloudinaryUrl(url: string, width: number = 400, quality: string = "auto"): string {
  if (!url || !url.includes(PUBLIC_OBJECT_SEG)) return url
  // Convertir a endpoint de transformación de imágenes (imgproxy) con ancho/calidad.
  const base = url.replace(PUBLIC_OBJECT_SEG, RENDER_IMAGE_SEG)
  const q = quality === "auto" ? "" : `&quality=${quality}`
  return `${base}?width=${width}${q}`
}

/**
 * Verifica si Cloudinary está configurado.
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/**
 * Elimina una imagen de Cloudinary usando la API route server-side.
 * @param url - URL completa de la imagen en Cloudinary
 */
export async function deleteCloudinaryImage(url: string): Promise<boolean> {
  if (!url || !url.includes(PUBLIC_OBJECT_SEG)) return false
  try {
    // Extraer el path dentro del bucket: .../object/public/<bucket>/<path>
    const after = url.split(`${PUBLIC_OBJECT_SEG}${STORAGE_BUCKET}/`)[1]
    if (!after) return false
    const path = after.split("?")[0]
    const sb = getSharedClient()
    const { error } = await sb.storage.from(STORAGE_BUCKET).remove([path])
    return !error
  } catch {
    return false
  }
}
