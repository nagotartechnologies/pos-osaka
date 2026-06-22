"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Sun, Moon, ArrowRight, AlertCircle, Delete, ShoppingBag, BarChart3, Zap } from "lucide-react"
import { loadLogo, loadLogoForTheme, loadBusinessName, checkPinAsync, setSession, isAuthenticated } from "@/lib/config-store"
import { getAllConfig } from "@/lib/supabase-config"
import { useTheme } from "next-themes"

export default function LoginPage() {
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [logo, setLogo] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [visible, setVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
    setIsMobile(window.innerWidth < 1024)
    if (isAuthenticated()) router.replace("/")
    // Pequeño delay para que el fade-in sea perceptible
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [router])

  useEffect(() => {
    if (!mounted) return
    // Cargar desde localStorage primero (rápido)
    setLogo(loadLogo("dark"))
    setBusinessName(loadBusinessName() || "Osaka POS")
    // Luego actualizar desde Supabase
    getAllConfig().then((cfg) => {
      if (cfg.nombreNegocio) setBusinessName(cfg.nombreNegocio)
      if (cfg.logoPublicUrl) setLogo(cfg.logoPublicUrl)
    })
  }, [mounted, resolvedTheme])

  const tryLogin = async (code: string) => {
    setLoading(true)
    setError("")
    const role = await checkPinAsync(code)
    if (role) {
      setSuccess(true)
      // Fade-out antes de navegar
      setTimeout(() => setVisible(false), 400)
      setTimeout(() => { setSession(role); router.replace("/") }, 750)
    } else {
      setError("PIN incorrecto")
      setShake(true)
      setTimeout(() => { setShake(false); setPin("") }, 500)
    }
    setLoading(false)
  }

  const handlePad = (d: string) => {
    if (loading || success) return
    if (d === "⌫") { setPin((p) => p.slice(0, -1)); setError(""); return }
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setError("")
    if (next.length === 4) setTimeout(() => tryLogin(next), 100)
    if (!isMobile) inputRef.current?.focus()
  }

  const handleKeyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4)
    setPin(val)
    setError("")
    if (val.length === 4) setTimeout(() => tryLogin(val), 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace") { setPin((p) => p.slice(0, -1)); setError("") }
    if (e.key === "Enter" && pin.length === 4) tryLogin(pin)
  }

  const isDark = resolvedTheme === "dark"
  if (!mounted) return <></>

  const features = [
    { icon: ShoppingBag, label: "Punto de Venta", desc: "Gestión de pedidos en tiempo real" },
    { icon: BarChart3, label: "Dashboard", desc: "Métricas y ventas del día" },
    { icon: Zap, label: "Carta Digital", desc: "Menú público con pedidos WhatsApp" },
  ]

  return (
    <div className={`min-h-screen flex transition-all duration-700 ease-out ${isDark ? "bg-zinc-950" : "bg-slate-50"} ${visible ? "opacity-100" : "opacity-0"}`}>

      {/* ── Panel izquierdo BRANDING ── */}
      <div className={`hidden lg:flex lg:w-[55%] relative flex-col justify-between overflow-hidden p-12 transition-transform duration-700 ease-out ${visible ? "translate-x-0" : "-translate-x-6"}`}>
        {/* Imagen de fondo */}
        <Image
          src="https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=1200&q=80"
          alt="Sushi restaurant"
          fill
          className="object-cover"
          priority
        />
        {/* Overlay oscuro con gradiente */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-orange-900/70" />
        {/* Overlay de color de marca */}
        <div className="absolute inset-0 bg-gradient-to-t from-orange-600/30 via-transparent to-transparent" />

        {/* Logo + nombre */}
        <div className="relative z-10 flex items-center gap-5">
          <div className={`flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-3xl overflow-hidden shadow-2xl shadow-black/50 ${logo ? "bg-white/10 ring-2 ring-white/25 backdrop-blur-sm" : "bg-white/20"}`}>
            {logo ? (
              <Image src={logo} alt="Logo" width={112} height={112} className="object-contain p-2" />
            ) : (
              <span className="text-5xl font-black text-white">{businessName.charAt(0)}</span>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight leading-tight">{businessName}</h2>
            <p className="text-sm text-white/60 font-medium mt-0.5">Sistema de Punto de Venta</p>
          </div>
        </div>

        {/* Headline central */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-1.5 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-white/80">Sistema activo</span>
          </div>
          <h1 className="text-5xl font-black text-white leading-tight mb-4">
            Gestiona tu<br />
            <span className="text-yellow-300">negocio</span><br />
            con facilidad.
          </h1>
        </div>

        {/* Features */}
        <div className="relative z-10 space-y-3">
          {features.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-center gap-4 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm px-4 py-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Icon className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{label}</p>
                <p className="text-[11px] text-white/50">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Copyright */}
        <p className="relative z-10 text-[11px] text-white/30">
          {businessName} &copy; {new Date().getFullYear()} — Todos los derechos reservados
        </p>
      </div>

      {/* ── Panel derecho FORMULARIO ── */}
      <div className={`flex flex-1 flex-col items-center justify-center px-6 py-10 relative transition-transform duration-700 ease-out ${isDark ? "bg-[#111110]" : "bg-[#f5f2ed]"} ${visible ? "translate-x-0" : "translate-x-6"}`}>

        {/* Textura sutil tipo washi */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

        {/* Toggle tema */}
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={`absolute top-6 right-6 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 ${
            isDark ? "bg-white/[0.06] text-[#d4c5a9]/60 hover:text-[#d4c5a9] hover:bg-white/[0.1]" : "bg-black/[0.04] text-[#8a7d6b]/60 hover:text-[#8a7d6b] hover:bg-black/[0.07]"
          }`}
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        {/* Logo móvil (solo visible en < lg) */}
        <div className="flex lg:hidden flex-col items-center mb-10">
          <div className={`flex h-20 w-20 items-center justify-center rounded-2xl overflow-hidden mb-4 ${
            logo
              ? isDark ? "bg-white/[0.04] ring-1 ring-[#c9a96e]/20" : "bg-white ring-1 ring-[#c9a96e]/20 shadow-lg shadow-black/5"
              : isDark ? "bg-[#c9a96e]/10" : "bg-[#c9a96e]/10"
          }`}>
            {logo
              ? <Image src={logo} alt="Logo" width={80} height={80} className="object-contain p-2" />
              : <span className={`text-3xl font-light tracking-wider ${isDark ? "text-[#c9a96e]" : "text-[#8a7d6b]"}`}>{businessName.charAt(0)}</span>
            }
          </div>
          <h2 className={`text-lg font-semibold tracking-[0.15em] uppercase ${isDark ? "text-[#e8e4dd]" : "text-[#2a2520]"}`}>{businessName}</h2>
          <div className={`w-8 h-px mt-3 ${isDark ? "bg-[#c9a96e]/30" : "bg-[#c9a96e]/40"}`} />
        </div>

        {/* Card formulario */}
        <div className={`w-full max-w-[360px] rounded-2xl p-10 transition-all duration-500 relative ${success ? "scale-[0.98] opacity-80" : "scale-100 opacity-100"} ${
          isDark
            ? "bg-[#1a1917] border border-white/[0.06]"
            : "bg-white border border-[#d4c5a9]/20 shadow-xl shadow-black/[0.04]"
        }`} style={{ transitionTimingFunction: "cubic-bezier(0.4,0,0.2,1)" }}>

          {/* Encabezado */}
          <div className="text-center mb-8">
            {/* Logo desktop dentro del card */}
            <div className="hidden lg:flex justify-center mb-5">
              <div className={`flex h-16 w-16 items-center justify-center rounded-xl overflow-hidden ${
                logo
                  ? isDark ? "bg-white/[0.04] ring-1 ring-[#c9a96e]/15" : "bg-[#f5f2ed] ring-1 ring-[#c9a96e]/15"
                  : isDark ? "bg-[#c9a96e]/8" : "bg-[#c9a96e]/8"
              }`}>
                {logo
                  ? <Image src={logo} alt="Logo" width={64} height={64} className="object-contain p-1.5" />
                  : <span className={`text-2xl font-light tracking-wider ${isDark ? "text-[#c9a96e]" : "text-[#8a7d6b]"}`}>{businessName.charAt(0)}</span>
                }
              </div>
            </div>
            <p className={`text-[11px] font-medium tracking-[0.25em] uppercase mb-2 ${isDark ? "text-[#c9a96e]/50" : "text-[#c9a96e]/70"}`}>
              Acceso al sistema
            </p>
            <h3 className={`text-xl font-semibold tracking-tight ${isDark ? "text-[#e8e4dd]" : "text-[#2a2520]"}`}>
              Ingresa tu PIN
            </h3>
            {/* Separador decorativo tipo noren */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className={`h-px w-8 ${isDark ? "bg-[#c9a96e]/20" : "bg-[#c9a96e]/30"}`} />
              <div className={`h-1 w-1 rounded-full ${isDark ? "bg-[#c9a96e]/30" : "bg-[#c9a96e]/40"}`} />
              <div className={`h-px w-8 ${isDark ? "bg-[#c9a96e]/20" : "bg-[#c9a96e]/30"}`} />
            </div>
          </div>

          {/* Indicadores zen — piedras */}
          <div className={`flex items-center justify-center gap-4 mb-8 transition-all ${shake ? "[animation:shake_0.4s_ease]" : ""}`}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="relative flex items-center justify-center">
                <div className={`rounded-full transition-all duration-300 ease-out ${
                  success
                    ? "h-4 w-4 bg-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                    : i < pin.length
                      ? "h-4 w-4 bg-[#c9a96e] shadow-[0_0_12px_rgba(201,169,110,0.25)]"
                      : isDark
                        ? "h-3 w-3 bg-white/[0.06] border border-white/[0.08]"
                        : "h-3 w-3 bg-[#d4c5a9]/20 border border-[#d4c5a9]/30"
                }`} />
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 mb-5 text-xs font-medium ${
              isDark ? "bg-red-500/[0.06] text-red-400/80" : "bg-red-50 text-red-500/80"
            }`}>
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Input oculto para teclado físico (solo desktop, en móvil se usa el numpad visual) */}
          {!isMobile && (
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={handleKeyInput}
              onKeyDown={handleKeyDown}
              autoFocus
              className="sr-only"
              aria-label="Ingresa tu PIN"
            />
          )}

          {/* Teclado numérico — botones circulares */}
          <div className="grid grid-cols-3 gap-3 mb-6 justify-items-center">
            {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, i) => (
              <button
                key={i}
                onClick={() => handlePad(d)}
                disabled={d === "" || loading || success}
                className={`flex items-center justify-center select-none transition-all duration-150 ${
                  d === ""
                    ? "w-14 h-14 opacity-0 pointer-events-none"
                    : d === "⌫"
                      ? `w-14 h-14 rounded-full ${
                          isDark
                            ? "text-[#d4c5a9]/30 hover:text-[#d4c5a9]/60 hover:bg-white/[0.04] active:scale-90"
                            : "text-[#8a7d6b]/30 hover:text-[#8a7d6b]/60 hover:bg-black/[0.03] active:scale-90"
                        }`
                      : `w-14 h-14 rounded-full text-base font-medium ${
                          isDark
                            ? "bg-white/[0.04] text-[#e8e4dd] border border-white/[0.06] hover:bg-white/[0.08] hover:border-[#c9a96e]/20 active:scale-90 active:bg-[#c9a96e]/10"
                            : "bg-white text-[#2a2520] border border-[#d4c5a9]/15 shadow-sm shadow-black/[0.02] hover:border-[#c9a96e]/30 hover:shadow-md hover:shadow-[#c9a96e]/5 active:scale-90 active:bg-[#c9a96e]/5"
                        }`
                }`}
              >
                {d === "⌫" ? <Delete className="h-4 w-4" /> : d}
              </button>
            ))}
          </div>

          {/* Botón ingresar */}
          <button
            onClick={() => pin.length === 4 && tryLogin(pin)}
            disabled={pin.length < 4 || loading || success}
            className={`w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-medium tracking-wide transition-all duration-200 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 ${
              isDark
                ? "bg-[#c9a96e] text-[#1a1917] hover:bg-[#d4b87a] shadow-lg shadow-[#c9a96e]/10 hover:shadow-[#c9a96e]/20"
                : "bg-[#2a2520] text-[#f5f2ed] hover:bg-[#3a3530] shadow-lg shadow-black/10 hover:shadow-black/15"
            }`}
          >
            {loading ? (
              <div className={`h-4 w-4 rounded-full border-2 animate-spin ${isDark ? "border-[#1a1917]/30 border-t-[#1a1917]" : "border-white/30 border-t-white"}`} />
            ) : success ? (
              <span className="tracking-[0.15em] uppercase text-xs">Accediendo...</span>
            ) : (
              <>
                <span className="tracking-[0.1em] uppercase text-xs">Ingresar</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>

          <p className={`text-center text-[10px] mt-5 tracking-wide ${isDark ? "text-white/15" : "text-[#2a2520]/20"}`}>
            Ingresa tu PIN de 4 dígitos
          </p>
        </div>

        {/* Copyright móvil */}
        <p className={`lg:hidden text-[10px] mt-8 tracking-wide ${isDark ? "text-white/15" : "text-[#2a2520]/20"}`}>
          {businessName} &copy; {new Date().getFullYear()}
        </p>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(6px); }
          45% { transform: translateX(-4px); }
          60% { transform: translateX(3px); }
          75% { transform: translateX(-1px); }
        }
      `}</style>
    </div>
  )
}
