"use client"

import { useEffect, useState } from "react"

/** Hora actual que se refresca cada minuto (para promos/descuentos por horario). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
