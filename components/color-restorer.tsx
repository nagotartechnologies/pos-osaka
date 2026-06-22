"use client"

import { useEffect, useRef } from "react"
import { applyPrimaryColor, reapplyPaletteForTheme, loadColorFromStorage, saveColorToStorage } from "@/lib/color-extractor"

export function ColorRestorer() {
  const appliedRef = useRef(false)

  // 1. Aplicar color inmediatamente al montar (desde localStorage — rápido)
  useEffect(() => {
    const saved = loadColorFromStorage()
    if (saved) {
      applyPrimaryColor(saved.r, saved.g, saved.b)
      appliedRef.current = true
    } else {
      // Fallback: intentar desde Supabase
      import("@/lib/supabase-config").then(({ getAllConfig }) =>
        getAllConfig().then((cfg) => {
          if (cfg.themeColor) {
            try {
              const tc = JSON.parse(cfg.themeColor)
              if (tc.r !== undefined && tc.g !== undefined && tc.b !== undefined) {
                saveColorToStorage(tc.hex, tc.r, tc.g, tc.b)
                applyPrimaryColor(tc.r, tc.g, tc.b)
                appliedRef.current = true
              }
            } catch {}
          }
        })
      ).catch(() => {})
    }
  }, [])

  // 2. Re-aplicar paleta cuando el tema cambia (light ↔ dark)
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "class") {
          // Re-aplicar color desde localStorage si hay
          const saved = loadColorFromStorage()
          if (saved) {
            applyPrimaryColor(saved.r, saved.g, saved.b)
          } else {
            const isDark = document.documentElement.classList.contains("dark")
            reapplyPaletteForTheme(isDark)
          }
        }
      }
    })

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return <></>
}
