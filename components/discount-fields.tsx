"use client"

import { useMemo } from "react"
import { Tag, X } from "lucide-react"
import {
  discountConfigToColumns,
  formatDiscountSchedule,
  type DiscountConfig,
  type Product,
} from "@/lib/supabase-menu"

export interface DiscountForm {
  mode: "once" | "weekly"
  pct: string
  start: string
  end: string
  days: number[]
  useHours: boolean
  timeStart: string
  timeEnd: string
}

export const emptyDiscountForm: DiscountForm = {
  mode: "once",
  pct: "",
  start: "",
  end: "",
  days: [],
  useHours: false,
  timeStart: "",
  timeEnd: "",
}

// Convierte ISO (DB) → string local YYYY-MM-DDTHH:mm (zona del navegador)
function isoToLocalInput(iso?: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Construye un DiscountForm a partir de un producto (para editar).
export function productToDiscountForm(p: Partial<Product>): DiscountForm {
  const days = Array.isArray(p.discount_days)
    ? p.discount_days.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    : []
  const hasDays = days.length > 0
  const pct = p.discount_pct != null ? String(p.discount_pct) : ""
  const useHours =
    hasDays && !!(p.discount_time_start || p.discount_time_end)
  return {
    mode: hasDays ? "weekly" : "once",
    pct,
    start: isoToLocalInput(p.discount_start),
    end: isoToLocalInput(p.discount_end),
    days,
    useHours,
    timeStart: p.discount_time_start || "",
    timeEnd: p.discount_time_end || "",
  }
}

// Valida el formulario. Devuelve mensaje de error o null si es válido.
// Devuelve null también si el formulario está vacío (sin descuento).
export function validateDiscountForm(form: DiscountForm): string | null {
  const pctStr = form.pct.trim()
  const hasPct = pctStr !== "" && !Number.isNaN(parseFloat(pctStr))
  const hasDates = form.start !== "" || form.end !== ""
  const hasDays = form.days.length > 0
  const hasHours = form.useHours && (form.timeStart !== "" || form.timeEnd !== "")

  // Todo vacío = sin descuento
  if (!hasPct && !hasDates && !hasDays && !hasHours) return null

  if (!hasPct) return "Debes ingresar un porcentaje (1–99)."
  const pct = parseFloat(pctStr)
  if (Number.isNaN(pct) || pct <= 0 || pct >= 100) return "El porcentaje debe estar entre 1 y 99."

  if (form.mode === "weekly") {
    if (form.days.length === 0) return "Selecciona al menos un día de la semana."
    if (form.useHours) {
      if (!form.timeStart || !form.timeEnd) return "Debes definir horario de inicio y fin."
      if (form.timeStart === form.timeEnd) return "El horario de inicio y fin no pueden ser iguales."
    }
    if (form.start && form.end) {
      const s = new Date(form.start).getTime()
      const e = new Date(form.end).getTime()
      if (Number.isNaN(s) || Number.isNaN(e)) return "Las fechas no son válidas."
      if (e <= s) return "La fecha de fin debe ser mayor a la de inicio."
    }
    return null
  }

  // Modo fecha única: ambas fechas obligatorias
  if (!form.start || !form.end) return "Debes definir fecha de inicio y fin."
  const s = new Date(form.start).getTime()
  const e = new Date(form.end).getTime()
  if (Number.isNaN(s) || Number.isNaN(e)) return "Las fechas no son válidas."
  if (e <= s) return "La fecha de fin debe ser mayor a la de inicio."
  return null
}

// Convierte el formulario a DiscountConfig (o null si está vacío).
export function formToDiscountConfig(form: DiscountForm): DiscountConfig | null {
  if (validateDiscountForm(form) !== null) return null
  const pctStr = form.pct.trim()
  const hasPct = pctStr !== "" && !Number.isNaN(parseFloat(pctStr))
  const hasDays = form.days.length > 0
  const hasDates = form.start !== "" || form.end !== ""
  const hasHours = form.useHours && form.timeStart !== "" && form.timeEnd !== ""
  if (!hasPct && !hasDays && !hasDates && !hasHours) return null
  const pct = parseFloat(pctStr)
  return {
    pct,
    start: form.start ? new Date(form.start).toISOString() : null,
    end: form.end ? new Date(form.end).toISOString() : null,
    days: form.mode === "weekly" && hasDays ? form.days : null,
    timeStart: form.mode === "weekly" && hasHours ? form.timeStart : null,
    timeEnd: form.mode === "weekly" && hasHours ? form.timeEnd : null,
  }
}

// Devuelve el objeto de columnas a guardar (las 6) a partir del formulario.
export function formToDiscountColumns(form: DiscountForm) {
  return discountConfigToColumns(formToDiscountConfig(form))
}

// Devuelve el pct numérico para preview, o null si no es válido.
export function previewPct(form: DiscountForm): number | null {
  const pct = parseFloat(form.pct)
  if (Number.isNaN(pct) || pct <= 0 || pct >= 100) return null
  if (validateDiscountForm(form) !== null) return null
  return pct
}

// Días en orden Lun..Dom con sus valores y etiquetas para los chips.
const DAY_CHIPS: { value: number; label: string }[] = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "X" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 0, label: "D" },
]

interface DiscountFieldsProps {
  form: DiscountForm
  setForm: (updater: (prev: DiscountForm) => DiscountForm) => void
  basePrice?: number
}

export function DiscountFields({ form, setForm, basePrice }: DiscountFieldsProps) {
  const error = useMemo(() => validateDiscountForm(form), [form])
  const pct = previewPct(form)
  const hasAny =
    form.pct.trim() !== "" || form.start !== "" || form.end !== "" ||
    form.days.length > 0 || form.useHours

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day],
    }))
  }

  const setDays = (days: number[]) => setForm((prev) => ({ ...prev, days }))

  const clear = () => setForm(() => ({ ...emptyDiscountForm }))

  const previewPrice = pct !== null && basePrice != null && !Number.isNaN(basePrice)
    ? Math.round((basePrice * (100 - pct)) / 100)
    : null

  // Resumen para preview usando formatDiscountSchedule (necesita campos tipo Product)
  const schedule = useMemo(() => {
    if (pct === null) return ""
    return formatDiscountSchedule({
      discount_pct: pct,
      discount_start: form.start ? new Date(form.start).toISOString() : null,
      discount_end: form.end ? new Date(form.end).toISOString() : null,
      discount_days: form.mode === "weekly" ? form.days : null,
      discount_time_start: form.mode === "weekly" && form.useHours ? form.timeStart : null,
      discount_time_end: form.mode === "weekly" && form.useHours ? form.timeEnd : null,
    })
  }, [pct, form])

  return (
    <div className="rounded-xl border border-emerald-500/20 p-4 space-y-3" style={{ background: hasAny ? "rgba(16,185,129,0.05)" : undefined }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-card-foreground flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            Descuento por tiempo limitado
          </p>
          <p className="text-xs text-muted-foreground">Se activa y desactiva solo según las fechas</p>
        </div>
        {hasAny && (
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400 hover:underline"
          >
            <X className="h-3 w-3" />
            Quitar descuento
          </button>
        )}
      </div>

      {/* Selector de modo */}
      <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
        <button
          type="button"
          onClick={() => setForm((prev) => ({ ...prev, mode: "once", days: [], useHours: false, timeStart: "", timeEnd: "" }))}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${form.mode === "once" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Fecha única
        </button>
        <button
          type="button"
          onClick={() => setForm((prev) => ({ ...prev, mode: "weekly" }))}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${form.mode === "weekly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Semanal
        </button>
      </div>

      {/* Porcentaje (común) */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Porcentaje %</label>
          <input
            type="number"
            min={1}
            max={99}
            value={form.pct}
            onChange={(e) => setForm((prev) => ({ ...prev, pct: e.target.value }))}
            placeholder="Ej: 20"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {form.mode === "once" ? (
          <>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Inicio</label>
              <input
                type="datetime-local"
                value={form.start}
                onChange={(e) => setForm((prev) => ({ ...prev, start: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Fin</label>
              <input
                type="datetime-local"
                value={form.end}
                onChange={(e) => setForm((prev) => ({ ...prev, end: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Desde (opcional)</label>
              <input
                type="datetime-local"
                value={form.start}
                onChange={(e) => setForm((prev) => ({ ...prev, start: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Hasta (opcional)</label>
              <input
                type="datetime-local"
                value={form.end}
                onChange={(e) => setForm((prev) => ({ ...prev, end: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </>
        )}
      </div>
      {form.mode === "weekly" && (
        <p className="text-[10px] text-muted-foreground -mt-1">Vacío = sin fecha de término (indefinido)</p>
      )}

      {/* Días de la semana (solo semanal) */}
      {form.mode === "weekly" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-muted-foreground">Días</label>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setDays([1, 2, 3, 4, 5])} className="text-[10px] font-medium text-primary hover:underline">Lun–Vie</button>
              <span className="text-muted-foreground/40">·</span>
              <button type="button" onClick={() => setDays([0, 6])} className="text-[10px] font-medium text-primary hover:underline">Fin de semana</button>
              <span className="text-muted-foreground/40">·</span>
              <button type="button" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])} className="text-[10px] font-medium text-primary hover:underline">Todos</button>
            </div>
          </div>
          <div className="flex gap-1.5">
            {DAY_CHIPS.map((d) => {
              const active = form.days.includes(d.value)
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"}`}
                >
                  {d.label}
                </button>
              )
            })}
          </div>

          {/* Horario opcional */}
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.useHours}
                onChange={(e) => setForm((prev) => ({ ...prev, useHours: e.target.checked }))}
                className="h-3.5 w-3.5 rounded border-border"
              />
              <span className="text-xs font-medium text-card-foreground">Solo en un horario</span>
            </label>
            {form.useHours && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Desde</label>
                  <input
                    type="time"
                    value={form.timeStart}
                    onChange={(e) => setForm((prev) => ({ ...prev, timeStart: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Hasta</label>
                  <input
                    type="time"
                    value={form.timeEnd}
                    onChange={(e) => setForm((prev) => ({ ...prev, timeEnd: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
            {form.useHours && (
              <p className="text-[10px] text-muted-foreground">Si "Hasta" es menor que "Desde", termina al día siguiente.</p>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-[11px] font-semibold text-red-500">{error}</p>
      )}
      {!error && pct !== null && previewPrice !== null && (
        <div className="space-y-0.5">
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
            Precio con descuento: <span className="font-bold">${previewPrice.toLocaleString("es-CL")}</span>
            {" "}· Precio normal: ${basePrice!.toLocaleString("es-CL")}
          </p>
          {schedule && (
            <p className="text-[10px] text-muted-foreground">{schedule}</p>
          )}
        </div>
      )}
    </div>
  )
}
