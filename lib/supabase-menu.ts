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

export type DiscountStatus = "active" | "scheduled" | "expired" | null

type DiscountFields = Pick<Product, "discount_pct" | "discount_start" | "discount_end">

// Normaliza el porcentaje: Postgres numeric puede llegar como string.
function normalizePct(pct: unknown): number | null {
  const n = Number(pct)
  if (!Number.isFinite(n) || n <= 0 || n >= 100) return null
  return n
}

export function getDiscountStatus(p: DiscountFields, now = Date.now()): DiscountStatus {
  const pct = normalizePct(p.discount_pct)
  if (pct === null) return null
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
  p: Pick<Product, "price" | "discount_pct" | "discount_start" | "discount_end">,
  now = Date.now()
): number {
  const base = Number(p.price)
  const pct = getActiveDiscountPct(p, now)
  if (pct === null) return base
  return Math.round((base * (100 - pct)) / 100)
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

export async function batchUpdateDiscount(
  ids: string[],
  pct: number | null,
  start: string | null,
  end: string | null
): Promise<boolean> {
  if (ids.length === 0) return true
  const updates: Record<string, number | string | null> =
    pct === null
      ? { discount_pct: null, discount_start: null, discount_end: null }
      : { discount_pct: pct, discount_start: start, discount_end: end }
  const { error } = await supabase
    .from("products")
    .update(updates)
    .in("id", ids)
  if (error) { console.error("batchUpdateDiscount error:", error); return false }
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
