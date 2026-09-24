"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import Image from "next/image"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Upload,
  ImageIcon,
  DollarSign,
  Tag,
  Package,
  Cloud,
  CloudOff,
  Loader2,
  Layers,
  FileUp,
  AlertCircle,
  CheckCircle2,
  Download,
  MoreVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import { menuItems as fallbackMenuItems, categories as defaultCategoriesFallback, type MenuItem } from "@/lib/store"
import { saveCategories, loadCategories, type CustomCategory } from "@/lib/config-store"
import { uploadImage, isCloudinaryConfigured, optimizeCloudinaryUrl } from "@/lib/cloudinary"
import {
  getProducts, addProduct, updateProduct, deleteProduct as deleteProductDb,
  getCategories as getDbCategories, addCategory, updateCategory, deleteCategory as deleteCategoryDb,
  updateCategorySortOrders, deleteAllProducts, batchUpdateCustomization, batchUpdateCustomBuild,
  batchUpdateDiscount, getDiscountStatus, getActiveDiscountPct, getEffectivePrice,
  formatDiscountSchedule, seedIfEmpty, type Product, type Category as DbCategory, type CustomizationOption,
} from "@/lib/supabase-menu"
import {
  DiscountFields, emptyDiscountForm, productToDiscountForm,
  validateDiscountForm, formToDiscountConfig, formToDiscountColumns,
  type DiscountForm,
} from "@/components/discount-fields"

interface MenuItemEditable extends MenuItem {
  description?: string
  available?: boolean
  protein_options?: CustomizationOption[] | null
  wrapper_options?: CustomizationOption[] | null
  per_unit_choice?: boolean
  choice_count?: number | null
  discount_pct?: number | null
  discount_start?: string | null
  discount_end?: string | null
  discount_days?: number[] | null
  discount_time_start?: string | null
  discount_time_end?: string | null
}

interface CsvRow {
  name: string
  price: number
  category: string
  image: string
  description: string
  available: boolean
  valid: boolean
  error?: string
}

export default function MenuPage() {
  const [items, setItems] = useState<MenuItemEditable[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItemEditable | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  // Menú overflow móvil
  const [showOverflow, setShowOverflow] = useState(false)

  // Importación CSV
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [csvPreview, setCsvPreview] = useState<{ rows: CsvRow[]; errors: string[] } | null>(null)
  const [importing, setImporting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [hasCloudinary, setHasCloudinary] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  // Categorías personalizadas
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([])
  const [showCatModal, setShowCatModal] = useState(false)
  const [catForm, setCatForm] = useState({ name: "" })
  const [editingCat, setEditingCat] = useState<CustomCategory | null>(null)
  const [deleteCatConfirm, setDeleteCatConfirm] = useState<string | null>(null)
  const [detailItem, setDetailItem] = useState<MenuItemEditable | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    price: "",
    category: "",
    image: "",
    description: "",
    available: true,
    allow_custom_build: false,
    per_unit_choice: false,
    choice_count: "",
  })

  // Descuento por tiempo limitado (modal de producto)
  const [discountForm, setDiscountForm] = useState<DiscountForm>(emptyDiscountForm)
  const discountError = useMemo(() => validateDiscountForm(discountForm), [discountForm])

  // Opciones de personalización
  const [proteinOptions, setProteinOptions] = useState<CustomizationOption[]>([])
  const [wrapperOptions, setWrapperOptions] = useState<CustomizationOption[]>([])

  // Copiar personalización
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copyTargetIds, setCopyTargetIds] = useState<Set<string>>(new Set())
  const [copyingCustomization, setCopyingCustomization] = useState(false)

  // Descuentos masivos
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [discountTargetIds, setDiscountTargetIds] = useState<Set<string>>(new Set())
  const [bulkDiscountForm, setBulkDiscountForm] = useState<DiscountForm>(emptyDiscountForm)
  const [applyingBulkDiscount, setApplyingBulkDiscount] = useState(false)
  const [bulkDiscountMsg, setBulkDiscountMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const bulkDiscountError = useMemo(() => validateDiscountForm(bulkDiscountForm), [bulkDiscountForm])

  const openBulkDiscountModal = () => {
    setDiscountTargetIds(new Set())
    setBulkDiscountForm(emptyDiscountForm)
    setBulkDiscountMsg(null)
    setShowDiscountModal(true)
  }

  const toggleDiscountTarget = (id: string) => {
    setDiscountTargetIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCategoryDiscountTargets = (catId: string) => {
    const catItemIds = items.filter((i) => i.category === catId).map((i) => i.id)
    setDiscountTargetIds(prev => {
      const allSelected = catItemIds.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allSelected) catItemIds.forEach((id) => next.delete(id))
      else catItemIds.forEach((id) => next.add(id))
      return next
    })
  }

  const handleApplyBulkDiscount = async (clear: boolean) => {
    if (discountTargetIds.size === 0) return
    if (!clear && bulkDiscountError) return
    setApplyingBulkDiscount(true)
    setBulkDiscountMsg(null)
    const ids = Array.from(discountTargetIds)
    const config = clear ? null : formToDiscountConfig(bulkDiscountForm)
    const ok = await batchUpdateDiscount(ids, config)
    if (ok) {
      const cols = clear
        ? { discount_pct: null, discount_start: null, discount_end: null, discount_days: null, discount_time_start: null, discount_time_end: null }
        : formToDiscountColumns(bulkDiscountForm)
      setItems(prev => prev.map((item) =>
        discountTargetIds.has(item.id) ? { ...item, ...cols } : item
      ))
      setBulkDiscountMsg({ ok: true, text: clear ? "Descuento quitado de los productos seleccionados." : `Descuento aplicado a ${ids.length} producto${ids.length !== 1 ? "s" : ""}.` })
      setDiscountTargetIds(new Set())
      setBulkDiscountForm(emptyDiscountForm)
    } else {
      setBulkDiscountMsg({ ok: false, text: "No se pudo actualizar el descuento. Revisa tu conexión e inténtalo de nuevo." })
    }
    setApplyingBulkDiscount(false)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Imagen genérica por defecto para productos sin imagen
  const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=400&fit=crop"

  // Cargar datos desde Supabase
  useEffect(() => {
    setHasCloudinary(isCloudinaryConfigured())

    async function loadData() {
      // Cargar productos
      const prods = await getProducts()
      setItems(prods.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        image: p.image,
        category: p.category,
        description: p.description || "",
        available: p.available,
        protein_options: p.protein_options || null,
        wrapper_options: p.wrapper_options || null,
        allow_custom_build: p.allow_custom_build || false,
        per_unit_choice: p.per_unit_choice || false,
        choice_count: p.choice_count || null,
        discount_pct: p.discount_pct != null ? Number(p.discount_pct) : null,
        discount_start: p.discount_start || null,
        discount_end: p.discount_end || null,
        discount_days: Array.isArray(p.discount_days) ? p.discount_days.map((d) => Number(d)) : null,
        discount_time_start: p.discount_time_start || null,
        discount_time_end: p.discount_time_end || null,
      })))

      // Cargar categorías
      const cats = await getDbCategories()
      if (cats.length > 0) {
        setCustomCategories(cats.map((c) => ({ id: c.id, name: c.name })))
      }

      setPageLoading(false)
    }
    loadData()
  }, [])

  // Categorías combinadas para usar en toda la página
  const categories = useMemo(() => {
    const allCat = defaultCategoriesFallback.find((c) => c.id === "all")
    const cats = customCategories.map((c) => ({
      id: c.id,
      name: c.name,
      image: defaultCategoriesFallback.find((d) => d.id === c.id)?.image || "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200&h=200&fit=crop",
      itemCount: items.filter((i) => i.category === c.id).length,
    }))
    return allCat ? [allCat, ...cats] : cats
  }, [customCategories, items])

  const filteredItems = useMemo(() => {
    let result = items
    if (filterCategory !== "all") {
      result = result.filter((item) => item.category === filterCategory)
    }
    if (searchQuery) {
      result = result.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    return result
  }, [items, filterCategory, searchQuery])

  const getCategoryName = (catId: string) => {
    return categories.find((c) => c.id === catId)?.name || customCategories.find((c) => c.id === catId)?.name || catId
  }

  // --- CRUD Categorías ---
  const handleSaveCat = async () => {
    if (!catForm.name.trim()) return
    if (editingCat) {
      const result = await updateCategory(editingCat.id, { name: catForm.name.trim() })
      if (result) {
        setCustomCategories((prev) =>
          prev.map((c) => c.id === editingCat.id ? { ...c, name: catForm.name.trim() } : c)
        )
      }
    } else {
      const newId = catForm.name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now()
      const result = await addCategory({ id: newId, name: catForm.name.trim(), sort_order: customCategories.length })
      if (result) {
        setCustomCategories((prev) => [...prev, { id: result.id, name: result.name }])
      }
    }
    setCatForm({ name: "" })
    setEditingCat(null)
  }

  const handleMoveCat = async (catId: string, direction: "up" | "down") => {
    const idx = customCategories.findIndex((c) => c.id === catId)
    if (idx < 0) return
    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= customCategories.length) return
    const newCats = [...customCategories]
    ;[newCats[idx], newCats[swapIdx]] = [newCats[swapIdx], newCats[idx]]
    setCustomCategories(newCats)
    await updateCategorySortOrders(newCats.map((c, i) => ({ id: c.id, sort_order: i })))
  }

  const handleDeleteCat = async (catId: string) => {
    const ok = await deleteCategoryDb(catId)
    if (ok) setCustomCategories((prev) => prev.filter((c) => c.id !== catId))
    setDeleteCatConfirm(null)
  }

  const openCreateModal = () => {
    setEditingItem(null)
    const defaultCat = customCategories.length > 0 ? customCategories[0].id : "appetizer"
    setFormData({
      name: "",
      price: "",
      category: defaultCat,
      image: "",
      description: "",
      available: true,
      allow_custom_build: false,
      per_unit_choice: false,
      choice_count: "",
    })
    setProteinOptions([])
    setWrapperOptions([])
    setDiscountForm(emptyDiscountForm)
    setShowModal(true)
  }

  const openEditModal = (item: MenuItemEditable) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      price: item.price.toString(),
      category: item.category,
      image: item.image,
      description: item.description || "",
      available: item.available !== false,
      allow_custom_build: item.allow_custom_build || false,
      per_unit_choice: item.per_unit_choice || false,
      choice_count: item.choice_count ? item.choice_count.toString() : "",
    })
    setProteinOptions(item.protein_options || [])
    setWrapperOptions(item.wrapper_options || [])
    setDiscountForm(productToDiscountForm(item))
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.price) return
    if (discountError) return

    setUploading(true)
    setUploadError(null)

    let finalImage = formData.image
    const itemId = editingItem?.id || Date.now().toString()

    // Si hay un archivo pendiente y Cloudinary está configurado, subir
    if (pendingFile && isCloudinaryConfigured()) {
      try {
        finalImage = await uploadImage(pendingFile, "menu")
      } catch (err: any) {
        setUploadError(err.message || "Error al subir imagen")
        setUploading(false)
        return
      }
    }

    const cleanProteins = proteinOptions.filter(o => o.name.trim())
    const cleanWrappers = wrapperOptions.filter(o => o.name.trim())

    // Descuento: formToDiscountColumns devuelve las 6 columnas (null si vacío)
    const discountFields = formToDiscountColumns(discountForm)

    if (editingItem) {
      const updates: any = {
        name: formData.name,
        price: parseFloat(formData.price),
        category: formData.category,
        image: finalImage || editingItem.image,
        description: formData.description,
        available: formData.available,
        allow_custom_build: formData.allow_custom_build,
        per_unit_choice: formData.per_unit_choice,
        choice_count: formData.per_unit_choice && formData.choice_count ? parseInt(formData.choice_count) : null,
        protein_options: cleanProteins.length > 0 ? cleanProteins : null,
        wrapper_options: cleanWrappers.length > 0 ? cleanWrappers : null,
        ...discountFields,
      }
      const result = await updateProduct(editingItem.id, updates)
      if (result) {
        setItems((prev) =>
          prev.map((item) => item.id === editingItem.id ? { ...item, ...updates } : item)
        )
      }
    } else {
      const newProd: any = {
        id: itemId,
        name: formData.name,
        price: parseFloat(formData.price),
        category: formData.category,
        image: finalImage || "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=400&fit=crop",
        description: formData.description,
        available: formData.available,
        allow_custom_build: formData.allow_custom_build,
        per_unit_choice: formData.per_unit_choice,
        choice_count: formData.per_unit_choice && formData.choice_count ? parseInt(formData.choice_count) : null,
        sort_order: items.length,
        protein_options: cleanProteins.length > 0 ? cleanProteins : null,
        wrapper_options: cleanWrappers.length > 0 ? cleanWrappers : null,
        ...discountFields,
      }
      const result = await addProduct(newProd)
      if (result) {
        setItems((prev) => [...prev, {
          id: result.id,
          name: result.name,
          price: Number(result.price),
          image: result.image,
          category: result.category,
          description: result.description || "",
          available: result.available,
          protein_options: result.protein_options || null,
          wrapper_options: result.wrapper_options || null,
          discount_pct: result.discount_pct != null ? Number(result.discount_pct) : null,
          discount_start: result.discount_start || null,
          discount_end: result.discount_end || null,
          discount_days: Array.isArray(result.discount_days) ? result.discount_days.map((d) => Number(d)) : null,
          discount_time_start: result.discount_time_start || null,
          discount_time_end: result.discount_time_end || null,
        }])
      }
    }
    setUploading(false)
    setPendingFile(null)
    setShowModal(false)
  }

  const openCopyCustomization = (sourceItem: MenuItemEditable) => {
    const sourceProteins = sourceItem.protein_options || []
    const sourceWrappers = sourceItem.wrapper_options || []
    if (sourceProteins.length === 0 && sourceWrappers.length === 0) return
    setProteinOptions(sourceProteins)
    setWrapperOptions(sourceWrappers)
    setCopyTargetIds(new Set())
    setShowCopyModal(true)
  }

  const handleCopyCustomization = async () => {
    if (copyTargetIds.size === 0) return
    setCopyingCustomization(true)
    const cleanProteins = proteinOptions.filter(o => o.name.trim())
    const cleanWrappers = wrapperOptions.filter(o => o.name.trim())
    const ok = await batchUpdateCustomization(
      Array.from(copyTargetIds),
      cleanProteins.length > 0 ? cleanProteins : null,
      cleanWrappers.length > 0 ? cleanWrappers : null
    )
    if (ok) {
      setItems(prev => prev.map(item =>
        copyTargetIds.has(item.id)
          ? { ...item, protein_options: cleanProteins.length > 0 ? cleanProteins : null, wrapper_options: cleanWrappers.length > 0 ? cleanWrappers : null }
          : item
      ))
    }
    setCopyingCustomization(false)
    setShowCopyModal(false)
  }

  const toggleAllCopyTargets = () => {
    if (copyTargetIds.size === items.length) {
      setCopyTargetIds(new Set())
    } else {
      setCopyTargetIds(new Set(items.map(i => i.id)))
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await deleteProductDb(id)
    if (ok) setItems((prev) => prev.filter((item) => item.id !== id))
    setDeleteConfirm(null)
  }

  const handleDeleteAll = async () => {
    setDeletingAll(true)
    const ok = await deleteAllProducts()
    if (ok) setItems([])
    setDeletingAll(false)
    setDeleteAllConfirm(false)
  }

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length < 2) {
        setCsvPreview({ rows: [], errors: ["El archivo no tiene filas de datos."] })
        return
      }

      // Parser CSV que respeta campos entrecomillados (ej: "Roll salmón, queso y palta")
      const parseCsvLine = (line: string): string[] => {
        const result: string[] = []
        let current = ""
        let inQuotes = false
        for (let j = 0; j < line.length; j++) {
          const ch = line[j]
          if (ch === '"') { inQuotes = !inQuotes; continue }
          if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ""; continue }
          current += ch
        }
        result.push(current.trim())
        return result
      }

      const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase())
      const nameIdx = header.indexOf("nombre")
      const priceIdx = header.indexOf("precio")
      const catIdx = header.indexOf("categoria")
      const imgIdx = header.indexOf("imagen")
      const descIdx = header.indexOf("descripcion")
      const availIdx = header.indexOf("disponible")

      if (nameIdx === -1 || priceIdx === -1) {
        setCsvPreview({ rows: [], errors: ["El CSV debe tener columnas 'nombre' y 'precio'."] })
        return
      }

      const defaultCat = customCategories[0]?.id || ""
      const rows: CsvRow[] = lines.slice(1).map((line, i) => {
        const cols = parseCsvLine(line)
        const name = cols[nameIdx] || ""
        const rawPrice = cols[priceIdx] || ""
        const price = parseFloat(rawPrice.replace(/[^0-9.]/g, ""))
        const category = catIdx >= 0 ? (cols[catIdx] || defaultCat) : defaultCat
        const image = imgIdx >= 0 ? (cols[imgIdx] || DEFAULT_IMAGE) : DEFAULT_IMAGE
        const description = descIdx >= 0 ? (cols[descIdx] || "") : ""
        const availRaw = availIdx >= 0 ? cols[availIdx]?.toLowerCase() : ""
        const available = availRaw === "false" || availRaw === "no" || availRaw === "0" ? false : true

        if (!name) return { name, price, category, image, description, available, valid: false, error: `Fila ${i + 2}: nombre vacío` }
        if (isNaN(price) || price <= 0) return { name, price: 0, category, image, description, available, valid: false, error: `Fila ${i + 2}: precio inválido ("${rawPrice}")` }
        return { name, price, category, image, description, available, valid: true }
      })

      setCsvPreview({ rows, errors: rows.filter((r) => !r.valid).map((r) => r.error!) })
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const handleImportCsv = async () => {
    if (!csvPreview) return
    const validRows = csvPreview.rows.filter((r) => r.valid)
    if (validRows.length === 0) return
    setImporting(true)
    const results = await Promise.all(
      validRows.map((row, i) =>
        addProduct({
          id: `csv-${Date.now()}-${i}`,
          name: row.name,
          price: row.price,
          category: row.category,
          image: row.image || DEFAULT_IMAGE,
          description: row.description,
          available: row.available,
          sort_order: items.length + i,
        })
      )
    )
    const created = results.filter(Boolean) as Product[]
    setItems((prev) => [
      ...prev,
      ...created.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        image: p.image,
        category: p.category,
        description: p.description || "",
        available: p.available,
      })),
    ])
    setImporting(false)
    setCsvPreview(null)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Guardar archivo para subir a Cloudinary al guardar
      setPendingFile(file)
      // Mostrar preview local inmediata
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, image: reader.result as string }))
      }
      reader.readAsDataURL(file)
    }
  }

  const stats = useMemo(() => {
    const total = items.length
    const disponibles = items.filter((i) => i.available !== false).length
    const categoriasCont = new Set(items.map((i) => i.category)).size
    return { total, disponibles, categoriasCont }
  }, [items])

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
          <h1 className="text-lg sm:text-2xl font-bold text-foreground">Gestión de Menú</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Administra los productos</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Acciones secundarias — visibles solo en desktop */}
          {items.length > 0 && (
            <button
              onClick={() => setDeleteAllConfirm(true)}
              className="hidden sm:flex items-center gap-2 rounded-full border border-red-500/30 bg-card px-5 py-2.5 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors shadow-sm"
            >
              <Trash2 className="h-4 w-4" />
              Borrar Todo
            </button>
          )}
          <a
            href="/plantilla-productos.csv"
            download="plantilla-productos.csv"
            className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-card-foreground hover:bg-accent transition-colors shadow-sm"
          >
            <Download className="h-4 w-4" />
            Plantilla
          </a>
          <button
            onClick={() => csvInputRef.current?.click()}
            className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-card-foreground hover:bg-accent transition-colors shadow-sm"
          >
            <FileUp className="h-4 w-4" />
            Importar CSV
          </button>

          {/* Menú overflow — solo móvil */}
          <div className="relative sm:hidden">
            <button
              onClick={() => setShowOverflow(!showOverflow)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-accent transition-colors shadow-sm"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showOverflow && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowOverflow(false)} />
                <div className="absolute right-0 top-11 z-50 w-48 rounded-xl border border-border bg-card shadow-xl py-1 overflow-hidden">
                  <button
                    onClick={() => { openBulkDiscountModal(); setShowOverflow(false) }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    Descuentos
                  </button>
                  <button
                    onClick={() => { csvInputRef.current?.click(); setShowOverflow(false) }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-card-foreground hover:bg-accent transition-colors"
                  >
                    <FileUp className="h-3.5 w-3.5 text-muted-foreground" />
                    Importar CSV
                  </button>
                  <a
                    href="/plantilla-productos.csv"
                    download="plantilla-productos.csv"
                    onClick={() => setShowOverflow(false)}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-card-foreground hover:bg-accent transition-colors"
                  >
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                    Descargar Plantilla
                  </a>
                  {items.length > 0 && (
                    <>
                      <div className="mx-3 my-1 border-t border-border" />
                      <button
                        onClick={() => { setDeleteAllConfirm(true); setShowOverflow(false) }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Borrar Todo
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvFile}
            className="hidden"
          />
          <button
            onClick={openBulkDiscountModal}
            className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-card px-5 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors shadow-sm"
          >
            <Tag className="h-4 w-4" />
            Descuentos
          </button>
          <button
            onClick={() => { setShowCatModal(true); setCatForm({ name: "" }); setEditingCat(null) }}
            className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-border bg-card px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-card-foreground hover:bg-accent transition-colors shadow-sm"
          >
            <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Categorías</span>
            <span className="sm:hidden">Cat.</span>
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-primary px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Nuevo Producto</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="rounded-2xl bg-card p-3 sm:p-4 shadow-sm border border-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-primary/10">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-card-foreground">{stats.total}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Productos</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-card p-3 sm:p-4 shadow-sm border border-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-500/10">
              <Tag className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-card-foreground">{stats.disponibles}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Disponibles</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-card p-3 sm:p-4 shadow-sm border border-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-amber-500/10">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-card-foreground">{stats.categoriasCont}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Categorías</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 rounded-xl bg-card px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm border border-border flex-1 min-w-0 sm:min-w-[240px] sm:flex-none">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-none bg-transparent text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none w-full"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
        >
          <option value="all">Todas las categorías</option>
          {categories.filter((c) => c.id !== "all").map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Grid de Productos */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={`rounded-2xl bg-card shadow-sm border border-border overflow-hidden hover:shadow-md transition-shadow ${
              item.available === false ? "opacity-60" : ""
            }`}
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-accent cursor-pointer" onClick={() => setDetailItem(item)}>
              <Image
                src={optimizeCloudinaryUrl(item.image, 300)}
                alt={item.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                loading="lazy"
              />
              {item.available === false && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
                    No Disponible
                  </span>
                </div>
              )}
              <div className="absolute top-2 right-2">
                <span className="rounded-full bg-card/90 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-card-foreground shadow-sm">
                  {getCategoryName(item.category)}
                </span>
              </div>
              {(() => {
                const status = getDiscountStatus(item)
                if (!status) return null
                const pct = getActiveDiscountPct(item)
                if (status === "active" && pct !== null) {
                  return (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white shadow-sm">
                      -{pct}%
                    </div>
                  )
                }
                if (status === "recurring") {
                  const schedule = formatDiscountSchedule(item)
                  const short = schedule.length > 24 ? `${schedule.slice(0, 22)}…` : schedule
                  return (
                    <div
                      title={schedule}
                      className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm max-w-[140px] truncate"
                    >
                      Semanal · {short}
                    </div>
                  )
                }
                if (status === "scheduled") {
                  const start = item.discount_start ? new Date(item.discount_start) : null
                  return (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                      Programado{start ? ` ${start.toLocaleDateString("es-CL")} ${start.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </div>
                  )
                }
                if (status === "expired") {
                  return (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-zinc-400 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                      Vencido
                    </div>
                  )
                }
                return null
              })()}
            </div>
            <div className="p-2.5 sm:p-4">
              <div className="flex items-start justify-between mb-1.5 sm:mb-2">
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-semibold text-card-foreground truncate">{item.name}</h3>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                  )}
                </div>
                <div className="text-right ml-2">
                  {(() => {
                    const pct = getActiveDiscountPct(item)
                    if (pct !== null) {
                      const final = getEffectivePrice(item)
                      return (
                        <div>
                          <p className="text-[10px] text-muted-foreground line-through">${item.price.toLocaleString("es-CL")}</p>
                          <p className="text-base font-bold text-red-500">${final.toLocaleString("es-CL")}</p>
                        </div>
                      )
                    }
                    return <p className="text-base font-bold text-primary">$ {item.price}</p>
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => openEditModal(item)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-card-foreground hover:bg-accent transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>
                <button
                  onClick={() => setDeleteConfirm(item.id)}
                  className="flex items-center justify-center rounded-lg border border-red-500/20 px-3 py-2 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Tarjeta para agregar nuevo */}
        <button
          onClick={openCreateModal}
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/50 p-8 hover:border-primary/50 hover:bg-accent/50 transition-all min-h-[280px]"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-3">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-semibold text-card-foreground">Agregar Producto</p>
          <p className="text-xs text-muted-foreground mt-1">Sube imagen y configura el producto</p>
        </button>
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card shadow-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-card-foreground">
                {editingItem ? "Editar Producto" : "Nuevo Producto"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Imagen */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Imagen del Producto</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-accent/30 p-6 cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                >
                  {formData.image ? (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={formData.image}
                        alt="Vista previa"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground">
                          Cambiar Imagen
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium text-card-foreground">Subir imagen</p>
                      <p className="text-xs text-muted-foreground">o pega una URL abajo</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="mt-2 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="URL de la imagen..."
                    value={formData.image}
                    onChange={(e) => setFormData((prev) => ({ ...prev, image: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Nombre */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nombre del Producto *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Sashimi de Salmón"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Precio y Categoría */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Precio *</label>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={formData.price}
                      onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Categoría</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {categories.filter((c) => c.id !== "all").map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción breve del producto..."
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              {/* Personalización: Proteínas */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">🥩 Opciones de Proteína</p>
                    <p className="text-[10px] text-muted-foreground">Primera opción es la base (precio 0)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProteinOptions(prev => [...prev, { name: "", price: 0 }])}
                    className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Agregar
                  </button>
                </div>
                {proteinOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt.name}
                      onChange={(e) => setProteinOptions(prev => prev.map((o, i) => i === idx ? { ...o, name: e.target.value } : o))}
                      placeholder="Ej: pollo, camarón..."
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        min={0}
                        value={opt.price}
                        onChange={(e) => setProteinOptions(prev => prev.map((o, i) => i === idx ? { ...o, price: Number(e.target.value) || 0 } : o))}
                        className="w-20 rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setProteinOptions(prev => prev.filter((_, i) => i !== idx))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {proteinOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Sin opciones de proteína (producto sin personalización)</p>
                )}
              </div>

              {/* Personalización: Envolturas */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">🍣 Opciones de Envoltura</p>
                    <p className="text-[10px] text-muted-foreground">Primera opción es la base (precio 0)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWrapperOptions(prev => [...prev, { name: "", price: 0 }])}
                    className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Agregar
                  </button>
                </div>
                {wrapperOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt.name}
                      onChange={(e) => setWrapperOptions(prev => prev.map((o, i) => i === idx ? { ...o, name: e.target.value } : o))}
                      placeholder="Ej: queso crema, palta..."
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        min={0}
                        value={opt.price}
                        onChange={(e) => setWrapperOptions(prev => prev.map((o, i) => i === idx ? { ...o, price: Number(e.target.value) || 0 } : o))}
                        className="w-20 rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setWrapperOptions(prev => prev.filter((_, i) => i !== idx))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {wrapperOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Sin opciones de envoltura (producto sin personalización)</p>
                )}
              </div>

              {/* Copiar personalización a otros productos */}
              {(proteinOptions.filter(o => o.name.trim()).length > 0 || wrapperOptions.filter(o => o.name.trim()).length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setCopyTargetIds(new Set())
                    setShowCopyModal(true)
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <Layers className="h-4 w-4" />
                  Copiar personalización a otros productos
                </button>
              )}

              {/* Disponibilidad */}
              <div className="flex items-center justify-between rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-medium text-card-foreground">Disponible</p>
                  <p className="text-xs text-muted-foreground">Mostrar en el punto de venta</p>
                </div>
                <button
                  onClick={() => setFormData((prev) => ({ ...prev, available: !prev.available }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    formData.available ? "bg-primary" : "bg-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      formData.available ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Ármalo a tu pinta */}
              <div className="flex items-center justify-between rounded-xl border border-amber-500/20 p-4" style={{ background: formData.allow_custom_build ? "rgba(245,158,11,0.05)" : undefined }}>
                <div>
                  <p className="text-sm font-medium text-card-foreground flex items-center gap-1.5">🎨 Ármalo a tu pinta</p>
                  <p className="text-xs text-muted-foreground">Permite al cliente personalizar este producto libremente</p>
                </div>
                <button
                  onClick={() => setFormData((prev) => ({ ...prev, allow_custom_build: !prev.allow_custom_build }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    formData.allow_custom_build ? "bg-amber-500" : "bg-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      formData.allow_custom_build ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Elección por unidad */}
              <div className="rounded-xl border border-blue-500/20 p-4 space-y-3" style={{ background: formData.per_unit_choice ? "rgba(59,130,246,0.05)" : undefined }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-card-foreground flex items-center gap-1.5">🔢 Elección por unidad</p>
                    <p className="text-xs text-muted-foreground">El cliente elige una opción por cada unidad (ej: 3 handrolls = 3 elecciones)</p>
                  </div>
                  <button
                    onClick={() => setFormData((prev) => ({ ...prev, per_unit_choice: !prev.per_unit_choice }))}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      formData.per_unit_choice ? "bg-blue-500" : "bg-border"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                        formData.per_unit_choice ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                {formData.per_unit_choice && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cantidad de unidades a elegir</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.choice_count}
                      onChange={(e) => setFormData((prev) => ({ ...prev, choice_count: e.target.value }))}
                      placeholder="Ej: 3"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Marcar todos / Desmarcar todos */}
              {items.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const allIds = items.map((i) => i.id)
                      const ok = await batchUpdateCustomBuild(allIds, true)
                      if (ok) {
                        setItems((prev) => prev.map((i) => ({ ...i, allow_custom_build: true })))
                        setFormData((prev) => ({ ...prev, allow_custom_build: true }))
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/20 py-2.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                  >
                    🎨 Activar en todos
                  </button>
                  <button
                    onClick={async () => {
                      const allIds = items.map((i) => i.id)
                      const ok = await batchUpdateCustomBuild(allIds, false)
                      if (ok) {
                        setItems((prev) => prev.map((i) => ({ ...i, allow_custom_build: false })))
                        setFormData((prev) => ({ ...prev, allow_custom_build: false }))
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
                  >
                    Desactivar en todos
                  </button>
                </div>
              )}

              {/* Descuento por tiempo limitado */}
              <DiscountFields
                form={discountForm}
                setForm={setDiscountForm}
                basePrice={parseFloat(formData.price) || 0}
              />
            </div>

            {/* Upload error */}
            {uploadError && (
              <div className="mx-6 mb-2 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                <CloudOff className="h-4 w-4 text-red-500 dark:text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border px-6 py-4">
              {/* Indicador de Storage */}
              <div className="flex items-center gap-1.5">
                {hasCloudinary ? (
                  <>
                    <Cloud className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Cloudinary conectado</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Sin Cloudinary</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setShowModal(false); setUploadError(null); setPendingFile(null) }}
                  disabled={uploading}
                  className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-card-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formData.name || !formData.price || uploading || !!discountError}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {uploading ? "Subiendo..." : editingItem ? "Guardar Cambios" : "Crear Producto"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gestión de Categorías */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-card shadow-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground">Gestionar Categorías</h3>
                  <p className="text-xs text-muted-foreground">{customCategories.length} categorías</p>
                </div>
              </div>
              <button
                onClick={() => setShowCatModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Formulario agregar/editar */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Nombre de la categoría..."
                  value={catForm.name}
                  onChange={(e) => setCatForm({ name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveCat()}
                  className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <button
                  onClick={handleSaveCat}
                  disabled={!catForm.name.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                  {editingCat ? "Guardar" : "Agregar"}
                </button>
                {editingCat && (
                  <button
                    onClick={() => { setEditingCat(null); setCatForm({ name: "" }) }}
                    className="rounded-xl border border-border px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            {/* Lista de categorías */}
            <div className="px-6 py-3 max-h-[320px] overflow-y-auto space-y-1">
              {customCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay categorías. Agrega una arriba.</p>
              ) : (
                customCategories.map((cat) => {
                  const count = items.filter((i) => i.category === cat.id).length
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                          {cat.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-card-foreground">{cat.name}</p>
                          <p className="text-[10px] text-muted-foreground">{count} producto{count !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleMoveCat(cat.id, "up")}
                          disabled={customCategories.indexOf(cat) === 0}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                          title="Subir"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveCat(cat.id, "down")}
                          disabled={customCategories.indexOf(cat) === customCategories.length - 1}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                          title="Bajar"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { setEditingCat(cat); setCatForm({ name: cat.name }) }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {deleteCatConfirm === cat.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteCat(cat.id)}
                              className="rounded-lg bg-red-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-600 transition-colors"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setDeleteCatConfirm(null)}
                              className="rounded-lg border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteCatConfirm(cat.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border">
              <button
                onClick={() => setShowCatModal(false)}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card shadow-xl border border-border p-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 mb-4">
                <Trash2 className="h-6 w-6 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-1">Eliminar Producto</h3>
              <p className="text-sm text-muted-foreground mb-6">
                ¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.
              </p>
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Borrar Todo */}
      {deleteAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card shadow-xl border border-border p-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 mb-4">
                <Trash2 className="h-6 w-6 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-1">Borrar todos los productos</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Se eliminarán <span className="font-semibold text-foreground">{items.length} productos</span> permanentemente. Esta acción no se puede deshacer.
              </p>
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setDeleteAllConfirm(false)}
                  disabled={deletingAll}
                  className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteAll}
                  disabled={deletingAll}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deletingAll && <Loader2 className="h-4 w-4 animate-spin" />}
                  {deletingAll ? "Borrando..." : "Borrar Todo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview CSV */}
      {csvPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-card shadow-xl border border-border overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <FileUp className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-card-foreground">Importar desde CSV</h2>
              </div>
              <button onClick={() => setCsvPreview(null)} className="rounded-lg p-1.5 hover:bg-accent transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Errores */}
            {csvPreview.errors.length > 0 && (
              <div className="mx-6 mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 space-y-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-xs font-semibold text-red-500">{csvPreview.errors.length} fila(s) con error (serán omitidas)</span>
                </div>
                {csvPreview.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-500/80 pl-5">{err}</p>
                ))}
              </div>
            )}

            {/* Resumen */}
            <div className="px-6 pt-4 pb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{csvPreview.rows.filter((r) => r.valid).length}</span> productos listos para importar
              </span>
            </div>

            {/* Tabla */}
            <div className="overflow-y-auto flex-1 px-6 pb-4">
              {csvPreview.rows.filter((r) => r.valid).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay filas válidas para importar.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Nombre</th>
                      <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Precio</th>
                      <th className="text-left py-2 font-semibold text-muted-foreground">Categoría</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {csvPreview.rows.filter((r) => r.valid).map((row, i) => (
                      <tr key={i} className="hover:bg-accent/40 transition-colors">
                        <td className="py-2 pr-3 font-medium text-card-foreground">{row.name}</td>
                        <td className="py-2 pr-3 text-right text-card-foreground">$ {row.price.toLocaleString("es-CL")}</td>
                        <td className="py-2 text-muted-foreground">{row.category || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center gap-3">
              <button
                onClick={() => setCsvPreview(null)}
                disabled={importing}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportCsv}
                disabled={importing || csvPreview.rows.filter((r) => r.valid).length === 0}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                {importing ? "Importando..." : `Importar ${csvPreview.rows.filter((r) => r.valid).length} productos`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Copiar Personalización */}
      {showCopyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card shadow-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">Copiar Personalización</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {proteinOptions.filter(o => o.name.trim()).length} proteínas · {wrapperOptions.filter(o => o.name.trim()).length} envolturas
                </p>
              </div>
              <button
                onClick={() => setShowCopyModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-3 border-b border-border flex items-center justify-between">
              <button
                onClick={toggleAllCopyTargets}
                className="text-xs font-medium text-primary hover:underline"
              >
                {copyTargetIds.size === items.length ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
              <span className="text-xs text-muted-foreground">{copyTargetIds.size} seleccionados</span>
            </div>

            <div className="max-h-[50vh] overflow-y-auto px-6 py-3 space-y-1">
              {items.map((item) => {
                const isSelected = copyTargetIds.has(item.id)
                const hasConfig = (item.protein_options && item.protein_options.length > 0) || (item.wrapper_options && item.wrapper_options.length > 0)
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCopyTargetIds(prev => {
                        const next = new Set(prev)
                        if (next.has(item.id)) next.delete(item.id)
                        else next.add(item.id)
                        return next
                      })
                    }}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${isSelected ? "bg-primary/10" : "hover:bg-accent"}`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                      {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-card-foreground truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{getCategoryName(item.category)} · ${item.price.toLocaleString("es-CL")}</p>
                    </div>
                    {hasConfig && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium flex-shrink-0">
                        Ya tiene config
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button
                onClick={() => setShowCopyModal(false)}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-card-foreground hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCopyCustomization}
                disabled={copyTargetIds.size === 0 || copyingCustomization}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {copyingCustomization ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                {copyingCustomization ? "Copiando..." : `Copiar a ${copyTargetIds.size} producto${copyTargetIds.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Descuentos Masivos */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card shadow-xl border border-border overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">Descuentos por tiempo limitado</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Aplica a varios productos a la vez</p>
              </div>
              <button
                onClick={() => setShowDiscountModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-border space-y-3">
              <DiscountFields
                form={bulkDiscountForm}
                setForm={setBulkDiscountForm}
              />
              {bulkDiscountMsg && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${bulkDiscountMsg.ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-500"}`}>
                  {bulkDiscountMsg.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                  {bulkDiscountMsg.text}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{discountTargetIds.size} seleccionados</span>
                <button
                  onClick={() => setDiscountTargetIds(discountTargetIds.size === items.length ? new Set() : new Set(items.map((i) => i.id)))}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {discountTargetIds.size === items.length ? "Deseleccionar todos" : "Seleccionar todos"}
                </button>
              </div>
            </div>

            <div className="max-h-[45vh] overflow-y-auto px-6 py-3 space-y-4">
              {categories.filter((c) => c.id !== "all").map((cat) => {
                const catItems = items.filter((i) => i.category === cat.id)
                if (catItems.length === 0) return null
                const catItemIds = catItems.map((i) => i.id)
                const allSelected = catItemIds.every((id) => discountTargetIds.has(id))
                const someSelected = catItemIds.some((id) => discountTargetIds.has(id))
                return (
                  <div key={cat.id}>
                    <button
                      onClick={() => toggleCategoryDiscountTargets(cat.id)}
                      className="flex items-center gap-2 mb-1.5 w-full text-left"
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${allSelected ? "bg-primary border-primary" : someSelected ? "border-primary bg-primary/30" : "border-border"}`}>
                        {allSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{cat.name}</span>
                      <span className="text-[10px] text-muted-foreground">({catItems.length})</span>
                    </button>
                    <div className="space-y-1 pl-6">
                      {catItems.map((item) => {
                        const isSelected = discountTargetIds.has(item.id)
                        const status = getDiscountStatus(item)
                        const pct = getActiveDiscountPct(item)
                        return (
                          <button
                            key={item.id}
                            onClick={() => toggleDiscountTarget(item.id)}
                            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${isSelected ? "bg-primary/10" : "hover:bg-accent"}`}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                              {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-card-foreground truncate">{item.name}</p>
                              <p className="text-[10px] text-muted-foreground">${item.price.toLocaleString("es-CL")}</p>
                            </div>
                            {pct !== null && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold flex-shrink-0">
                                -{pct}%
                              </span>
                            )}
                            {status === "recurring" && (
                              <span
                                title={formatDiscountSchedule(item)}
                                className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium flex-shrink-0 max-w-[120px] truncate"
                              >
                                Semanal
                              </span>
                            )}
                            {status === "scheduled" && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium flex-shrink-0">
                                Programado
                              </span>
                            )}
                            {status === "expired" && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-400/10 text-zinc-500 font-medium flex-shrink-0">
                                Vencido
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button
                onClick={() => handleApplyBulkDiscount(true)}
                disabled={discountTargetIds.size === 0 || applyingBulkDiscount}
                className="rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Quitar descuento a seleccionados
              </button>
              <button
                onClick={() => handleApplyBulkDiscount(false)}
                disabled={discountTargetIds.size === 0 || applyingBulkDiscount || !!bulkDiscountError || (validateDiscountForm(bulkDiscountForm) === null && formToDiscountConfig(bulkDiscountForm) === null)}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applyingBulkDiscount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                {applyingBulkDiscount ? "Aplicando..." : `Aplicar a ${discountTargetIds.size} seleccionado${discountTargetIds.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setDetailItem(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 fade-in duration-300"
            style={{ background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full aspect-square">
              <Image
                src={optimizeCloudinaryUrl(detailItem.image, 400)}
                alt={detailItem.name}
                fill
                className="object-cover"
                sizes="400px"
              />
              <button
                onClick={() => setDetailItem(null)}
                className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                style={{ background: "rgba(0,0,0,0.5)", color: "#fff" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {getCategoryName(detailItem.category)}
                </span>
                {detailItem.available === false && (
                  <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                    No Disponible
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>{detailItem.name}</h3>
              {detailItem.description && (
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{detailItem.description}</p>
              )}
              <p className="text-lg font-black mt-3" style={{ color: "var(--primary)" }}>$ {detailItem.price.toLocaleString("es-CL")}</p>
              <button
                onClick={() => { setDetailItem(null); openEditModal(detailItem) }}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white mt-4"
                style={{ background: "var(--primary)" }}
              >
                <Pencil className="h-4 w-4" />
                Editar producto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
