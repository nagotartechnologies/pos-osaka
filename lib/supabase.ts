import { createClient, SupabaseClient } from "@supabase/supabase-js"

export const STORAGE_BUCKET = "productos"

// ── Cliente compartido (singleton global) ───────────────────────
let _shared: SupabaseClient | null = null

export function getSharedClient(): SupabaseClient {
  if (_shared) return _shared
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  _shared = createClient(url, key)
  return _shared
}

/**
 * Sube una imagen al bucket de Supabase Storage.
 * Retorna la URL pública de la imagen.
 */
export async function uploadProductImage(
  supabase: SupabaseClient,
  file: File,
  productId: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg"
  const fileName = `${productId}-${Date.now()}.${ext}`
  const filePath = `menu/${fileName}`

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    })

  if (error) throw error

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath)

  return data.publicUrl
}

/**
 * Elimina una imagen del bucket de Supabase Storage.
 */
export async function deleteProductImage(
  supabase: SupabaseClient,
  imageUrl: string
): Promise<void> {
  // Extraer el path del archivo desde la URL pública
  const bucketPath = imageUrl.split(`/storage/v1/object/public/${STORAGE_BUCKET}/`)[1]
  if (!bucketPath) return

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([bucketPath])

  if (error) throw error
}

/**
 * Prueba la conexión a Supabase verificando acceso al storage.
 */
export async function testConnection(
  url: string,
  anonKey: string
): Promise<{ success: boolean; message: string }> {
  try {
    const client = url && anonKey ? createClient(url, anonKey) : getSharedClient()
    const { error } = await client.storage.listBuckets()
    if (error) {
      return { success: false, message: error.message }
    }
    return { success: true, message: "Conexión exitosa" }
  } catch (e: any) {
    return { success: false, message: e.message || "Error de conexión" }
  }
}
