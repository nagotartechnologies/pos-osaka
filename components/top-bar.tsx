"use client"

import { CalendarDays, Clock, Search } from "lucide-react"
import { useState, useEffect } from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { loadLogoForTheme, loadBusinessName } from "@/lib/config-store"
import { getAllConfig } from "@/lib/supabase-config"
import { NotificationBell } from "@/components/notification-bell"

export function TopBar({ searchQuery, onSearchChange }: { searchQuery: string; onSearchChange: (q: string) => void }) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [logo, setLogo] = useState("")
  const [businessName, setBusinessName] = useState("")
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)

    // Cargar desde localStorage primero (rápido)
    setLogo(loadLogoForTheme(resolvedTheme))
    setBusinessName(loadBusinessName())

    // Luego cargar desde Supabase como fallback/actualización
    getAllConfig().then((cfg) => {
      if (cfg.nombreNegocio) setBusinessName(cfg.nombreNegocio)
      const supaLogo = cfg.logoPublicUrl
      if (supaLogo) setLogo(supaLogo)
    })

    return () => clearInterval(timer)
  }, [])

  // Actualizar logo cuando cambia el tema
  useEffect(() => {
    if (mounted) {
      const localLogo = loadLogoForTheme(resolvedTheme)
      if (localLogo) {
        setLogo(localLogo)
      } else {
        getAllConfig().then((cfg) => {
          const supaLogo = cfg.logoPublicUrl
          if (supaLogo) setLogo(supaLogo)
        })
      }
    }
  }, [resolvedTheme, mounted])

  const formatDate = (date: Date) => {
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    return `${days[date.getDay()]}, ${String(date.getDate()).padStart(2, "0")} ${months[date.getMonth()]} ${date.getFullYear()}`
  }

  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    const period = date.getHours() >= 12 ? "PM" : "AM"
    return { time: `${hours}:${minutes}`, period }
  }

  const dateStr = currentTime ? formatDate(currentTime) : "--"
  const { time, period } = currentTime ? formatTime(currentTime) : { time: "--:--", period: "--" }

  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <div className="flex items-center gap-2.5">
        {logo ? (
          <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg">
            <Image src={logo} alt="Logo" fill className="object-contain" sizes="36px" />
          </div>
        ) : null}
        <span className="text-sm font-bold text-foreground truncate max-w-[160px]">
          {businessName || "Osaka POS"}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-card px-4 py-2.5 shadow-sm border border-border">
        <CalendarDays className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium text-card-foreground">{dateStr}</span>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-card px-4 py-2.5 shadow-sm border border-border">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm font-medium text-card-foreground">{time}</span>
        <span className="text-xs text-muted-foreground">{period}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <NotificationBell />
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-card px-4 py-2.5 shadow-sm border border-border min-w-[200px]">
        <Search className="h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar . . ."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="border-none bg-transparent text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none w-full"
        />
      </div>
    </div>
  )
}
