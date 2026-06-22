"use client"

import { useEffect, useState, useCallback } from "react"
import { usePathname } from "next/navigation"
import { Download, X, Share } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PWARegister() {
  const pathname = usePathname()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Registrar service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }

    // Pedir permisos de notificación (esperar 5s para no ser intrusivo)
    let permTimer: ReturnType<typeof setTimeout> | null = null
    if ("Notification" in window && Notification.permission === "default") {
      permTimer = setTimeout(() => { Notification.requestPermission() }, 5000)
    }

    // Detectar si ya está instalada como PWA
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    setIsStandalone(standalone)

    // Detectar iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
    setIsIOS(ios)

    // Capturar evento beforeinstallprompt (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)

    // Mostrar banner después de 3s si no está instalada y no fue descartado antes
    let bannerTimer: ReturnType<typeof setTimeout> | null = null
    const dismissed = localStorage.getItem("pwa-banner-dismissed")
    if (!standalone && !dismissed) {
      bannerTimer = setTimeout(() => setShowBanner(true), 3000)
    }

    return () => {
      if (permTimer) clearTimeout(permTimer)
      if (bannerTimer) clearTimeout(bannerTimer)
      window.removeEventListener("beforeinstallprompt", handler)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setShowBanner(false)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setShowBanner(false)
    localStorage.setItem("pwa-banner-dismissed", Date.now().toString())
  }, [])

  // No mostrar en carta ni si ya está instalada o el banner está oculto
  if (pathname?.startsWith("/carta") || isStandalone || !showBanner) return <></>

  return (
    <div className="fixed bottom-4 left-3 right-3 z-[9999] animate-in slide-in-from-bottom-4 duration-500 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="rounded-2xl bg-card border border-border shadow-2xl shadow-black/20 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-card-foreground">Instalar Osaka POS</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {isIOS
                ? <>Toca <Share className="inline h-3 w-3 -mt-0.5" /> y luego <strong>&quot;Agregar a inicio&quot;</strong> para recibir notificaciones como app nativa.</>
                : "Instala la app para acceso rápido y notificaciones sin el icono de Chrome."
              }
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!isIOS && deferredPrompt && (
          <button
            onClick={handleInstall}
            className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Instalar App
          </button>
        )}

        {isIOS && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-accent/50 px-3 py-2">
            <Share className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Safari → <strong>Compartir</strong> → <strong>Agregar a pantalla de inicio</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
