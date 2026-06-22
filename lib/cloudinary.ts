/**
 * Cloudinary — subida de imágenes desde el frontend.
 * Usa unsigned upload preset para no exponer el API secret.
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ""
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || ""

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
const RAW_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`

export interface CloudinaryUploadResult {
  secure_url: string
  public_id: string
  width: number
  height: number
  format: string
  bytes: number
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
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary no está configurado. Revisa las variables de entorno.")
  }

  // Comprimir imagen antes de subir
  const maxW = folder === "comprobantes" ? 600 : 800
  const compressed = await compressImage(file, maxW, 0.75)

  const formData = new FormData()
  formData.append("file", compressed)
  formData.append("upload_preset", UPLOAD_PRESET)
  formData.append("folder", `pos-osaka/${folder}`)

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Error al subir imagen (${res.status})`)
  }

  const data: CloudinaryUploadResult = await res.json()
  return data.secure_url
}

/**
 * Sube una imagen desde un data URL (base64) a Cloudinary.
 * Útil para logos que ya están en base64.
 */
export async function uploadBase64Image(dataUrl: string, folder: string = "logos"): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary no está configurado. Revisa las variables de entorno.")
  }

  const formData = new FormData()
  formData.append("file", dataUrl)
  formData.append("upload_preset", UPLOAD_PRESET)
  formData.append("folder", `pos-osaka/${folder}`)

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Error al subir imagen (${res.status})`)
  }

  const data: CloudinaryUploadResult = await res.json()
  return data.secure_url
}

/**
 * Sube un PDF (Blob) a Cloudinary como archivo raw.
 * Retorna la URL pública del archivo.
 */
export async function uploadPdfToCloudinary(blob: Blob, fileName: string): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary no está configurado.")
  }

  const formData = new FormData()
  formData.append("file", blob, fileName)
  formData.append("upload_preset", UPLOAD_PRESET)
  formData.append("folder", "pos-osaka/recibos")
  formData.append("resource_type", "raw")

  const res = await fetch(RAW_UPLOAD_URL, {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Error al subir PDF (${res.status})`)
  }

  const data = await res.json()
  return data.secure_url
}

/**
 * Optimiza una URL de Cloudinary agregando transformaciones automáticas.
 * Esto permite delegar la optimización a Cloudinary en vez de a Next.js Image Optimization.
 * @param url - URL original de Cloudinary
 * @param width - Ancho deseado (default 400)
 * @param quality - Calidad (default "auto")
 */
export function optimizeCloudinaryUrl(url: string, width: number = 400, quality: string = "auto"): string {
  if (!url || !url.includes("cloudinary.com")) return url
  // Insertar transformaciones después de /upload/
  return url.replace("/upload/", `/upload/w_${width},q_${quality},f_auto/`)
}

/**
 * Verifica si Cloudinary está configurado.
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET)
}

/**
 * Elimina una imagen de Cloudinary usando la API route server-side.
 * @param url - URL completa de la imagen en Cloudinary
 */
export async function deleteCloudinaryImage(url: string): Promise<boolean> {
  if (!url || !url.includes("cloudinary")) return false
  try {
    const res = await fetch("/api/cloudinary-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-token": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" },
      body: JSON.stringify({ url }),
    })
    const data = await res.json()
    return data.ok === true
  } catch {
    return false
  }
}
