import type { MenuItem } from "@/lib/store"

// Salsas de la carta pública. Compartido con /api/public/orders para que el
// servidor recalcule su precio (no se confía en el que manda el navegador).
export const SALSAS: MenuItem[] = [
  { id: "salsa-soya", name: "Salsa Soya", price: 0, image: "", category: "salsas" },
  { id: "salsa-agridulce", name: "Salsa Agridulce", price: 0, image: "", category: "salsas" },
  { id: "salsa-acevichada", name: "Salsa Acevichada", price: 500, image: "", category: "salsas" },
  { id: "salsa-teriyaki", name: "Salsa Teriyaki", price: 500, image: "", category: "salsas" },
]
