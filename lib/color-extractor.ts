/**
 * Extrae colores dominantes de una imagen y genera una paleta OKLCH
 * compatible con el sistema de CSS variables del tema.
 */

const STORAGE_KEY = "pos-osaka-primary-color"
const STORAGE_HEX_KEY = "pos-osaka-primary-hex"

export interface ExtractedColors {
  hex: string           // Color dominante (hex)
  r: number
  g: number
  b: number
}

// ── Extracción de color dominante ────────────────────────────────

export async function extractColorsFromImage(imageSrc: string): Promise<ExtractedColors> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) { reject(new Error("No se pudo crear contexto Canvas")); return }

        const size = 64
        canvas.width = size
        canvas.height = size
        ctx.drawImage(img, 0, 0, size, size)

        const imageData = ctx.getImageData(0, 0, size, size).data
        const colorCounts: Record<string, { r: number; g: number; b: number; count: number; sat: number }> = {}

        for (let i = 0; i < imageData.length; i += 4) {
          const r = Math.round(imageData[i] / 8) * 8
          const g = Math.round(imageData[i + 1] / 8) * 8
          const b = Math.round(imageData[i + 2] / 8) * 8
          const a = imageData[i + 3]

          // Ignorar transparentes
          if (a < 128) continue
          // Ignorar casi blancos y casi negros (no son "el color" del logo)
          if (r > 220 && g > 220 && b > 220) continue
          if (r < 30 && g < 30 && b < 30) continue
          // Ignorar grises (sin saturación)
          const maxC = Math.max(r, g, b)
          const minC = Math.min(r, g, b)
          const sat = maxC > 0 ? (maxC - minC) / maxC : 0

          const key = `${r},${g},${b}`
          if (!colorCounts[key]) colorCounts[key] = { r, g, b, count: 0, sat }
          colorCounts[key].count++
        }

        const all = Object.values(colorCounts)

        if (all.length === 0) {
          resolve({ hex: "#3b82f6", r: 59, g: 130, b: 246 })
          return
        }

        // Filtrar colores con saturación significativa (> 0.2)
        const saturated = all.filter((c) => c.sat > 0.2)

        // Si hay colores saturados, elegir el más frecuente entre ellos
        // Si no, usar el más frecuente general
        const candidates = saturated.length > 0 ? saturated : all
        candidates.sort((a, b) => b.count - a.count)

        const d = candidates[0]
        resolve({ hex: rgbToHex(d.r, d.g, d.b), r: d.r, g: d.g, b: d.b })
      } catch (err) { reject(err) }
    }

    img.onerror = () => reject(new Error("No se pudo cargar la imagen"))
    img.src = imageSrc
  })
}

// ── Conversiones de color ────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => Math.min(255, Math.max(0, x)).toString(16).padStart(2, "0")).join("")
}

/** Convierte sRGB lineal a OKLCH (aproximación suficiente para temas) */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function rgbToOklch(r: number, g: number, b: number): { L: number; C: number; H: number } {
  const lr = srgbToLinear(r / 255)
  const lg = srgbToLinear(g / 255)
  const lb = srgbToLinear(b / 255)

  // sRGB → linear LMS (via OKLab matrix)
  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  const l_c = Math.cbrt(l_)
  const m_c = Math.cbrt(m_)
  const s_c = Math.cbrt(s_)

  const L = 0.2104542553 * l_c + 0.7936177850 * m_c - 0.0040720468 * s_c
  const a = 1.9779984951 * l_c - 2.4285922050 * m_c + 0.4505937099 * s_c
  const b2 = 0.0259040371 * l_c + 0.7827717662 * m_c - 0.8086757660 * s_c

  const C = Math.sqrt(a * a + b2 * b2)
  let H = Math.atan2(b2, a) * (180 / Math.PI)
  if (H < 0) H += 360

  return { L, C, H }
}

function oklchStr(L: number, C: number, H: number): string {
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(3)})`
}

// ── Generación de paleta ─────────────────────────────────────────

interface ThemePalette {
  // Modo claro
  light: Record<string, string>
  // Modo oscuro
  dark: Record<string, string>
}

function generatePalette(r: number, g: number, b: number): ThemePalette {
  const { L, C, H } = rgbToOklch(r, g, b)

  // Chroma mínimo para que el color siempre sea visible (no gris)
  const cMin = 0.08
  const cSafe = Math.max(cMin, Math.min(C, 0.25))

  // Primary en modo claro: luminancia baja-media para contraste con fondo blanco
  const lightPrimL = Math.max(0.40, Math.min(0.50, L * 0.75))
  // Primary en modo oscuro: luminancia media-alta para contraste con fondo negro
  const darkPrimL = Math.max(0.60, Math.min(0.78, L + 0.20))

  // Foreground: siempre blanco sobre primary coloreado (L < 0.55)
  const fgLight = lightPrimL < 0.55 ? "oklch(0.985 0 0)" : "oklch(0.205 0 0)"
  const fgDark = darkPrimL > 0.55 ? "oklch(0.205 0 0)" : "oklch(0.985 0 0)"

  return {
    light: {
      "--primary": oklchStr(lightPrimL, cSafe, H),
      "--primary-foreground": fgLight,
      "--accent": oklchStr(0.94, cSafe * 0.25, H),
      "--accent-foreground": oklchStr(0.30, cSafe * 0.6, H),
      "--ring": oklchStr(0.55, cSafe * 0.6, H),
      "--sidebar-primary": oklchStr(lightPrimL, cSafe, H),
      "--sidebar-primary-foreground": fgLight,
      "--sidebar-accent": oklchStr(0.94, cSafe * 0.20, H),
      "--sidebar-accent-foreground": oklchStr(0.30, cSafe * 0.6, H),
      "--sidebar-ring": oklchStr(0.55, cSafe * 0.6, H),
      "--chart-1": oklchStr(0.50, cSafe * 0.9, H),
      "--chart-2": oklchStr(0.60, cSafe * 0.7, (H + 40) % 360),
    },
    dark: {
      "--primary": oklchStr(darkPrimL, cSafe, H),
      "--primary-foreground": fgDark,
      "--accent": oklchStr(0.27, cSafe * 0.20, H),
      "--accent-foreground": oklchStr(0.90, cSafe * 0.25, H),
      "--ring": oklchStr(0.50, cSafe * 0.5, H),
      "--sidebar-primary": oklchStr(darkPrimL, cSafe, H),
      "--sidebar-primary-foreground": fgDark,
      "--sidebar-accent": oklchStr(0.27, cSafe * 0.15, H),
      "--sidebar-accent-foreground": oklchStr(0.90, cSafe * 0.25, H),
      "--sidebar-ring": oklchStr(0.50, cSafe * 0.5, H),
      "--chart-1": oklchStr(0.55, cSafe * 0.9, H),
      "--chart-2": oklchStr(0.65, cSafe * 0.7, (H + 40) % 360),
    },
  }
}

// ── Variables que se modifican (para poder resetear) ─────────────

const THEMED_VARS = [
  "--primary", "--primary-foreground",
  "--accent", "--accent-foreground",
  "--ring",
  "--sidebar-primary", "--sidebar-primary-foreground",
  "--sidebar-accent", "--sidebar-accent-foreground",
  "--sidebar-ring",
  "--chart-1", "--chart-2",
]

// ── API pública ──────────────────────────────────────────────────

/**
 * Aplica la paleta completa derivada de un color RGB.
 * Detecta el modo actual (light/dark) y aplica las variables correspondientes.
 */
export function applyPrimaryColor(r: number, g: number, b: number): void {
  const palette = generatePalette(r, g, b)
  const root = document.documentElement
  const isDark = root.classList.contains("dark")
  const vars = isDark ? palette.dark : palette.light

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }

  // Guardar la paleta completa para que al cambiar de tema se re-aplique
  root.dataset.paletteLight = JSON.stringify(palette.light)
  root.dataset.paletteDark = JSON.stringify(palette.dark)
}

/**
 * Re-aplica la paleta al cambiar de tema (light ↔ dark).
 * Llamar desde un observer o desde el toggle de tema.
 */
export function reapplyPaletteForTheme(isDark: boolean): void {
  const root = document.documentElement
  const raw = isDark ? root.dataset.paletteDark : root.dataset.paletteLight
  if (!raw) return
  try {
    const vars = JSON.parse(raw) as Record<string, string>
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value)
    }
  } catch {}
}

/**
 * Resetea los colores al tema por defecto.
 */
export function resetPrimaryColor(): void {
  const root = document.documentElement
  for (const v of THEMED_VARS) {
    root.style.removeProperty(v)
  }
  delete root.dataset.paletteLight
  delete root.dataset.paletteDark
}

// ── Persistencia en localStorage ─────────────────────────────────

export function saveColorToStorage(hex: string, r: number, g: number, b: number): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ r, g, b }))
  localStorage.setItem(STORAGE_HEX_KEY, hex)
}

export function loadColorFromStorage(): { r: number; g: number; b: number; hex: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const hex = localStorage.getItem(STORAGE_HEX_KEY)
    if (!raw || !hex) return null
    const { r, g, b } = JSON.parse(raw)
    return { r, g, b, hex }
  } catch { return null }
}

export function clearColorStorage(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(STORAGE_HEX_KEY)
}
