"use client"

import { useEffect } from "react"

/**
 * Actualiza dinámicamente el favicon y el apple-touch-icon
 * usando /api/logo que sirve la imagen del logo del negocio.
 */
export function DynamicFavicon() {
  useEffect(() => {
    const logoUrl = "/api/logo?s=192"

    // Actualizar favicon (link rel="icon")
    updateLink("icon", logoUrl)
    // Actualizar apple-touch-icon
    updateLink("apple-touch-icon", logoUrl)
  }, [])

  return <></>
}

function updateLink(rel: string, href: string) {
  const existing = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (existing) {
    existing.href = href
    if (rel === "icon") existing.type = "image/png"
    return
  }

  const link = document.createElement("link")
  link.rel = rel
  link.href = href
  if (rel === "icon") link.type = "image/png"
  document.head.appendChild(link)
}
