/**
 * CRUD de respuestas rápidas usando Supabase.
 */

import { getSharedClient } from "@/lib/supabase"

export interface QuickReply {
  id: string
  title: string
  message: string
  sort_order: number
  created_at: string
}

function getClient() {
  return getSharedClient()
}

export async function getQuickReplies(): Promise<QuickReply[]> {
  const sb = getClient()
  if (!sb) return []
  const { data, error } = await sb
    .from("quick_replies")
    .select("*")
    .order("sort_order", { ascending: true })
  if (error) {
    console.error("getQuickReplies error:", error)
    return []
  }
  return data || []
}

export async function addQuickReply(title: string, message: string): Promise<QuickReply | null> {
  const sb = getClient()
  if (!sb) return null
  const { data: existing } = await sb.from("quick_replies").select("sort_order").order("sort_order", { ascending: false }).limit(1)
  const nextOrder = (existing?.[0]?.sort_order || 0) + 1
  const { data, error } = await sb
    .from("quick_replies")
    .insert({ title, message, sort_order: nextOrder })
    .select()
  if (error) {
    console.error("addQuickReply error:", JSON.stringify(error))
    return null
  }
  return data?.[0] || null
}

export async function updateQuickReply(id: string, title: string, message: string): Promise<boolean> {
  const sb = getClient()
  if (!sb) return false
  const { error } = await sb
    .from("quick_replies")
    .update({ title, message })
    .eq("id", id)
  if (error) {
    console.error("updateQuickReply error:", error)
    return false
  }
  return true
}

export async function deleteQuickReply(id: string): Promise<boolean> {
  const sb = getClient()
  if (!sb) return false
  const { error } = await sb
    .from("quick_replies")
    .delete()
    .eq("id", id)
  if (error) {
    console.error("deleteQuickReply error:", error)
    return false
  }
  return true
}
