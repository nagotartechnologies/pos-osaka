/**
 * Historial de jornadas laborales (Iniciar Día → Cerrar Día).
 * El día laboral es exactamente el periodo entre la apertura y el cierre
 * manual, así que los reportes de días pasados usan estas ventanas en vez de
 * un horario fijo. Se guarda como JSON en config.businessDays.
 */

import { getConfigValue, setConfigValue } from "@/lib/supabase-config"

export interface BusinessDay {
  start: string
  close: string | null
}

const KEY = "businessDays"
const MAX_ENTRIES = 400

export async function getBusinessDays(): Promise<BusinessDay[]> {
  const raw = await getConfigValue(KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function saveBusinessDays(days: BusinessDay[]): Promise<boolean> {
  const sorted = [...days].sort((a, b) => a.start.localeCompare(b.start)).slice(-MAX_ENTRIES)
  return setConfigValue(KEY, JSON.stringify(sorted))
}

export async function recordDayStart(startIso: string): Promise<boolean> {
  const days = await getBusinessDays()
  if (days.some((d) => d.start === startIso)) return true
  return saveBusinessDays([...days, { start: startIso, close: null }])
}

// Registra el cierre de la jornada iniciada en startIso. Si esa jornada no está
// en el historial (p. ej. se inició antes de existir el historial) se agrega.
export async function recordDayClose(startIso: string, closeIso: string): Promise<boolean> {
  const days = await getBusinessDays()
  const idx = days.findIndex((d) => d.start === startIso)
  if (idx === -1) days.push({ start: startIso, close: closeIso })
  else days[idx] = { ...days[idx], close: closeIso }
  return saveBusinessDays(days)
}

// Fecha (YYYY-MM-DD, hora Santiago) a la que pertenece una jornada: la de su inicio.
export function businessDayDate(startIso: string): string {
  return new Date(startIso).toLocaleDateString("sv-SE", { timeZone: "America/Santiago" })
}

export async function getBusinessDaysForDate(dateStr: string): Promise<BusinessDay[]> {
  const days = await getBusinessDays()
  return days.filter((d) => businessDayDate(d.start) === dateStr)
}
