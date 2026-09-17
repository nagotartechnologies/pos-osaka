import type { Product, CustomizationOption } from "@/lib/supabase-menu"

export interface CartItem {
  id: string
  name: string
  price: number
  image: string
  quantity: number
  category?: string
  cartKey?: string
  selectedProtein?: CustomizationOption | null
  selectedWrapper?: CustomizationOption | null
  notes?: string
  customBuild?: boolean
  customBuildNotes?: string
  unitChoices?: CustomizationOption[]
}

export interface POSState {
  products: Product[]
  categories: { id: string; name: string }[]
  loading: boolean
  search: string
  selectedCat: string
  cart: CartItem[]
  // Client
  clientName: string
  clientPhone: string
  deliveryType: "delivery" | "retiro"
  address: string
  paymentMethod: "efectivo" | "transferencia" | "tarjeta"
  cardType: "debito" | "credito" | null
  cashAmount: string
  deliveryFee: number
  submitting: boolean
}

export const SALSAS = [
  { id: "salsa-soya", name: "Salsa Soya", price: 0 },
  { id: "salsa-agridulce", name: "Salsa Agridulce", price: 0 },
  { id: "salsa-acevichada", name: "Salsa Acevichada", price: 500 },
  { id: "salsa-teriyaki", name: "Salsa Teriyaki", price: 500 },
] as const

export const MAX_FREE_SALSAS = 5
