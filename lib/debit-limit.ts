import { getConfigValue, setConfigValue } from "@/lib/supabase-config"
import { getDebitDeliveryCountSince } from "@/lib/supabase-orders"

// Límite de ventas con débito en delivery por jornada laboral.
// Se genera un límite aleatorio entre MIN y MAX cada vez que se presiona
// "Iniciar Día" en Ventas. Al alcanzarse, la carta muestra débito como
// no disponible (solo para delivery; retiro y crédito nunca se bloquean).

const KEY_LIMIT = "debitDeliveryLimit"
const KEY_SINCE = "debitDeliverySince"

const MIN_LIMIT = 15
const MAX_LIMIT = 25

export async function resetDebitDeliveryLimit(dayStartIso: string): Promise<void> {
  const limit = Math.floor(Math.random() * (MAX_LIMIT - MIN_LIMIT + 1)) + MIN_LIMIT
  await Promise.all([
    setConfigValue(KEY_LIMIT, String(limit)),
    setConfigValue(KEY_SINCE, dayStartIso),
  ])
}

export async function isDebitDeliveryBlocked(): Promise<boolean> {
  const [limitStr, since] = await Promise.all([
    getConfigValue(KEY_LIMIT),
    getConfigValue(KEY_SINCE),
  ])
  const limit = parseInt(limitStr || "", 10)
  if (!limit || !since) return false
  const count = await getDebitDeliveryCountSince(since)
  return count >= limit
}
