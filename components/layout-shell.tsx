"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, useRef, useCallback } from "react"
import { SidebarNav } from "@/components/sidebar-nav"
import { BottomNav } from "@/components/bottom-nav"
import { LiveClock } from "@/components/live-clock"
import { isAuthenticated, getUserRole } from "@/lib/config-store"
import { GripVertical } from "lucide-react"

const PUBLIC_ROUTES = ["/carta", "/login"]
const ADMIN_ONLY_ROUTES = ["/dashboard", "/menu", "/inventario", "/finanzas", "/configuracion"]

// Hook para persistir posición en localStorage
function usePersistentPosition() {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = localStorage.getItem('timeBadgePosition')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const maxX = window.innerWidth - 100
        const maxY = window.innerHeight - 100
        setPos({
          x: Math.max(0, Math.min(parsed.x || 0, maxX)),
          y: Math.max(0, Math.min(parsed.y || 0, maxY))
        })
      } catch {}
    }
    setIsLoaded(true)
  }, [])

  const savePos = useCallback((newPos: { x: number; y: number }) => {
    setPos(newPos)
    if (typeof window !== "undefined") {
      localStorage.setItem('timeBadgePosition', JSON.stringify(newPos))
    }
  }, [])

  return { pos, setPos: savePos, isLoaded }
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [showShell, setShowShell] = useState(false)
  const [pageVisible, setPageVisible] = useState(false)
  const prevPathname = useRef(pathname)
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  // Estado para el badge de hora draggable (solo en móvil)
  const { pos: timeBadgePos, setPos: setTimeBadgePos, isLoaded } = usePersistentPosition()
  const [isDraggingTimeBadge, setIsDraggingTimeBadge] = useState(false)
  const [isHoveringBadge, setIsHoveringBadge] = useState(false)
  const timeBadgeDragStart = useRef({ x: 0, y: 0 })
  const badgeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isPublic) {
      setShowShell(false)
      return
    }
    if (!isAuthenticated()) {
      setShowShell(false)
      router.replace("/login")
      return
    }
    const role = getUserRole()
    if (role === "vendedor" && ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
      router.replace("/")
      return
    }
    setShowShell(true)
  }, [pathname, isPublic, router])

  // Animación de transición entre páginas
  useEffect(() => {
    if (pathname !== "/") {
      // Nueva ruta: fade out → fade in
      setPageVisible(false)
      const t = setTimeout(() => {
        setPageVisible(true)
      }, 120)
      return () => clearTimeout(t)
    } else {
      // Primera carga
      const t = setTimeout(() => setPageVisible(true), 80)
      return () => clearTimeout(t)
    }
  }, [pathname])

  // Manejar resize/orientación: ajustar si badge queda fuera de pantalla
  useEffect(() => {
    if (typeof window === "undefined") return
    
    const handleResize = () => {
      const maxX = window.innerWidth - 100
      const maxY = window.innerHeight - 80
      setTimeBadgePos({
        x: Math.max(8, Math.min(timeBadgePos.x, maxX)),
        y: Math.max(8, Math.min(timeBadgePos.y, maxY))
      })
    }

    const handleOrientationChange = () => setTimeout(handleResize, 100)

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleOrientationChange)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [setTimeBadgePos])

  // Handler para iniciar drag del badge de hora
  const handleTimeBadgeTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) return
    const target = e.target as HTMLElement
    if (!target.closest('.badge-handle')) return
    
    if (e.cancelable) {
      e.preventDefault()
    }
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    timeBadgeDragStart.current = { x: clientX - timeBadgePos.x, y: clientY - timeBadgePos.y }
    setIsDraggingTimeBadge(true)
  }, [timeBadgePos])

  // Handler para mover el badge (con snap a bordes)
  const handleTimeBadgeTouchMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!isDraggingTimeBadge) return
    if (e.cancelable) {
      e.preventDefault()
    }
    const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX
    const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY
    let newX = clientX - timeBadgeDragStart.current.x
    let newY = clientY - timeBadgeDragStart.current.y
    
    const padding = 8
    const maxX = (typeof window !== "undefined" ? window.innerWidth : 400) - 100
    const maxY = (typeof window !== "undefined" ? window.innerHeight : 700) - 80
    newX = Math.max(padding, Math.min(newX, maxX))
    newY = Math.max(padding, Math.min(newY, maxY))
    
    const snapThreshold = 15
    if (newX < snapThreshold) newX = padding
    if (newX > maxX - snapThreshold) newX = maxX - padding
    if (newY < snapThreshold) newY = padding
    
    setTimeBadgePos({ x: newX, y: newY })
  }, [isDraggingTimeBadge, setTimeBadgePos])

  // Handler para terminar drag
  const handleTimeBadgeTouchEnd = useCallback(() => {
    setIsDraggingTimeBadge(false)
  }, [])

  // Doble tap para resetear posición
  const lastTapRef = useRef(0)
  const handleBadgeDoubleTap = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      // Doble tap detectado - resetear posición
      setTimeBadgePos({ x: 0, y: 0 })
    }
    lastTapRef.current = now
  }, [setTimeBadgePos])

  // Agregar event listeners globales para drag
  useEffect(() => {
    if (!isDraggingTimeBadge) return
    window.addEventListener('touchmove', handleTimeBadgeTouchMove, { passive: false })
    window.addEventListener('touchend', handleTimeBadgeTouchEnd)
    window.addEventListener('mousemove', handleTimeBadgeTouchMove)
    window.addEventListener('mouseup', handleTimeBadgeTouchEnd)
    return () => {
      window.removeEventListener('touchmove', handleTimeBadgeTouchMove)
      window.removeEventListener('touchend', handleTimeBadgeTouchEnd)
      window.removeEventListener('mousemove', handleTimeBadgeTouchMove)
      window.removeEventListener('mouseup', handleTimeBadgeTouchEnd)
    }
  }, [isDraggingTimeBadge, handleTimeBadgeTouchMove, handleTimeBadgeTouchEnd])

  return (
    <div>
      {showShell && <SidebarNav />}
      <div
        className={showShell ? "md:ml-[72px] pb-16 md:pb-0" : ""}
        style={{
          opacity: pageVisible ? 1 : 0,
          transition: "opacity 280ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {children}
      </div>
      {showShell && <BottomNav />}
      {/* Reloj flotante en móvil — solo visible en pantallas pequeñas */}
      {showShell && (
        <div
          ref={badgeRef}
          className={`fixed top-2 right-3 z-50 md:hidden rounded-xl bg-card/90 backdrop-blur-md border border-border/60 shadow-lg cursor-move touch-none select-none overflow-hidden transition-all duration-200 ${
            isDraggingTimeBadge ? 'shadow-2xl scale-105 border-primary/50' : 'hover:shadow-md'
          } ${isHoveringBadge ? 'ring-2 ring-primary/20' : ''}`}
          style={{
            transform: `translate(${timeBadgePos.x}px, ${timeBadgePos.y}px)`,
            transition: isDraggingTimeBadge ? 'none' : 'transform 0.2s ease-out, box-shadow 0.2s ease',
            minWidth: '90px',
          }}
          onTouchStart={handleTimeBadgeTouchStart}
          onMouseDown={handleTimeBadgeTouchStart}
          onClick={handleBadgeDoubleTap}
          onMouseEnter={() => setIsHoveringBadge(true)}
          onMouseLeave={() => setIsHoveringBadge(false)}
        >
          {/* Handle visual con icono de grip */}
          <div className="badge-handle absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center bg-gradient-to-r from-muted/30 to-transparent cursor-grab active:cursor-grabbing">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60" />
          </div>
          {/* Contenido del reloj con padding para el handle */}
          <div className="pl-5 pr-2 py-1.5">
            <LiveClock />
          </div>
          {/* Indicador sutil de drag cuando está en hover */}
          {!isDraggingTimeBadge && isHoveringBadge && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground/50 whitespace-nowrap">
              Arrastra para mover
            </div>
          )}
        </div>
      )}
    </div>
  )
}
