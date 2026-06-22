"use client"

import type { Product } from "@/lib/supabase-menu"
import { ProductCard } from "./product-card"
import { Flame } from "lucide-react"

interface TopSellersProps {
  products: Product[]
  getCartQty: (id: string) => number
  onAdd: (product: Product) => void
  onBuildCustom: (product: Product) => void
}

export function TopSellers({ products, getCartQty, onAdd, onBuildCustom }: TopSellersProps) {
  if (products.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Flame className="h-4 w-4 text-orange-500" />
        <h2 className="text-sm font-bold text-foreground">Más vendidos</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            qty={getCartQty(product.id)}
            onAdd={onAdd}
            onBuildCustom={onBuildCustom}
          />
        ))}
      </div>
    </div>
  )
}
