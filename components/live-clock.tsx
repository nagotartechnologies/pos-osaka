"use client"

import { useState, useEffect } from "react"

interface LiveClockProps {
  className?: string
}

export function LiveClock({ className = "" }: LiveClockProps) {
  const [time, setTime] = useState("")
  const [date, setDate] = useState("")

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }))
      setDate(now.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" }))
    }
    update()
    const interval = setInterval(update, 10_000) // cada 10s
    return () => clearInterval(interval)
  }, [])

  if (!time) return null

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <span className="text-[11px] font-bold tabular-nums text-foreground/70">{time}</span>
      <span className="text-[8px] font-medium text-muted-foreground capitalize">{date}</span>
    </div>
  )
}
