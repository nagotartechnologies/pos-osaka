"use client"

import { Clock, X } from "lucide-react"
import { formatVisibilitySchedule, type Product } from "@/lib/supabase-menu"

export interface VisibilityForm {
  enabled: boolean
  days: number[]
  timeStart: string
  timeEnd: string
}

export const emptyVisibilityForm: VisibilityForm = { enabled: false, days: [], timeStart: "", timeEnd: "" }

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

export function productToVisibilityForm(p: Partial<Product>): VisibilityForm {
  const days = Array.isArray(p.visible_days)
    ? p.visible_days.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    : []
  const enabled = days.length > 0 || !!(p.visible_time_start && p.visible_time_end)
  return {
    enabled,
    days: enabled && days.length === 0 ? ALL_DAYS : days,
    timeStart: p.visible_time_start || "",
    timeEnd: p.visible_time_end || "",
  }
}

export function validateVisibilityForm(form: VisibilityForm): string | null {
  if (!form.enabled) return null
  if (form.days.length === 0) return "Selecciona al menos un día."
  if (!form.timeStart || !form.timeEnd) return "Define la hora de inicio y fin."
  if (form.timeStart === form.timeEnd) return "La hora de inicio y fin no pueden ser iguales."
  return null
}

/** Columnas a guardar en products (todo null = siempre disponible). */
export function formToVisibilityColumns(form: VisibilityForm) {
  if (!form.enabled || validateVisibilityForm(form)) {
    return { visible_days: null, visible_time_start: null, visible_time_end: null }
  }
  return {
    visible_days: form.days.length === 7 ? null : [...form.days].sort(),
    visible_time_start: form.timeStart,
    visible_time_end: form.timeEnd,
  }
}

const DAY_CHIPS = [
  { value: 1, label: "L" }, { value: 2, label: "M" }, { value: 3, label: "X" }, { value: 4, label: "J" },
  { value: 5, label: "V" }, { value: 6, label: "S" }, { value: 0, label: "D" },
]

interface VisibilityFieldsProps {
  form: VisibilityForm
  setForm: (updater: (prev: VisibilityForm) => VisibilityForm) => void
}

export function VisibilityFields({ form, setForm }: VisibilityFieldsProps) {
  const error = validateVisibilityForm(form)
  const summary = !error && form.enabled ? formatVisibilitySchedule(formToVisibilityColumns(form)) : ""

  const toggleDay = (day: number) =>
    setForm((prev) => ({ ...prev, days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day] }))

  const inputCls = "w-full rounded-lg border border-border bg-background px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"

  return (
    <div className="rounded-xl border border-sky-500/20 p-4 space-y-3" style={{ background: form.enabled ? "rgba(14,165,233,0.05)" : undefined }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-card-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Disponible solo en un horario
          </p>
          <p className="text-xs text-muted-foreground">Fuera del horario el producto no aparece en la carta ni en el POS</p>
        </div>
        {form.enabled ? (
          <button
            type="button"
            onClick={() => setForm(() => ({ ...emptyVisibilityForm }))}
            className="flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400 hover:underline"
          >
            <X className="h-3 w-3" />
            Quitar horario
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setForm(() => ({ enabled: true, days: ALL_DAYS, timeStart: "13:00", timeEnd: "14:00" }))}
            className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
          >
            Activar
          </button>
        )}
      </div>

      {form.enabled && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-muted-foreground">Días</label>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, days: [1, 2, 3, 4, 5] }))} className="text-[10px] font-medium text-primary hover:underline">Lun–Vie</button>
                <span className="text-muted-foreground/40">·</span>
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, days: [0, 6] }))} className="text-[10px] font-medium text-primary hover:underline">Fin de semana</button>
                <span className="text-muted-foreground/40">·</span>
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, days: ALL_DAYS }))} className="text-[10px] font-medium text-primary hover:underline">Todos</button>
              </div>
            </div>
            <div className="flex gap-1.5">
              {DAY_CHIPS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${form.days.includes(d.value) ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Desde</label>
              <input type="time" value={form.timeStart} onChange={(e) => setForm((prev) => ({ ...prev, timeStart: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Hasta</label>
              <input type="time" value={form.timeEnd} onChange={(e) => setForm((prev) => ({ ...prev, timeEnd: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Hora de Chile. Si &quot;Hasta&quot; es menor que &quot;Desde&quot;, termina al día siguiente.</p>

          {error && <p className="text-[11px] font-semibold text-red-500">{error}</p>}
          {summary && <p className="text-[11px] text-sky-600 dark:text-sky-400">Visible: {summary}</p>}
        </>
      )}
    </div>
  )
}
