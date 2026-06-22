import { getSharedClient } from "@/lib/supabase"

// ─── Tipos ───

export interface DbTransaction {
  id: string
  type: "ingreso" | "egreso"
  category: string
  description: string
  amount: number
  date: string
  payment_method: "efectivo" | "tarjeta" | "transferencia"
  created_at: string
}

// ─── CRUD Transacciones ───

export async function getTransactions(): Promise<DbTransaction[]> {
  const supabase = getSharedClient()
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false })
    .limit(500)
  if (error) { console.error("getTransactions error:", error); return [] }
  return data || []
}

export async function addTransaction(tx: Omit<DbTransaction, "id" | "created_at">): Promise<DbTransaction | null> {
  const supabase = getSharedClient()
  const { data, error } = await supabase
    .from("transactions")
    .insert(tx)
    .select()
    .single()
  if (error) { console.error("addTransaction error:", error); return null }
  return data
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const supabase = getSharedClient()
  const { error } = await supabase.from("transactions").delete().eq("id", id)
  if (error) { console.error("deleteTransaction error:", error); return false }
  return true
}

// ─── Seed ───

export async function seedTransactionsIfEmpty(defaults: Omit<DbTransaction, "id" | "created_at">[]): Promise<void> {
  const supabase = getSharedClient()
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
  if (error || (count && count > 0)) return
  await supabase.from("transactions").insert(defaults)
}
