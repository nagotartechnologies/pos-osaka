"use client"

import { useState, useEffect, useRef } from "react"
import { useTheme } from "next-themes"
import Image from "next/image"
import { saveSupabaseConfig, loadSupabaseConfig, saveLogo, removeLogo, saveBusinessName, checkPin, savePin, savePinToSupabase, loadPin, saveWhatsApp, loadWhatsApp, saveBankData, loadBankData, saveAddress, loadAddress, type BankData, type UserRole } from "@/lib/config-store"
import { getAllConfig, getLogoConfig, setMultipleConfig, getConfigValue, setConfigValue } from "@/lib/supabase-config"
import { testConnection } from "@/lib/supabase"
import { extractColorsFromImage, applyPrimaryColor, resetPrimaryColor, saveColorToStorage, clearColorStorage, loadColorFromStorage } from "@/lib/color-extractor"
import { uploadBase64Image, isCloudinaryConfigured } from "@/lib/cloudinary"
import { parseSchedule, DAY_KEYS, DAY_LABELS, DEFAULT_SCHEDULE, type WeekSchedule, type DayKey } from "@/lib/schedule"
import { getQuickReplies, addQuickReply, updateQuickReply, deleteQuickReply, type QuickReply } from "@/lib/supabase-quick-replies"
import { ConfirmModal } from "@/components/confirm-modal"
import {
  Store,
  Receipt,
  Palette,
  Printer,
  Save,
  Sun,
  Moon,
  Monitor,
  Percent,
  DollarSign,
  Clock,
  MapPin,
  Phone,
  Mail,
  Globe,
  CheckCircle2,
  Upload,
  Database,
  Key,
  Link2,
  Eye,
  EyeOff,
  Shield,
  AlertTriangle,
  Copy,
  Check,
  MessageCircle,
  Banknote,
  CreditCard,
  Building2,
  User,
  Hash,
  Truck,
} from "lucide-react"

interface ConfigData {
  nombreNegocio: string
  direccion: string
  telefono: string
  email: string
  sitioWeb: string
  logo: string
  logoLight: string
  moneda: string
  simboloMoneda: string
  impuesto: number
  nombreImpuesto: string
  propina: boolean
  porcentajePropina: number
  imprimirTicket: boolean
  mostrarLogo: boolean
  pieTicket: string
  horaApertura: string
  horaCierre: string
}

interface SupabaseConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceKey: string
  instanceName: string
}

export default function ConfiguracionPage() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const logoLightInputRef = useRef<HTMLInputElement>(null)
  const [regenConfirm, setRegenConfirm] = useState(false)

  useEffect(() => setMounted(true), [])

  const [config, setConfig] = useState<ConfigData>({
    nombreNegocio: "Osaka Sushi Restaurant",
    direccion: "Av. Principal 1234, Santiago, Chile",
    telefono: "+56 9 1234 5678",
    email: "contacto@osaka-sushi.cl",
    sitioWeb: "www.osaka-sushi.cl",
    logo: "",
    logoLight: "",
    moneda: "CLP",
    simboloMoneda: "$",
    impuesto: 10,
    nombreImpuesto: "IVA",
    propina: true,
    porcentajePropina: 10,
    imprimirTicket: true,
    mostrarLogo: true,
    pieTicket: "¡Gracias por su preferencia! Vuelva pronto.",
    horaApertura: "11:00",
    horaCierre: "23:00",
  })

  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>({
    supabaseUrl: "",
    supabaseAnonKey: "",
    supabaseServiceKey: "",
    instanceName: "",
  })

  const [activeSection, setActiveSection] = useState("negocio")
  const [saved, setSaved] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<{ testing: boolean; result: { success: boolean; message: string } | null }>({
    testing: false,
    result: null,
  })
  const [extractedColor, setExtractedColor] = useState<string | null>(null)
  const [extractingColors, setExtractingColors] = useState(false)
  const [pinActual, setPinActual] = useState("")
  const [pinNuevo, setPinNuevo] = useState("")
  const [pinConfirm, setPinConfirm] = useState("")
  const [pinError, setPinError] = useState("")
  const [pinSuccess, setPinSuccess] = useState(false)
  const [whatsapp, setWhatsapp] = useState("")
  const [whatsappAdmin, setWhatsappAdmin] = useState("")
  const [autoReplyMsg, setAutoReplyMsg] = useState("")
  const [closedMsg, setClosedMsg] = useState("")
  const [postVentaMsg, setPostVentaMsg] = useState("")
  const [postVentaEnabled, setPostVentaEnabled] = useState(false)
  const [statusMsgs, setStatusMsgs] = useState({
    preparando: "",
    enCaminoDelivery: "",
    enCaminoRetiro: "",
    entregado: "",
    cancelado: "",
  })
  const [bankData, setBankData] = useState<BankData>({ banco: "", tipoCuenta: "", numeroCuenta: "", rut: "", titular: "" })
  const [cartaCode, setCartaCode] = useState("")
  const [deliveryFee, setDeliveryFee] = useState("")
  const [deliveryZoneEnabled, setDeliveryZoneEnabled] = useState(false)
  const [deliveryZoneMsg, setDeliveryZoneMsg] = useState("")
  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_SCHEDULE)
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [qrTitle, setQrTitle] = useState("")
  const [qrMessage, setQrMessage] = useState("")
  const [qrEditing, setQrEditing] = useState<string | null>(null)
  const [waTestStatus, setWaTestStatus] = useState<"idle" | "testing" | "ok" | "error" | "not_configured">("idle")
  const [cardPaymentsEnabled, setCardPaymentsEnabled] = useState(false)

  // Cargar config desde Supabase + localStorage
  useEffect(() => {
    async function loadAllConfig() {
      // Cargar localStorage (Supabase credentials, PINs, etc.)
      const savedSupa = loadSupabaseConfig()
      if (savedSupa.supabaseUrl || savedSupa.supabaseAnonKey) {
        setSupabaseConfig(savedSupa)
      }

      // Cargar config del negocio desde Supabase
      const dbConfig = await getAllConfig()
      // Los logos base64 ya no vienen en getAllConfig (egress); se traen aparte.
      const logos = await getLogoConfig()
      if (Object.keys(dbConfig).length > 0) {
        setConfig(prev => ({
          ...prev,
          nombreNegocio: dbConfig.nombreNegocio || prev.nombreNegocio,
          direccion: dbConfig.direccion || prev.direccion,
          telefono: dbConfig.telefono || prev.telefono,
          email: dbConfig.email || prev.email,
          sitioWeb: dbConfig.sitioWeb || prev.sitioWeb,
          logo: logos.logo || prev.logo,
          logoLight: logos.logoLight || prev.logoLight,
          moneda: dbConfig.moneda || prev.moneda,
          simboloMoneda: dbConfig.simboloMoneda || prev.simboloMoneda,
          impuesto: dbConfig.impuesto ? Number(dbConfig.impuesto) : prev.impuesto,
          nombreImpuesto: dbConfig.nombreImpuesto || prev.nombreImpuesto,
          propina: dbConfig.propina ? dbConfig.propina === "true" : prev.propina,
          porcentajePropina: dbConfig.porcentajePropina ? Number(dbConfig.porcentajePropina) : prev.porcentajePropina,
          imprimirTicket: dbConfig.imprimirTicket ? dbConfig.imprimirTicket === "true" : prev.imprimirTicket,
          mostrarLogo: dbConfig.mostrarLogo ? dbConfig.mostrarLogo === "true" : prev.mostrarLogo,
          pieTicket: dbConfig.pieTicket || prev.pieTicket,
          horaApertura: dbConfig.horaApertura || prev.horaApertura,
          horaCierre: dbConfig.horaCierre || prev.horaCierre,
        }))
        if (dbConfig.whatsapp) setWhatsapp(dbConfig.whatsapp)
        if (dbConfig.whatsappAdmin) setWhatsappAdmin(dbConfig.whatsappAdmin)
        if (dbConfig.autoReplyMsg) setAutoReplyMsg(dbConfig.autoReplyMsg)
        if (dbConfig.closedMsg) setClosedMsg(dbConfig.closedMsg)
        if (dbConfig.postVentaMsg) setPostVentaMsg(dbConfig.postVentaMsg)
        setPostVentaEnabled(dbConfig.postVentaEnabled === "true")
        if (dbConfig.statusMsgs) {
          try { setStatusMsgs((prev) => ({ ...prev, ...JSON.parse(dbConfig.statusMsgs) })) } catch {}
        }
        if (dbConfig.deliveryFee) setDeliveryFee(dbConfig.deliveryFee)
        setDeliveryZoneEnabled(dbConfig.deliveryZoneEnabled === "true")
        setCardPaymentsEnabled(dbConfig.cardPaymentsEnabled === "true")
        if (dbConfig.deliveryZoneMsg) setDeliveryZoneMsg(dbConfig.deliveryZoneMsg)
        if (dbConfig.schedule) {
          setSchedule(parseSchedule(dbConfig.schedule, dbConfig.horaApertura, dbConfig.horaCierre))
        } else if (dbConfig.horaApertura || dbConfig.horaCierre) {
          setSchedule(parseSchedule(null, dbConfig.horaApertura, dbConfig.horaCierre))
        }
        if (dbConfig.bankData) {
          try { setBankData(JSON.parse(dbConfig.bankData)) } catch {}
        }
        // Sincronizar color del tema desde Supabase → localStorage
        if (dbConfig.themeColor) {
          try {
            const tc = JSON.parse(dbConfig.themeColor)
            saveColorToStorage(tc.hex, tc.r, tc.g, tc.b)
            applyPrimaryColor(tc.r, tc.g, tc.b)
            setExtractedColor(tc.hex)
          } catch {}
        }
        // Si hay logo pero no logoPublicUrl, subir a Cloudinary para el manifest PWA
        if (logos.logo && logos.logo.startsWith("data:") && !dbConfig.logoPublicUrl && isCloudinaryConfigured()) {
          try {
            const publicUrl = await uploadBase64Image(logos.logo, "logos")
            await setConfigValue("logoPublicUrl", publicUrl)
          } catch {}
        }
      } else {
        // Fallback a localStorage si Supabase está vacío
        setWhatsapp(loadWhatsApp())
        setBankData(loadBankData())
        const addr = loadAddress()
        if (addr) setConfig(prev => ({ ...prev, direccion: addr }))
      }

      // Cargar respuestas rápidas
      getQuickReplies().then(setQuickReplies)

      // Cargar código de carta
      const savedCartaCode = await getConfigValue("cartaCode")
      if (savedCartaCode) {
        setCartaCode(savedCartaCode)
      } else {
        // Generar código aleatorio
        const newCode = Math.random().toString(36).substring(2, 10)
        await setConfigValue("cartaCode", newCode)
        setCartaCode(newCode)
      }

      setPageLoading(false)
    }
    loadAllConfig()
  }, [])

  // Restaurar color primario guardado al montar
  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = loadColorFromStorage()
    if (saved) {
      applyPrimaryColor(saved.r, saved.g, saved.b)
      setExtractedColor(saved.hex)
    }
  }, [])

  const handleSave = async () => {
    // Persistir en localStorage (PINs, Supabase credentials, logos para tema local)
    saveSupabaseConfig(supabaseConfig)
    saveBusinessName(config.nombreNegocio)
    saveAddress(config.direccion)
    saveWhatsApp(whatsapp)
    saveBankData(bankData)
    if (config.logo) saveLogo(config.logo)

    // Persistir config del negocio en Supabase
    await setMultipleConfig({
      nombreNegocio: config.nombreNegocio,
      direccion: config.direccion,
      telefono: config.telefono,
      email: config.email,
      sitioWeb: config.sitioWeb,
      logo: config.logo,
      logoLight: config.logoLight,
      moneda: config.moneda,
      simboloMoneda: config.simboloMoneda,
      impuesto: config.impuesto.toString(),
      nombreImpuesto: config.nombreImpuesto,
      propina: config.propina.toString(),
      porcentajePropina: config.porcentajePropina.toString(),
      imprimirTicket: config.imprimirTicket.toString(),
      mostrarLogo: config.mostrarLogo.toString(),
      pieTicket: config.pieTicket,
      horaApertura: config.horaApertura,
      horaCierre: config.horaCierre,
      whatsapp: whatsapp,
      whatsappAdmin: whatsappAdmin,
      autoReplyMsg: autoReplyMsg,
      closedMsg: closedMsg,
      postVentaMsg: postVentaMsg,
      postVentaEnabled: String(postVentaEnabled),
      statusMsgs: JSON.stringify(statusMsgs),
      deliveryFee: deliveryFee,
      deliveryZoneEnabled: String(deliveryZoneEnabled),
      deliveryZoneMsg: deliveryZoneMsg,
      cardPaymentsEnabled: String(cardPaymentsEnabled),
      schedule: JSON.stringify(schedule),
      bankData: JSON.stringify(bankData),
      themeColor: (() => {
        const saved = loadColorFromStorage()
        return saved ? JSON.stringify({ hex: saved.hex, r: saved.r, g: saved.g, b: saved.b }) : ""
      })(),
    })

    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleTestConnection = async () => {
    setConnectionStatus({ testing: true, result: null })
    const result = await testConnection(supabaseConfig.supabaseUrl, supabaseConfig.supabaseAnonKey)
    setConnectionStatus({ testing: false, result })
    setTimeout(() => setConnectionStatus((prev) => ({ ...prev, result: null })), 5000)
  }

  const updateConfig = (key: keyof ConfigData, value: string | number | boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const updateSupabase = (key: keyof SupabaseConfig, value: string) => {
    setSupabaseConfig((prev) => ({ ...prev, [key]: value }))
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const dataUrl = reader.result as string
        updateConfig("logo", dataUrl)
        saveLogo(dataUrl)

        // Subir a Cloudinary para tener URL pública (usada por el manifest PWA)
        if (isCloudinaryConfigured()) {
          try {
            const publicUrl = await uploadBase64Image(dataUrl, "logos")
            await setConfigValue("logoPublicUrl", publicUrl)
          } catch {}
        }

        // Extraer colores del logo y aplicar como tema
        setExtractingColors(true)
        try {
          const colors = await extractColorsFromImage(dataUrl)
          applyPrimaryColor(colors.r, colors.g, colors.b)
          setExtractedColor(colors.hex)
          saveColorToStorage(colors.hex, colors.r, colors.g, colors.b)
        } catch {
          // Si falla la extracción, no hacer nada
        }
        setExtractingColors(false)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleLogoLightUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        updateConfig("logoLight", dataUrl)
        saveLogo(dataUrl, "light")
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveLogo = (variant: "dark" | "light" = "dark") => {
    if (variant === "dark") {
      updateConfig("logo", "")
      resetPrimaryColor()
      setExtractedColor(null)
      removeLogo("dark")
      clearColorStorage()
    } else {
      updateConfig("logoLight", "")
      removeLogo("light")
    }
  }

  const toggleShowKey = (field: string) => {
    setShowKeys((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  const copyToClipboard = (value: string, field: string) => {
    navigator.clipboard.writeText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const sections = [
    { id: "negocio", label: "Negocio", icon: Store },
    { id: "supabase", label: "Base de Datos", icon: Database },
    { id: "impuestos", label: "Impuestos y Moneda", icon: Receipt },
    { id: "apariencia", label: "Apariencia", icon: Palette },
    { id: "tickets", label: "Tickets", icon: Printer },
    { id: "whatsapp", label: "WhatsApp y Pagos", icon: MessageCircle },
    { id: "horarios", label: "Horarios", icon: Clock },
    { id: "seguridad", label: "Seguridad", icon: Shield },
    { id: "carta", label: "Carta Digital", icon: Link2 },
  ]

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-foreground">Configuración</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Ajustes generales del sistema</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-primary px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          <span className="hidden sm:inline">{saved ? "Guardado" : "Guardar Cambios"}</span>
          <span className="sm:hidden">{saved ? "OK" : "Guardar"}</span>
        </button>
      </div>

      {/* Notificación de guardado */}
      {saved && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Configuración guardada correctamente
        </div>
      )}

      {/* Tabs de secciones — horizontal scroll en móvil, sidebar en desktop */}
      <div className="mb-4 sm:mb-0 lg:hidden">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-2 -mx-1 px-1">
          {sections.map((section) => {
            const Icon = section.icon
            const isActive = activeSection === section.id
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card border border-border text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {section.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar de secciones — solo desktop */}
        <div className="hidden lg:block w-[220px] flex-shrink-0">
          <div className="rounded-2xl bg-card border border-border p-2 shadow-sm sticky top-6">
            {sections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {section.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          {activeSection === "negocio" && (
            <div className="space-y-6">
              <SectionCard title="Información del Negocio" description="Datos generales de tu restaurante">
                {/* Logo Upload */}
                <div className="mb-6">
                  <label className="text-xs font-medium text-muted-foreground mb-3 block">Logos del Negocio</label>
                  <p className="text-xs text-muted-foreground mb-4">
                    Sube tu logo en formato PNG, JPG o SVG. Se usará en tickets, reportes y la interfaz. Puedes subir versiones distintas para modo claro y oscuro.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Logo Modo Oscuro (principal) */}
                    <div className="rounded-xl border border-border p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-card-foreground">Modo Oscuro</span>
                        <span className="text-[9px] text-muted-foreground">(principal)</span>
                      </div>
                      <div
                        onClick={() => logoInputRef.current?.click()}
                        className="relative flex h-24 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border bg-zinc-900 overflow-hidden hover:border-primary/50 transition-colors"
                      >
                        {config.logo ? (
                          <>
                            <Image src={config.logo} alt="Logo oscuro" fill className="object-contain p-3" sizes="200px" />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <Upload className="h-5 w-5 text-white" />
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <Upload className="h-5 w-5 text-zinc-500" />
                            <span className="text-[10px] text-zinc-500">Subir logo</span>
                          </div>
                        )}
                      </div>
                      <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      <div className="flex gap-2">
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-accent transition-colors"
                        >
                          {config.logo ? "Cambiar" : "Subir"}
                        </button>
                        {config.logo && (
                          <button
                            onClick={() => handleRemoveLogo("dark")}
                            className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Logo Modo Claro */}
                    <div className="rounded-xl border border-border p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-card-foreground">Modo Claro</span>
                        {!config.logoLight && <span className="text-[9px] text-muted-foreground">(usa el principal)</span>}
                      </div>
                      <div
                        onClick={() => logoLightInputRef.current?.click()}
                        className="relative flex h-24 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border bg-white overflow-hidden hover:border-primary/50 transition-colors"
                      >
                        {config.logoLight ? (
                          <>
                            <Image src={config.logoLight} alt="Logo claro" fill className="object-contain p-3" sizes="200px" />
                            <div className="absolute inset-0 bg-white/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <Upload className="h-5 w-5 text-zinc-700" />
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <Upload className="h-5 w-5 text-zinc-400" />
                            <span className="text-[10px] text-zinc-400">Subir logo</span>
                          </div>
                        )}
                      </div>
                      <input ref={logoLightInputRef} type="file" accept="image/*" onChange={handleLogoLightUpload} className="hidden" />
                      <div className="flex gap-2">
                        <button
                          onClick={() => logoLightInputRef.current?.click()}
                          className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-card-foreground hover:bg-accent transition-colors"
                        >
                          {config.logoLight ? "Cambiar" : "Subir"}
                        </button>
                        {config.logoLight && (
                          <button
                            onClick={() => handleRemoveLogo("light")}
                            className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Indicador de color extraído */}
                  {extractingColors && (
                    <p className="text-[10px] text-muted-foreground animate-pulse mt-3">Extrayendo colores del logo...</p>
                  )}
                  {extractedColor && !extractingColors && (
                    <div className="flex items-center gap-2 mt-3">
                      <div
                        className="h-5 w-5 rounded-md border border-border shadow-sm"
                        style={{ backgroundColor: extractedColor }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        Color primario aplicado: <span className="font-mono font-semibold">{extractedColor}</span>
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Nombre del Negocio"
                    icon={<Store className="h-4 w-4" />}
                    value={config.nombreNegocio}
                    onChange={(v) => updateConfig("nombreNegocio", v)}
                  />
                  <InputField
                    label="Dirección"
                    icon={<MapPin className="h-4 w-4" />}
                    value={config.direccion}
                    onChange={(v) => updateConfig("direccion", v)}
                  />
                  <InputField
                    label="Teléfono"
                    icon={<Phone className="h-4 w-4" />}
                    value={config.telefono}
                    onChange={(v) => updateConfig("telefono", v)}
                  />
                  <InputField
                    label="Email"
                    icon={<Mail className="h-4 w-4" />}
                    value={config.email}
                    onChange={(v) => updateConfig("email", v)}
                  />
                  <InputField
                    label="Sitio Web"
                    icon={<Globe className="h-4 w-4" />}
                    value={config.sitioWeb}
                    onChange={(v) => updateConfig("sitioWeb", v)}
                    className="md:col-span-2"
                  />
                </div>
              </SectionCard>
            </div>
          )}

          {activeSection === "supabase" && (
            <div className="space-y-6">
              <SectionCard title="Conexión a Base de Datos" description="Configura las credenciales de Supabase para conectar este sistema con tu base de datos">
                {/* Alerta informativa */}
                <div className="mb-5 flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Importante</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-0.5">
                      Estas credenciales conectan el sistema con tu proyecto de Supabase. Cada instancia del POS puede apuntar a un proyecto diferente para operar de forma independiente.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Nombre de instancia */}
                  <InputField
                    label="Nombre de la Instancia"
                    icon={<Store className="h-4 w-4" />}
                    value={supabaseConfig.instanceName}
                    onChange={(v) => updateSupabase("instanceName", v)}
                    placeholder="Ej: Osaka Sucursal Centro"
                  />

                  {/* Supabase URL */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Supabase URL
                    </label>
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={supabaseConfig.supabaseUrl}
                          onChange={(e) => updateSupabase("supabaseUrl", e.target.value)}
                          placeholder="https://xxxxx.supabase.co"
                          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 pr-10 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        {supabaseConfig.supabaseUrl && (
                          <button
                            onClick={() => copyToClipboard(supabaseConfig.supabaseUrl, "url")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {copiedField === "url" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Anon Key */}
                  <SecretField
                    label="Anon Key (Pública)"
                    icon={<Key className="h-4 w-4" />}
                    value={supabaseConfig.supabaseAnonKey}
                    onChange={(v) => updateSupabase("supabaseAnonKey", v)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    show={showKeys["anon"] || false}
                    onToggleShow={() => toggleShowKey("anon")}
                    onCopy={() => copyToClipboard(supabaseConfig.supabaseAnonKey, "anon")}
                    copied={copiedField === "anon"}
                    hint="Clave pública para operaciones del lado del cliente"
                  />

                  {/* Service Role Key */}
                  <SecretField
                    label="Service Role Key (Privada)"
                    icon={<Shield className="h-4 w-4" />}
                    value={supabaseConfig.supabaseServiceKey}
                    onChange={(v) => updateSupabase("supabaseServiceKey", v)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    show={showKeys["service"] || false}
                    onToggleShow={() => toggleShowKey("service")}
                    onCopy={() => copyToClipboard(supabaseConfig.supabaseServiceKey, "service")}
                    copied={copiedField === "service"}
                    hint="Clave privada con acceso total. No exponer en el cliente."
                    danger
                  />
                </div>
              </SectionCard>

              {/* Estado de conexión */}
              <SectionCard title="Estado de la Conexión" description="Verifica que las credenciales sean correctas">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
                    connectionStatus.result?.success
                      ? "bg-emerald-500/10"
                      : supabaseConfig.supabaseUrl && supabaseConfig.supabaseAnonKey
                      ? "bg-amber-500/10"
                      : "bg-muted"
                  }`}>
                    <Database className={`h-6 w-6 ${
                      connectionStatus.result?.success
                        ? "text-emerald-600 dark:text-emerald-400"
                        : supabaseConfig.supabaseUrl && supabaseConfig.supabaseAnonKey
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground"
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-card-foreground">
                      {connectionStatus.testing
                        ? "Probando conexión..."
                        : connectionStatus.result
                        ? connectionStatus.result.success
                          ? "Conexión exitosa"
                          : "Error de conexión"
                        : supabaseConfig.supabaseUrl && supabaseConfig.supabaseAnonKey
                        ? "Credenciales configuradas"
                        : "Sin configurar"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {connectionStatus.result
                        ? connectionStatus.result.message
                        : supabaseConfig.supabaseUrl && supabaseConfig.supabaseAnonKey
                        ? `Proyecto: ${supabaseConfig.supabaseUrl.replace("https://", "").split(".")[0]}`
                        : "Ingresa las credenciales de tu proyecto Supabase para conectar"}
                    </p>
                  </div>
                  <button
                    onClick={handleTestConnection}
                    disabled={!supabaseConfig.supabaseUrl || !supabaseConfig.supabaseAnonKey || connectionStatus.testing}
                    className="w-full sm:w-auto flex-shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {connectionStatus.testing ? "Probando..." : "Probar Conexión"}
                  </button>
                </div>
                {connectionStatus.result && !connectionStatus.result.success && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 dark:text-red-400">{connectionStatus.result.message}</p>
                  </div>
                )}
              </SectionCard>

              {/* Info de ventas múltiples */}
              <div className="rounded-2xl bg-primary/5 border border-primary/10 p-5">
                <div className="flex items-start gap-3">
                  <Database className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">Ventas Múltiples del Sistema</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Cada instalación de este POS puede conectarse a un proyecto de Supabase diferente.
                      Esto permite vender el mismo sistema a múltiples clientes, donde cada uno tiene su propia
                      base de datos independiente con sus productos, pedidos y configuración.
                    </p>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { label: "Datos aislados", desc: "Cada cliente tiene su propia BD" },
                        { label: "Misma aplicación", desc: "Un solo deploy para todos" },
                        { label: "Fácil de escalar", desc: "Solo cambia las credenciales" },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg bg-card border border-border p-3">
                          <p className="text-xs font-semibold text-card-foreground">{item.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === "impuestos" && (
            <SectionCard title="Impuestos y Moneda" description="Configuración de impuestos y formato de moneda">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Moneda</label>
                  <select
                    value={config.moneda}
                    onChange={(e) => updateConfig("moneda", e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="CLP">CLP - Peso Chileno</option>
                    <option value="USD">USD - Dólar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="MXN">MXN - Peso Mexicano</option>
                    <option value="ARS">ARS - Peso Argentino</option>
                  </select>
                </div>
                <InputField
                  label="Símbolo de Moneda"
                  icon={<DollarSign className="h-4 w-4" />}
                  value={config.simboloMoneda}
                  onChange={(v) => updateConfig("simboloMoneda", v)}
                />
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Impuesto (%)</label>
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={config.impuesto}
                      onChange={(e) => updateConfig("impuesto", Number(e.target.value))}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
                <InputField
                  label="Nombre del Impuesto"
                  icon={<Receipt className="h-4 w-4" />}
                  value={config.nombreImpuesto}
                  onChange={(v) => updateConfig("nombreImpuesto", v)}
                />
                <div className="md:col-span-2">
                  <ToggleField
                    label="Habilitar Propina Sugerida"
                    description="Mostrar opción de propina al finalizar pedido"
                    checked={config.propina}
                    onChange={(v) => updateConfig("propina", v)}
                  />
                </div>
                {config.propina && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Porcentaje de Propina (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={config.porcentajePropina}
                      onChange={(e) => updateConfig("porcentajePropina", Number(e.target.value))}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {activeSection === "apariencia" && (
            <SectionCard title="Apariencia" description="Personaliza el aspecto visual del sistema">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-3 block">Tema</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "light", label: "Claro", icon: Sun },
                    { id: "dark", label: "Oscuro", icon: Moon },
                    { id: "system", label: "Sistema", icon: Monitor },
                  ].map((t) => {
                    const Icon = t.icon
                    const isSelected = mounted && theme === t.id
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <Icon className={`h-6 w-6 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                          {t.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </SectionCard>
          )}

          {activeSection === "tickets" && (
            <SectionCard title="Configuración de Tickets" description="Ajustes de impresión y formato de tickets">
              <div className="space-y-4">
                <ToggleField
                  label="Imprimir Ticket Automáticamente"
                  description="Imprimir ticket al confirmar cada pedido"
                  checked={config.imprimirTicket}
                  onChange={(v) => updateConfig("imprimirTicket", v)}
                />
                <ToggleField
                  label="Mostrar Logo en Ticket"
                  description="Incluir el logo del negocio en la parte superior"
                  checked={config.mostrarLogo}
                  onChange={(v) => updateConfig("mostrarLogo", v)}
                />
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Mensaje al Pie del Ticket
                  </label>
                  <textarea
                    value={config.pieTicket}
                    onChange={(e) => updateConfig("pieTicket", e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  />
                </div>
              </div>
            </SectionCard>
          )}

          {activeSection === "whatsapp" && (
            <div className="space-y-6">
              <SectionCard title="WhatsApp de la Tienda" description="Número al que los clientes enviarán sus pedidos desde la carta digital">
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Número de WhatsApp del Local</label>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      <input
                        type="tel"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="Ej: +56912345678 (con código de país)"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Incluye el código de país sin espacios. Los pedidos de la carta digital se enviarán a este número.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">WhatsApp del Administrador</label>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <input
                        type="tel"
                        value={whatsappAdmin}
                        onChange={(e) => setWhatsappAdmin(e.target.value)}
                        placeholder="Ej: +56987654321 (número personal)"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Recibirás notificaciones por WhatsApp: pedidos cancelados, enviados, entregados y el resumen diario al cierre.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={async () => {
                        setWaTestStatus("testing")
                        try {
                          const res = await fetch("/api/whatsapp/status")
                          const data = await res.json()
                          setWaTestStatus(data.status === "authorized" ? "ok" : data.status === "not_configured" ? "not_configured" : "error")
                        } catch {
                          setWaTestStatus("error")
                        }
                        setTimeout(() => setWaTestStatus("idle"), 4000)
                      }}
                      disabled={waTestStatus === "testing"}
                      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors ${
                        waTestStatus === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600" :
                        waTestStatus === "error" ? "bg-red-500/10 border-red-500/30 text-red-500" :
                        waTestStatus === "not_configured" ? "bg-amber-500/10 border-amber-500/30 text-amber-600" :
                        "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                      } disabled:opacity-50`}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {waTestStatus === "testing" ? "Verificando..." :
                       waTestStatus === "ok" ? "✓ Conectado" :
                       waTestStatus === "not_configured" ? "No configurado" :
                       waTestStatus === "error" ? "✗ Sin conexión" :
                       "Probar Conexión GreenAPI"}
                    </button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Respuesta Automática" description="Mensaje que se envía cuando un número nuevo escribe al WhatsApp del local">
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mensaje de bienvenida</label>
                    <textarea
                      value={autoReplyMsg}
                      onChange={(e) => setAutoReplyMsg(e.target.value)}
                      placeholder={"¡Hola! 👋 Bienvenido a {negocio}.\n\nPuedes ver nuestra carta y hacer tu pedido aquí:\n👉 {link}\n\n¡Te esperamos! 🍣"}
                      rows={5}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Usa <span className="font-mono font-bold">{"{negocio}"}</span> para el nombre del local y <span className="font-mono font-bold">{"{link}"}</span> para el link de la carta. Deja vacío para usar el mensaje por defecto.
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Mensaje de Cerrado" description="Mensaje automático cuando el local está cerrado y un cliente escribe por WhatsApp">
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mensaje fuera de horario</label>
                    <textarea
                      value={closedMsg}
                      onChange={(e) => setClosedMsg(e.target.value)}
                      placeholder={"🌙 Hola! En este momento {negocio} está cerrado. Volvemos el {proximoDia} a las {proximaHora} hs.\n\n¡Te esperamos pronto! 🙏"}
                      rows={4}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Usa <span className="font-mono font-bold">{"{negocio}"}</span> para el nombre, <span className="font-mono font-bold">{"{proximoDia}"}</span> y <span className="font-mono font-bold">{"{proximaHora}"}</span> para el próximo horario. Deja vacío para el mensaje por defecto.
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Mensaje Post-Venta" description="Mensaje de seguimiento que se envía automáticamente al día siguiente a los clientes que recibieron su pedido">
                <div className="space-y-4 max-w-md">
                  {/* Toggle activar/desactivar */}
                  <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Envío automático</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{postVentaEnabled ? "Se enviará al día siguiente del pedido entregado" : "Desactivado — no se enviará automáticamente"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPostVentaEnabled((v) => !v)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${postVentaEnabled ? "bg-emerald-500" : "bg-muted"}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${postVentaEnabled ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                  {/* Mensaje personalizable */}
                  <div className={postVentaEnabled ? "" : "opacity-50 pointer-events-none"}>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mensaje de seguimiento</label>
                    <textarea
                      value={postVentaMsg}
                      onChange={(e) => setPostVentaMsg(e.target.value)}
                      placeholder={"¡Hola {nombre}! 😊\n\n¿Qué tal estuvo tu pedido de *{negocio}*? Tu opinión nos ayuda a mejorar.\n\n¡Gracias por preferirnos! 🙏"}
                      rows={5}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Usa <span className="font-mono font-bold">{"{nombre}"}</span>, <span className="font-mono font-bold">{"{pedido}"}</span> y <span className="font-mono font-bold">{"{negocio}"}</span>. Deja vacío para el mensaje por defecto.
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Mensajes de Estado" description="Mensajes automáticos que se envían al cliente cuando cambia el estado de su pedido. Usa {nombre}, {pedido} y {negocio}.">
                <div className="space-y-4 max-w-md">
                  {([
                    { key: "preparando" as const, label: "👨‍🍳 Preparando", placeholder: "👨‍🍳 {nombre}, tu pedido *#{pedido}* en *{negocio}* está siendo preparado. ¡Ya falta poco!" },
                    { key: "enCaminoDelivery" as const, label: "🚚 En camino (Delivery)", placeholder: "🚚 {nombre}, tu pedido *#{pedido}* está en camino. ¡Prepárate para recibirlo!" },
                    { key: "enCaminoRetiro" as const, label: "✅ Listo para retiro", placeholder: "✅ {nombre}, tu pedido *#{pedido}* en *{negocio}* está *listo para retirar*. ¡Te esperamos!" },
                    { key: "entregado" as const, label: "✅ Entregado", placeholder: "✅ {nombre}, tu pedido *#{pedido}* ha sido entregado. ¡Gracias por tu compra en *{negocio}*! 🙏" },
                    { key: "cancelado" as const, label: "❌ Cancelado", placeholder: "❌ {nombre}, lamentamos informarte que tu pedido *#{pedido}* ha sido cancelado. Si tienes dudas, contáctanos." },
                  ]).map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
                      <textarea
                        value={statusMsgs[key]}
                        onChange={(e) => setStatusMsgs((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                        rows={3}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                      />
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground">
                    Usa <span className="font-mono font-bold">{"{nombre}"}</span>, <span className="font-mono font-bold">{"{pedido}"}</span> y <span className="font-mono font-bold">{"{negocio}"}</span>. Deja vacío para usar el mensaje por defecto.
                  </p>
                </div>
              </SectionCard>

              <SectionCard title="Respuestas Rápidas" description="Mensajes predefinidos para responder rápido en el chat. Usa {nombre}, {pedido} y {negocio} como placeholders.">
                <div className="space-y-4">
                  {/* Formulario agregar/editar */}
                  <div className="flex flex-col gap-2 max-w-md">
                    <input
                      type="text"
                      value={qrTitle}
                      onChange={(e) => setQrTitle(e.target.value)}
                      placeholder="Título corto (ej: Cerrados)"
                      className="rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <textarea
                      value={qrMessage}
                      onChange={(e) => setQrMessage(e.target.value)}
                      placeholder="Mensaje completo (ej: Hola {nombre}, en este momento estamos cerrados...)"
                      rows={3}
                      className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (!qrTitle.trim() || !qrMessage.trim()) return
                          if (qrEditing) {
                            await updateQuickReply(qrEditing, qrTitle.trim(), qrMessage.trim())
                            setQrEditing(null)
                          } else {
                            await addQuickReply(qrTitle.trim(), qrMessage.trim())
                          }
                          setQrTitle("")
                          setQrMessage("")
                          getQuickReplies().then(setQuickReplies)
                        }}
                        disabled={!qrTitle.trim() || !qrMessage.trim()}
                        className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {qrEditing ? "Actualizar" : "Agregar"}
                      </button>
                      {qrEditing && (
                        <button
                          onClick={() => { setQrEditing(null); setQrTitle(""); setQrMessage("") }}
                          className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Lista */}
                  {quickReplies.length > 0 && (
                    <div className="space-y-2 max-w-md">
                      {quickReplies.map((qr) => (
                        <div key={qr.id} className="flex items-start gap-2 rounded-xl border border-border bg-card p-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground">{qr.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-pre-wrap">{qr.message}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => { setQrEditing(qr.id); setQrTitle(qr.title); setQrMessage(qr.message) }}
                              className="rounded-lg px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={async () => {
                                await deleteQuickReply(qr.id)
                                getQuickReplies().then(setQuickReplies)
                              }}
                              className="rounded-lg px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Pago con Tarjeta" description="Habilita o deshabilita la opción de pago con tarjeta (débito/crédito) en el POS y la carta digital">
                <div className="space-y-4 max-w-md">
                  <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">Pago con Tarjeta</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{cardPaymentsEnabled ? "Habilitado — los clientes pueden pagar con tarjeta" : "Deshabilitado — la opción de tarjeta está oculta"}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCardPaymentsEnabled((v) => !v)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${cardPaymentsEnabled ? "bg-emerald-500" : "bg-muted"}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${cardPaymentsEnabled ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Costo de Delivery" description="Se suma al total cuando el cliente elige delivery en la carta digital">
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Valor del Delivery ({config.simboloMoneda})</label>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        min="0"
                        value={deliveryFee}
                        onChange={(e) => setDeliveryFee(e.target.value)}
                        placeholder="Ej: 2000"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Deja en 0 o vacío si el delivery es gratis. Este valor se suma automáticamente al total del pedido.
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Aviso de Zona de Delivery" description="Mensaje informativo que se muestra al cliente cuando selecciona delivery en la carta">
                <div className="space-y-4 max-w-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">Mostrar aviso de zona</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">El cliente verá este mensaje al elegir delivery</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeliveryZoneEnabled((v) => !v)}
                      className={`relative flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        deliveryZoneEnabled ? "bg-primary" : "bg-muted-foreground/20"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                        deliveryZoneEnabled ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>
                  {deliveryZoneEnabled && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mensaje de zona</label>
                      <textarea
                        value={deliveryZoneMsg}
                        onChange={(e) => setDeliveryZoneMsg(e.target.value)}
                        placeholder="Ej: Solo realizamos delivery dentro de la ciudad de Victoria. De lo contrario, el pedido será cancelado."
                        rows={3}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                      />
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Datos Bancarios" description="Se muestran al cliente cuando elige pagar por transferencia">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Banco"
                    icon={<Building2 className="h-4 w-4" />}
                    value={bankData.banco}
                    onChange={(v) => setBankData(prev => ({ ...prev, banco: v }))}
                    placeholder="Ej: Banco Estado"
                  />
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo de Cuenta</label>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <select
                        value={bankData.tipoCuenta}
                        onChange={(e) => setBankData(prev => ({ ...prev, tipoCuenta: e.target.value }))}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Cuenta Corriente">Cuenta Corriente</option>
                        <option value="Cuenta Vista">Cuenta Vista</option>
                        <option value="Cuenta de Ahorro">Cuenta de Ahorro</option>
                        <option value="Cuenta RUT">Cuenta RUT</option>
                      </select>
                    </div>
                  </div>
                  <InputField
                    label="Número de Cuenta"
                    icon={<Hash className="h-4 w-4" />}
                    value={bankData.numeroCuenta}
                    onChange={(v) => setBankData(prev => ({ ...prev, numeroCuenta: v }))}
                    placeholder="Ej: 12345678"
                  />
                  <InputField
                    label="RUT"
                    icon={<Key className="h-4 w-4" />}
                    value={bankData.rut}
                    onChange={(v) => setBankData(prev => ({ ...prev, rut: v }))}
                    placeholder="Ej: 12.345.678-9"
                  />
                  <InputField
                    label="Nombre del Titular"
                    icon={<User className="h-4 w-4" />}
                    value={bankData.titular}
                    onChange={(v) => setBankData(prev => ({ ...prev, titular: v }))}
                    placeholder="Nombre completo"
                    className="md:col-span-2"
                  />
                </div>
              </SectionCard>
            </div>
          )}

          {activeSection === "seguridad" && (
            <SectionCard title="Seguridad — PINs de Acceso" description="Configura los PINs para administrador y vendedor">
              <div className="space-y-6">
                {(loadPin("admin") === "1234" || loadPin("vendedor") === "0000") && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-600 dark:text-red-400">PINs por defecto detectados</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {loadPin("admin") === "1234" && loadPin("vendedor") === "0000"
                          ? "Ambos PINs (Admin y Vendedor) tienen valores por defecto. Cámbialos para proteger el acceso al sistema."
                          : loadPin("admin") === "1234"
                            ? "El PIN de Admin sigue siendo \"1234\". Cámbialo para proteger el acceso completo al sistema."
                            : "El PIN de Vendedor sigue siendo \"0000\". Cámbialo para mayor seguridad."}
                      </p>
                    </div>
                  </div>
                )}
                {/* PIN Administrador */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex items-center justify-center rounded-lg bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-500">Admin</span>
                    <span className="text-xs text-muted-foreground">Acceso completo al sistema</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:max-w-sm">
                    <Key className="h-4 w-4 text-muted-foreground flex-shrink-0 hidden sm:block" />
                    <input
                      type="password"
                      maxLength={6}
                      value={pinNuevo}
                      onChange={(e) => { setPinNuevo(e.target.value.replace(/\D/g, "")); setPinError(""); setPinSuccess(false) }}
                      placeholder={`PIN actual: ${loadPin("admin").replace(/./g, "•")}`}
                      className="w-full rounded-xl border border-border bg-background px-3 sm:px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/40"
                    />
                    <button
                      onClick={() => {
                        if (pinNuevo.length < 4) { setPinError("El PIN debe tener al menos 4 dígitos"); return }
                        savePinToSupabase(pinNuevo, "admin")
                        setPinNuevo("")
                        setPinSuccess(true)
                        setPinError("")
                        setTimeout(() => setPinSuccess(false), 3000)
                      }}
                      disabled={pinNuevo.length < 4}
                      className="flex-shrink-0 rounded-xl bg-amber-500 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Guardar
                    </button>
                  </div>
                </div>

                {/* PIN Vendedor */}
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex items-center justify-center rounded-lg bg-blue-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-500">Vendedor</span>
                    <span className="text-xs text-muted-foreground">Solo Pedidos y Punto de Venta</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:max-w-sm">
                    <Key className="h-4 w-4 text-muted-foreground flex-shrink-0 hidden sm:block" />
                    <input
                      type="password"
                      maxLength={6}
                      value={pinConfirm}
                      onChange={(e) => { setPinConfirm(e.target.value.replace(/\D/g, "")); setPinError(""); setPinSuccess(false) }}
                      placeholder={`PIN actual: ${loadPin("vendedor").replace(/./g, "•")}`}
                      className="w-full rounded-xl border border-border bg-background px-3 sm:px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40"
                    />
                    <button
                      onClick={() => {
                        if (pinConfirm.length < 4) { setPinError("El PIN debe tener al menos 4 dígitos"); return }
                        savePinToSupabase(pinConfirm, "vendedor")
                        setPinConfirm("")
                        setPinSuccess(true)
                        setPinError("")
                        setTimeout(() => setPinSuccess(false), 3000)
                      }}
                      disabled={pinConfirm.length < 4}
                      className="flex-shrink-0 rounded-xl bg-blue-500 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Guardar
                    </button>
                  </div>
                </div>

                {pinError && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs font-medium text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    {pinError}
                  </div>
                )}
                {pinSuccess && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                    PIN actualizado correctamente
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">
                  PINs por defecto — Admin: <span className="font-bold font-mono">1234</span> · Vendedor: <span className="font-bold font-mono">0000</span>
                </p>
              </div>
            </SectionCard>
          )}

          {activeSection === "horarios" && (
            <SectionCard title="Horarios de Atención" description="Define los horarios de operación para cada día de la semana">
              <div className="space-y-2">
                {DAY_KEYS.map((day) => {
                  const dayData = schedule[day]
                  return (
                    <div
                      key={day}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                        dayData.open ? "border-border bg-card" : "border-border/50 bg-muted/30"
                      }`}
                    >
                      {/* Toggle */}
                      <button
                        type="button"
                        onClick={() => setSchedule((prev) => ({
                          ...prev,
                          [day]: { ...prev[day], open: !prev[day].open },
                        }))}
                        className={`relative flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                          dayData.open ? "bg-primary" : "bg-muted-foreground/20"
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                          dayData.open ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </button>

                      {/* Día */}
                      <span className={`w-20 text-sm font-semibold flex-shrink-0 ${
                        dayData.open ? "text-card-foreground" : "text-muted-foreground"
                      }`}>
                        {DAY_LABELS[day]}
                      </span>

                      {dayData.open ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="time"
                            value={dayData.from}
                            onChange={(e) => setSchedule((prev) => ({
                              ...prev,
                              [day]: { ...prev[day], from: e.target.value },
                            }))}
                            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary w-24"
                          />
                          <span className="text-xs text-muted-foreground">a</span>
                          <input
                            type="time"
                            value={dayData.to}
                            onChange={(e) => setSchedule((prev) => ({
                              ...prev,
                              [day]: { ...prev[day], to: e.target.value },
                            }))}
                            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary w-24"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Cerrado</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Aplicar a todos */}
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const first = DAY_KEYS.find((d) => schedule[d].open)
                    if (!first) return
                    const { from, to } = schedule[first]
                    setSchedule((prev) => {
                      const next = { ...prev }
                      DAY_KEYS.forEach((d) => { next[d] = { ...next[d], from, to } })
                      return next
                    })
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Aplicar mismo horario a todos
                </button>
              </div>

              {/* Vista previa resumen */}
              <div className="mt-4 rounded-xl bg-accent/50 border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Resumen</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DAY_KEYS.map((day) => (
                    <div key={day} className={`rounded-lg px-2.5 py-1.5 text-center ${
                      schedule[day].open ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"
                    }`}>
                      <p className={`text-[10px] font-bold ${schedule[day].open ? "text-emerald-600" : "text-red-500"}`}>
                        {DAY_LABELS[day].slice(0, 3)}
                      </p>
                      <p className={`text-[9px] ${schedule[day].open ? "text-emerald-600/70" : "text-red-500/70"}`}>
                        {schedule[day].open ? `${schedule[day].from}-${schedule[day].to}` : "Cerrado"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}

          {activeSection === "carta" && (
            <SectionCard title="Carta Digital — Link Protegido" description="Comparte este link privado con tus clientes via WhatsApp Business">
              <div className="space-y-4">
                {/* Link actual */}
                <div className="rounded-xl border border-border bg-accent/50 p-4 space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tu link de carta</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 rounded-xl border border-border bg-background px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-mono text-foreground truncate">
                      {typeof window !== "undefined" ? `${window.location.origin}/carta/${cartaCode}` : `/carta/${cartaCode}`}
                    </div>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/carta/${cartaCode}`
                        navigator.clipboard.writeText(url)
                        setCopiedField("cartaLink")
                        setTimeout(() => setCopiedField(null), 2000)
                      }}
                      className="flex-shrink-0 flex items-center gap-1.5 rounded-xl bg-primary px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      {copiedField === "cartaLink" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedField === "cartaLink" ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>

                {/* Regenerar código */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Regenerar código</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Si regeneras el código, el link anterior dejará de funcionar. Tendrás que actualizar el mensaje de WhatsApp Business con el nuevo link.
                  </p>
                  <button
                    onClick={() => setRegenConfirm(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                  >
                    <Key className="h-3.5 w-3.5" />
                    Regenerar Código
                  </button>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Código actual: <span className="font-bold font-mono">{cartaCode}</span> — Pega el link en el mensaje automático de WhatsApp Business.
                </p>
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {/* Confirmar regenerar código de carta */}
      <ConfirmModal
        open={regenConfirm}
        title="Regenerar código"
        description="¿Regenerar el código? El link actual dejará de funcionar y tendrás que actualizar el mensaje de WhatsApp Business."
        confirmLabel="Regenerar"
        variant="warning"
        onConfirm={async () => {
          const newCode = Math.random().toString(36).substring(2, 10)
          await setConfigValue("cartaCode", newCode)
          setCartaCode(newCode)
          setRegenConfirm(false)
        }}
        onCancel={() => setRegenConfirm(false)}
      />
    </div>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-card p-4 sm:p-6 shadow-sm border border-border">
      <div className="mb-4 sm:mb-5">
        <h2 className="text-base sm:text-lg font-semibold text-card-foreground">{title}</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

function InputField({
  label,
  icon,
  value,
  onChange,
  className = "",
  placeholder = "",
}: {
  label: string
  icon: React.ReactNode
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
}) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
    </div>
  )
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border p-4">
      <div>
        <p className="text-sm font-medium text-card-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  )
}

function SecretField({
  label,
  icon,
  value,
  onChange,
  placeholder = "",
  show,
  onToggleShow,
  onCopy,
  copied,
  hint,
  danger = false,
}: {
  label: string
  icon: React.ReactNode
  value: string
  onChange: (v: string) => void
  placeholder?: string
  show: boolean
  onToggleShow: () => void
  onCopy: () => void
  copied: boolean
  hint?: string
  danger?: boolean
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <div className="flex items-center gap-2">
        <span className={danger ? "text-red-500 dark:text-red-400" : "text-muted-foreground"}>{icon}</span>
        <div className="relative flex-1">
          <input
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full rounded-xl border bg-background px-4 py-2.5 pr-20 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
              danger ? "border-red-500/20" : "border-border"
            }`}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              onClick={onToggleShow}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              type="button"
            >
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            {value && (
              <button
                onClick={onCopy}
                className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                type="button"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>
      {hint && (
        <p className={`text-[10px] mt-1 ml-6 ${danger ? "text-red-500/70 dark:text-red-400/70" : "text-muted-foreground"}`}>
          {hint}
        </p>
      )}
    </div>
  )
}
