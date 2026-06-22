import type { ChatMessage } from "@/lib/supabase-chat"

/** Agrupar mensajes por fecha para insertar separadores */
export function groupMessagesByDate(messages: ChatMessage[]): (ChatMessage | { _type: "date"; label: string })[] {
  const result: (ChatMessage | { _type: "date"; label: string })[] = []
  let lastDate = ""
  for (const msg of messages) {
    const d = new Date(msg.created_at)
    const dateKey = d.toLocaleDateString("es-CL", { year: "numeric", month: "2-digit", day: "2-digit" })
    if (dateKey !== lastDate) {
      const today = new Date()
      const isToday = d.toDateString() === today.toDateString()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const isYesterday = d.toDateString() === yesterday.toDateString()
      const label = isToday ? "Hoy" : isYesterday ? "Ayer" : d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })
      result.push({ _type: "date", label })
      lastDate = dateKey
    }
    result.push(msg)
  }
  return result
}

/** Formatear hora de conversación: hoy → hora, ayer → "Ayer", más → dd/mm */
export function formatConvTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  if (isToday) return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
  if (isYesterday) return "Ayer"
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })
}
