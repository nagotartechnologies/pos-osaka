import { getSharedClient } from "@/lib/supabase"

const supabase = getSharedClient()

// ─── Tipos ───

export interface CustomizationOption {
  name: string
  price: number
}

export interface Product {
  id: string
  name: string
  price: number
  image: string
  category: string
  description: string
  available: boolean
  sort_order: number
  created_at: string
  protein_options?: CustomizationOption[] | null
  wrapper_options?: CustomizationOption[] | null
  allow_custom_build?: boolean
  per_unit_choice?: boolean
  choice_count?: number | null
  discount_pct?: number | null
  discount_start?: string | null
  discount_end?: string | null
  discount_days?: number[] | null
  discount_time_start?: string | null
  discount_time_end?: string | null
}

export interface Category {
  id: string
  name: string
  sort_order: number
}

// ─── Productos nuevos ───

export const NEW_PRODUCT_DAYS = 14

export function isNewProduct(createdAt?: string | null): boolean {
  if (!createdAt) return false
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return Date.now() - created < NEW_PRODUCT_DAYS * 24 * 60 * 60 * 1000
}

export function sortNewFirst<T>(items: T[], getCreatedAt: (item: T) => string | undefined | null): T[] {
  return [...items].sort((a, b) => {
    const aNew = isNewProduct(getCreatedAt(a))
    const bNew = isNewProduct(getCreatedAt(b))
    if (aNew !== bNew) return aNew ? -1 : 1
    if (aNew && bNew) {
      return new Date(getCreatedAt(b) || 0).getTime() - new Date(getCreatedAt(a) || 0).getTime()
    }
    return 0
  })
}

// ─── Descuentos por tiempo limitado ───

export type DiscountStatus = "active" | "scheduled" | "expired" | "recurring" | null

type DiscountFields = Pick<Product,
  "discount_pct" | "discount_start" | "discount_end" | "discount_days" | "discount_time_start" | "discount_time_end">

// Zona horaria fija de la tienda. Los descuentos semanales se evalúan en esta
// zona sin importar la zona del navegador del usuario.
const STORE_TZ = "America/Santiago"

const WEEKDAY_SHORT_TO_NUM: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

// Devuelve { day: 0..6 (dom..sáb), minutes: minutos desde medianoche } en la
// zona horaria de la tienda para el instante `now` (ms epoch UTC).
export function getStoreClock(now: number): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now))
  let day = -1
  let hour = 0
  let minute = 0
  for (const part of parts) {
    if (part.type === "weekday") day = WEEKDAY_SHORT_TO_NUM[part.value] ?? -1
    else if (part.type === "hour") hour = parseInt(part.value, 10) || 0
    else if (part.type === "minute") minute = parseInt(part.value, 10) || 0
  }
  return { day, minutes: hour * 60 + minute }
}

// Normaliza el porcentaje: Postgres numeric puede llegar como string.
function normalizePct(pct: unknown): number | null {
  const n = Number(pct)
  if (!Number.isFinite(n) || n <= 0 || n >= 100) return null
  return n
}

// Normaliza discount_days: Postgres smallint[] puede llegar como string[].
function normalizeDays(days: unknown): number[] {
  if (!Array.isArray(days)) return []
  const nums = days.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  return Array.from(new Set(nums))
}

const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

function parseTimeToMinutes(t: string | null | undefined): number | null {
  if (!t || !TIME_RE.test(t)) return null
  const [h, m] = t.split(":").map((x) => parseInt(x, 10))
  return h * 60 + m
}

export function getDiscountStatus(p: DiscountFields, now = Date.now()): DiscountStatus {
  const pct = normalizePct(p.discount_pct)
  if (pct === null) return null

  const days = normalizeDays(p.discount_days)
  const isWeekly = days.length > 0

  if (isWeekly) {
    // Vigencia global opcional
    let start: number | null = null
    let end: number | null = null
    if (p.discount_start) {
      start = new Date(p.discount_start).getTime()
      if (Number.isNaN(start)) return null
    }
    if (p.discount_end) {
      end = new Date(p.discount_end).getTime()
      if (Number.isNaN(end)) return null
    }
    if (start !== null && end !== null && end <= start) return null
    if (end !== null && now >= end) return "expired"
    if (start !== null && now < start) return "scheduled"

    // Ventana diaria
    const ts = parseTimeToMinutes(p.discount_time_start)
    const te = parseTimeToMinutes(p.discount_time_end)
    const hasHorario = ts !== null && te !== null
    // Si solo una hora está presente, o son iguales → config inválida
    if ((ts !== null) !== (te !== null)) return null
    if (hasHorario && ts === te) return null

    const clock = getStoreClock(now)
    const day = clock.day
    const min = clock.minutes

    if (!hasHorario) {
      // Todo el día: activo si el día actual está en days
      return days.includes(day) ? "active" : "recurring"
    }

    // Hay ventana [ts, te)
    if (te > ts) {
      // Misma jornada
      const active = days.includes(day) && min >= ts && min < te
      return active ? "active" : "recurring"
    }
    // te < ts → cruza medianoche: activo si (day ∈ days && min >= ts) ||
    // (día anterior ∈ days && min < te)
    const prevDay = (day + 6) % 7
    const active = (days.includes(day) && min >= ts) || (days.includes(prevDay) && min < te)
    return active ? "active" : "recurring"
  }

  // Modo fecha única: fechas obligatorias
  if (!p.discount_start || !p.discount_end) return null
  const start = new Date(p.discount_start).getTime()
  const end = new Date(p.discount_end).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null
  if (now < start) return "scheduled"
  if (now >= end) return "expired"
  return "active"
}

export function getActiveDiscountPct(p: DiscountFields, now = Date.now()): number | null {
  const status = getDiscountStatus(p, now)
  if (status !== "active") return null
  return normalizePct(p.discount_pct)
}

export function getEffectivePrice(
  p: Pick<Product, "price" | "discount_pct" | "discount_start" | "discount_end" | "discount_days" | "discount_time_start" | "discount_time_end">,
  now = Date.now()
): number {
  const base = Number(p.price)
  const pct = getActiveDiscountPct(p, now)
  if (pct === null) return base
  return Math.round((base * (100 - pct)) / 100)
}

// ─── Descuentos: configuración y persistencia ───

export interface DiscountConfig {
  pct: number
  start: string | null
  end: string | null
  days: number[] | null
  timeStart: string | null
  timeEnd: string | null
}

// Convierte un DiscountConfig (o null) en el objeto de columnas a guardar.
export function discountConfigToColumns(config: DiscountConfig | null): Record<string, number | string | number[] | null> {
  if (!config) {
    return {
      discount_pct: null,
      discount_start: null,
      discount_end: null,
      discount_days: null,
      discount_time_start: null,
      discount_time_end: null,
    }
  }
  return {
    discount_pct: config.pct,
    discount_start: config.start,
    discount_end: config.end,
    discount_days: config.days && config.days.length > 0 ? config.days : null,
    discount_time_start: config.timeStart,
    discount_time_end: config.timeEnd,
  }
}

export async function batchUpdateDiscount(
  ids: string[],
  config: DiscountConfig | null
): Promise<boolean> {
  if (ids.length === 0) return true
  const updates = discountConfigToColumns(config)
  const { error } = await supabase
    .from("products")
    .update(updates)
    .in("id", ids)
  if (error) { console.error("batchUpdateDiscount error:", error); return false }
  return true
}

// ─── Descuentos: etiquetas para UI ───

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
// Índice en DAY_LABELS para cada valor de día (0=dom..6=sáb): dom→6, lun→0, ...
const DAY_LABEL_INDEX: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }
// Orden de presentación Lun..Dom → valores 1,2,3,4,5,6,0
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

// Resumen del descuento para el admin.
export function formatDiscountSchedule(p: DiscountFields): string {
  const pct = normalizePct(p.discount_pct)
  if (pct === null) return ""
  const days = normalizeDays(p.discount_days)
  if (days.length > 0) {
    let diasTxt: string
    if (days.length === 7) {
      diasTxt = "Todos los días"
    } else {
      const ordered = DAY_ORDER.filter((d) => days.includes(d))
      diasTxt = ordered.map((d) => DAY_LABELS[DAY_LABEL_INDEX[d]]).join(", ")
    }
    const ts = parseTimeToMinutes(p.discount_time_start)
    const te = parseTimeToMinutes(p.discount_time_end)
    const hasHorario = ts !== null && te !== null && ts !== te
    const horarioTxt = hasHorario
      ? ` · ${p.discount_time_start}–${p.discount_time_end}`
      : " · todo el día"
    let endTxt = ""
    if (p.discount_end) {
      const d = new Date(p.discount_end)
      if (!Number.isNaN(d.getTime())) {
        endTxt = ` · hasta ${d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })}`
      }
    }
    return `${diasTxt}${horarioTxt}${endTxt}`
  }
  // Fecha única
  if (!p.discount_start || !p.discount_end) return ""
  const s = new Date(p.discount_start)
  const e = new Date(p.discount_end)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return ""
  const fmt = (d: Date) =>
    `${d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`
  return `${fmt(s)} – ${fmt(e)}`
}

// Etiqueta corta para el cliente en la carta (solo si el descuento está activo).
export function getDiscountCustomerLabel(p: DiscountFields, now = Date.now()): string | null {
  const status = getDiscountStatus(p, now)
  if (status !== "active") return null
  const days = normalizeDays(p.discount_days)
  if (days.length > 0) {
    const ts = parseTimeToMinutes(p.discount_time_start)
    const te = parseTimeToMinutes(p.discount_time_end)
    const hasHorario = ts !== null && te !== null && ts !== te
    if (hasHorario) return `Oferta de hoy hasta ${p.discount_time_end}`
    return "Oferta de hoy"
  }
  // Fecha única
  if (!p.discount_end) return null
  const e = new Date(p.discount_end)
  if (Number.isNaN(e.getTime())) return null
  return `Oferta hasta ${e.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })} ${e.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`
}

// ─── Productos ───

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) { console.error("getProducts error:", error); return [] }
  return data || []
}

export async function getAvailableProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("available", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) { console.error("getAvailableProducts error:", error); return [] }
  return data || []
}

export async function addProduct(
  product: Omit<Product, "created_at">
): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .insert(product)
    .select()
    .single()
  if (error) { console.error("addProduct error:", error); return null }
  return data
}

export async function updateProduct(
  id: string,
  updates: Partial<Omit<Product, "id" | "created_at">>
): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", id)
    .select()
    .single()
  if (error) { console.error("updateProduct error:", error); return null }
  return data
}

export async function deleteProduct(id: string): Promise<boolean> {
  const { error } = await supabase.from("products").delete().eq("id", id)
  if (error) { console.error("deleteProduct error:", error); return false }
  return true
}

export async function batchUpdateCustomization(
  ids: string[],
  proteinOptions: CustomizationOption[] | null,
  wrapperOptions: CustomizationOption[] | null
): Promise<boolean> {
  for (const id of ids) {
    const { error } = await supabase
      .from("products")
      .update({ protein_options: proteinOptions, wrapper_options: wrapperOptions })
      .eq("id", id)
    if (error) { console.error("batchUpdateCustomization error:", error); return false }
  }
  return true
}

export async function deleteAllProducts(): Promise<boolean> {
  const { error } = await supabase.from("products").delete().neq("id", "")
  if (error) { console.error("deleteAllProducts error:", error); return false }
  return true
}

// ─── Categorías ───

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
  if (error) { console.error("getCategories error:", error); return [] }
  return data || []
}

export async function addCategory(cat: Category): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .insert(cat)
    .select()
    .single()
  if (error) { console.error("addCategory error:", error); return null }
  return data
}

export async function updateCategory(
  id: string,
  updates: Partial<Omit<Category, "id">>
): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .update(updates)
    .eq("id", id)
    .select()
    .single()
  if (error) { console.error("updateCategory error:", error); return null }
  return data
}

export async function deleteCategory(id: string): Promise<boolean> {
  const { error } = await supabase.from("categories").delete().eq("id", id)
  if (error) { console.error("deleteCategory error:", error); return false }
  return true
}

export async function updateCategorySortOrders(
  orders: { id: string; sort_order: number }[]
): Promise<boolean> {
  for (const o of orders) {
    const { error } = await supabase
      .from("categories")
      .update({ sort_order: o.sort_order })
      .eq("id", o.id)
    if (error) { console.error("updateCategorySortOrders error:", error); return false }
  }
  return true
}

export async function batchUpdateCustomBuild(productIds: string[], allow: boolean): Promise<boolean> {
  for (const id of productIds) {
    const { error } = await supabase
      .from("products")
      .update({ allow_custom_build: allow })
      .eq("id", id)
    if (error) { console.error("batchUpdateCustomBuild error:", error); return false }
  }
  return true
}

// ─── Seed: migrar datos hardcoded a Supabase (solo si tablas vacías) ───

export async function seedIfEmpty(
  defaultProducts: { id: string; name: string; price: number; image: string; category: string }[],
  defaultCategories: { id: string; name: string }[]
): Promise<void> {
  // Verificar si ya hay datos
  const { count: prodCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
  const { count: catCount } = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true })

  if ((catCount ?? 0) === 0 && defaultCategories.length > 0) {
    const cats = defaultCategories.map((c, i) => ({
      id: c.id,
      name: c.name,
      sort_order: i,
    }))
    await supabase.from("categories").insert(cats)
    console.log(`Seeded ${cats.length} categories`)
  }

  if ((prodCount ?? 0) === 0 && defaultProducts.length > 0) {
    const prods = defaultProducts.map((p, i) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image,
      category: p.category,
      description: "",
      available: true,
      sort_order: i,
    }))
    await supabase.from("products").insert(prods)
    console.log(`Seeded ${prods.length} products`)
  }
}
