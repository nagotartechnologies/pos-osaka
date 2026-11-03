import { createClient, SupabaseClient } from "@supabase/supabase-js"

/**
 * Cliente de Supabase con service_role. SOLO para código de servidor
 * (API routes, server components). Salta RLS: nunca importarlo en el cliente.
 */
let _admin: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("getAdminClient() solo puede usarse en el servidor")
  if (_admin) return _admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!serviceKey) console.warn("SUPABASE_SERVICE_ROLE_KEY no configurada: el servidor usará la anon key")
  _admin = createClient(url, serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _admin
}
