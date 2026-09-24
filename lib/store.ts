export interface CustomizationOption {
  name: string
  price: number
}

export interface MenuItem {
  id: string
  name: string
  price: number
  image: string
  category: string
  description?: string
  protein_options?: CustomizationOption[] | null
  wrapper_options?: CustomizationOption[] | null
  allow_custom_build?: boolean
  per_unit_choice?: boolean
  choice_count?: number | null
  created_at?: string
  originalPrice?: number
  discountPct?: number | null
  discountEnd?: string | null
  discountLabel?: string | null
}

export interface CartItem extends MenuItem {
  quantity: number
  cartKey?: string
  selectedProtein?: CustomizationOption | null
  selectedWrapper?: CustomizationOption | null
  notes?: string
  customBuild?: boolean
  customBuildNotes?: string
  unitChoices?: CustomizationOption[]
}

export interface Category {
  id: string
  name: string
  image: string
  itemCount: number
}

export interface OrderRecord {
  id: string
  items: CartItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  type: "para-llevar" | "en-local"
  date: string
  paymentMethod: "efectivo" | "tarjeta" | "transferencia"
}

export const categories: Category[] = [
  { id: "all", name: "Todo el Menú", image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200&h=200&fit=crop", itemCount: 120 },
  { id: "appetizer", name: "Entradas", image: "https://images.unsplash.com/photo-1541014741259-de529411b96a?w=200&h=200&fit=crop", itemCount: 10 },
  { id: "salad", name: "Ensaladas", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=200&fit=crop", itemCount: 9 },
  { id: "sashimi", name: "Sashimi", image: "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=200&h=200&fit=crop", itemCount: 4 },
  { id: "nigiri", name: "Nigiri", image: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=200&h=200&fit=crop", itemCount: 12 },
  { id: "temaki", name: "Temaki", image: "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=200&h=200&fit=crop", itemCount: 9 },
  { id: "raw-sushi", name: "Sushi Crudo", image: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=200&h=200&fit=crop", itemCount: 12 },
  { id: "cooked-sushi", name: "Sushi Cocido", image: "https://images.unsplash.com/photo-1617196034183-421b4917c92d?w=200&h=200&fit=crop", itemCount: 10 },
  { id: "beverages", name: "Bebidas", image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=200&h=200&fit=crop", itemCount: 16 },
]

export const menuItems: MenuItem[] = [
  { id: "1", name: "Edamame", price: 2, image: "https://images.unsplash.com/photo-1564671165093-20688ff1fffa?w=400&h=400&fit=crop", category: "appetizer" },
  { id: "2", name: "Camarones Bang Bang", price: 3, image: "https://images.unsplash.com/photo-1625943553852-781c6dd46faa?w=400&h=400&fit=crop", category: "appetizer" },
  { id: "3", name: "Tempura de Enoki", price: 2, image: "https://images.unsplash.com/photo-1581781870027-04212e231e96?w=400&h=400&fit=crop", category: "appetizer" },
  { id: "4", name: "Shisamo", price: 3, image: "https://images.unsplash.com/photo-1580822184713-fc5400e7fe10?w=400&h=400&fit=crop", category: "appetizer" },
  { id: "5", name: "Okonomiyaki", price: 3, image: "https://images.unsplash.com/photo-1615361200141-f45040f367be?w=400&h=400&fit=crop", category: "appetizer" },
  { id: "6", name: "Pollo Karaage", price: 3, image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=400&fit=crop", category: "appetizer" },
  { id: "7", name: "Piel de Salmón", price: 3, image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400&h=400&fit=crop", category: "appetizer" },
  { id: "8", name: "Gyoza", price: 3, image: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&h=400&fit=crop", category: "appetizer" },
  { id: "9", name: "Tempura Maki Sushi", price: 4, image: "https://images.unsplash.com/photo-1617196034183-421b4917c92d?w=400&h=400&fit=crop", category: "cooked-sushi" },
  { id: "10", name: "Ensalada de Salmón", price: 5, image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=400&fit=crop", category: "salad" },
  { id: "11", name: "Sashimi de Salmón", price: 6, image: "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=400&h=400&fit=crop", category: "sashimi" },
  { id: "12", name: "Nigiri de Salmón", price: 4, image: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=400&h=400&fit=crop", category: "nigiri" },
]

// Datos de ejemplo para el dashboard
export const sampleOrders: OrderRecord[] = [
  { id: "ORD-001", items: [{ ...menuItems[0], quantity: 2 }, { ...menuItems[1], quantity: 1 }], subtotal: 7, tax: 0.7, discount: 0, total: 7.7, type: "para-llevar", date: "2026-02-19T10:30:00", paymentMethod: "efectivo" },
  { id: "ORD-002", items: [{ ...menuItems[8], quantity: 3 }], subtotal: 12, tax: 1.2, discount: 0, total: 13.2, type: "en-local", date: "2026-02-19T11:15:00", paymentMethod: "tarjeta" },
  { id: "ORD-003", items: [{ ...menuItems[10], quantity: 2 }, { ...menuItems[11], quantity: 2 }], subtotal: 20, tax: 2, discount: 0, total: 22, type: "en-local", date: "2026-02-19T12:00:00", paymentMethod: "tarjeta" },
  { id: "ORD-004", items: [{ ...menuItems[4], quantity: 1 }, { ...menuItems[5], quantity: 2 }], subtotal: 9, tax: 0.9, discount: 0, total: 9.9, type: "para-llevar", date: "2026-02-18T13:30:00", paymentMethod: "efectivo" },
  { id: "ORD-005", items: [{ ...menuItems[9], quantity: 1 }], subtotal: 5, tax: 0.5, discount: 0, total: 5.5, type: "en-local", date: "2026-02-18T14:00:00", paymentMethod: "transferencia" },
  { id: "ORD-006", items: [{ ...menuItems[2], quantity: 4 }, { ...menuItems[7], quantity: 2 }], subtotal: 14, tax: 1.4, discount: 0, total: 15.4, type: "para-llevar", date: "2026-02-17T10:00:00", paymentMethod: "efectivo" },
  { id: "ORD-007", items: [{ ...menuItems[3], quantity: 1 }, { ...menuItems[6], quantity: 1 }, { ...menuItems[10], quantity: 1 }], subtotal: 12, tax: 1.2, discount: 0, total: 13.2, type: "en-local", date: "2026-02-17T11:45:00", paymentMethod: "tarjeta" },
  { id: "ORD-008", items: [{ ...menuItems[0], quantity: 3 }], subtotal: 6, tax: 0.6, discount: 0, total: 6.6, type: "para-llevar", date: "2026-02-16T09:30:00", paymentMethod: "efectivo" },
  { id: "ORD-009", items: [{ ...menuItems[8], quantity: 2 }, { ...menuItems[11], quantity: 3 }], subtotal: 20, tax: 2, discount: 0, total: 22, type: "en-local", date: "2026-02-16T12:15:00", paymentMethod: "tarjeta" },
  { id: "ORD-010", items: [{ ...menuItems[1], quantity: 2 }, { ...menuItems[4], quantity: 1 }], subtotal: 9, tax: 0.9, discount: 0, total: 9.9, type: "para-llevar", date: "2026-02-15T15:00:00", paymentMethod: "transferencia" },
  { id: "ORD-011", items: [{ ...menuItems[5], quantity: 3 }, { ...menuItems[9], quantity: 1 }], subtotal: 14, tax: 1.4, discount: 0, total: 15.4, type: "en-local", date: "2026-02-15T16:30:00", paymentMethod: "tarjeta" },
  { id: "ORD-012", items: [{ ...menuItems[10], quantity: 4 }], subtotal: 24, tax: 2.4, discount: 0, total: 26.4, type: "en-local", date: "2026-02-14T13:00:00", paymentMethod: "tarjeta" },
  { id: "ORD-013", items: [{ ...menuItems[7], quantity: 5 }], subtotal: 15, tax: 1.5, discount: 0, total: 16.5, type: "para-llevar", date: "2026-02-14T18:00:00", paymentMethod: "efectivo" },
  { id: "ORD-014", items: [{ ...menuItems[2], quantity: 2 }, { ...menuItems[3], quantity: 2 }], subtotal: 10, tax: 1, discount: 0, total: 11, type: "en-local", date: "2026-02-13T11:00:00", paymentMethod: "tarjeta" },
  { id: "ORD-015", items: [{ ...menuItems[6], quantity: 3 }, { ...menuItems[0], quantity: 2 }], subtotal: 13, tax: 1.3, discount: 0, total: 14.3, type: "para-llevar", date: "2026-02-13T19:00:00", paymentMethod: "efectivo" },
]
