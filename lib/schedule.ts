/**
 * Utilidades para horarios de atención del negocio.
 * Se almacena en Supabase config como JSON en la key "schedule".
 */

export type DayKey = "lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom"

export interface DaySchedule {
  open: boolean
  from: string // "HH:mm"
  to: string   // "HH:mm"
}

export type WeekSchedule = Record<DayKey, DaySchedule>

export const DAY_LABELS: Record<DayKey, string> = {
  lun: "Lunes",
  mar: "Martes",
  mie: "Miércoles",
  jue: "Jueves",
  vie: "Viernes",
  sab: "Sábado",
  dom: "Domingo",
}

export const DAY_KEYS: DayKey[] = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]

// JS getDay(): 0=dom, 1=lun, ..., 6=sab → mapeo a nuestras keys
const JS_DAY_MAP: DayKey[] = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"]

export const DEFAULT_SCHEDULE: WeekSchedule = {
  lun: { open: true, from: "11:00", to: "23:00" },
  mar: { open: true, from: "11:00", to: "23:00" },
  mie: { open: true, from: "11:00", to: "23:00" },
  jue: { open: true, from: "11:00", to: "23:00" },
  vie: { open: true, from: "11:00", to: "23:00" },
  sab: { open: true, from: "11:00", to: "23:00" },
  dom: { open: false, from: "11:00", to: "23:00" },
}

/**
 * Parsea el JSON de schedule desde la config.
 * Si no hay o es inválido, usa horaApertura/horaCierre como fallback.
 */
export function parseSchedule(
  scheduleJson?: string | null,
  horaApertura?: string,
  horaCierre?: string
): WeekSchedule {
  if (scheduleJson) {
    try {
      const parsed = JSON.parse(scheduleJson)
      // Validar que tenga los 7 días
      const valid = DAY_KEYS.every((k) => parsed[k] && typeof parsed[k].open === "boolean")
      if (valid) return parsed as WeekSchedule
    } catch {}
  }
  // Fallback: usar horaApertura/horaCierre respetando el patrón de días de DEFAULT_SCHEDULE
  const from = horaApertura || "11:00"
  const to = horaCierre || "23:00"
  const schedule: Partial<WeekSchedule> = {}
  DAY_KEYS.forEach((k) => {
    schedule[k] = { open: DEFAULT_SCHEDULE[k].open, from, to }
  })
  return schedule as WeekSchedule
}

/**
 * Verifica si el negocio está abierto ahora.
 * Retorna { isOpen, todaySchedule, currentDayKey }
 */
export function checkStoreOpen(schedule: WeekSchedule, now?: Date): {
  isOpen: boolean
  todaySchedule: DaySchedule
  currentDayKey: DayKey
  nextOpenDay: DayKey | null
  nextOpenTime: string | null
} {
  const date = now || new Date()
  const dayKey = JS_DAY_MAP[date.getDay()]
  const today = schedule[dayKey]

  if (!today.open) {
    const next = findNextOpenDay(schedule, dayKey)
    return { isOpen: false, todaySchedule: today, currentDayKey: dayKey, ...next }
  }

  // Verificar hora actual
  const currentMinutes = date.getHours() * 60 + date.getMinutes()
  const [fromH, fromM] = today.from.split(":").map(Number)
  const [toH, toM] = today.to.split(":").map(Number)
  const openMinutes = fromH * 60 + fromM
  const closeMinutes = toH * 60 + toM

  // Si cierra después de medianoche (ej: 11:00 - 02:00)
  if (closeMinutes < openMinutes) {
    const isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes
    if (!isOpen) {
      const next = findNextOpenDay(schedule, dayKey)
      return { isOpen: false, todaySchedule: today, currentDayKey: dayKey, ...next }
    }
    return { isOpen: true, todaySchedule: today, currentDayKey: dayKey, nextOpenDay: null, nextOpenTime: null }
  }

  const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes

  if (!isOpen) {
    // Si aún no abre hoy
    if (currentMinutes < openMinutes) {
      return { isOpen: false, todaySchedule: today, currentDayKey: dayKey, nextOpenDay: dayKey, nextOpenTime: today.from }
    }
    // Ya cerró hoy
    const next = findNextOpenDay(schedule, dayKey)
    return { isOpen: false, todaySchedule: today, currentDayKey: dayKey, ...next }
  }

  return { isOpen: true, todaySchedule: today, currentDayKey: dayKey, nextOpenDay: null, nextOpenTime: null }
}

function findNextOpenDay(schedule: WeekSchedule, currentDay: DayKey): { nextOpenDay: DayKey | null; nextOpenTime: string | null } {
  const idx = DAY_KEYS.indexOf(currentDay)
  for (let i = 1; i <= 7; i++) {
    const nextKey = DAY_KEYS[(idx + i) % 7]
    if (schedule[nextKey].open) {
      return { nextOpenDay: nextKey, nextOpenTime: schedule[nextKey].from }
    }
  }
  return { nextOpenDay: null, nextOpenTime: null }
}
