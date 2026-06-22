"use client"

import { Search } from "lucide-react"
import type { Product } from "@/lib/supabase-menu"
import { ProductCard } from "./product-card"
import { TopSellers } from "./top-sellers"

interface ProductGridProps {
  products: Product[]
  filtered: Product[]
  topSellers: Product[]
  categories: { id: string; name: string }[]
  search: string
  setSearch: (v: string) => void
  selectedCat: string
  setSelectedCat: (v: string) => void
  getCartQty: (id: string) => number
  onAdd: (product: Product) => void
  onBuildCustom: (product: Product) => void
  loading: boolean
}

export function ProductGrid({
  filtered,
  topSellers,
  categories,
  search,
  setSearch,
  selectedCat,
  setSelectedCat,
  getCartQty,
  onAdd,
  onBuildCustom,
  loading,
}: ProductGridProps) {
  const showTopSellers = selectedCat === "all" && !search

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-2.5 border border-border">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="px-4 pb-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
          <button
            onClick={() => setSelectedCat("all")}
            className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              selectedCat === "all"
                ? "bg-foreground text-background"
                : "bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            Todo
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                selectedCat === cat.id
                  ? "bg-foreground text-background"
                  : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="aspect-[4/3] w-full bg-accent animate-pulse" />
                <div className="p-2 space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-accent animate-pulse" />
                  <div className="h-3 w-1/3 rounded bg-accent animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {showTopSellers && (
              <TopSellers
                products={topSellers}
                getCartQty={getCartQty}
                onAdd={onAdd}
                onBuildCustom={onBuildCustom}
              />
            )}

            {showTopSellers && filtered.length > 0 && (
              <div className="flex items-center gap-2 mb-3 px-1">
                <h2 className="text-sm font-bold text-foreground">Todos los productos</h2>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  qty={getCartQty(product.id)}
                  onAdd={onAdd}
                  onBuildCustom={onBuildCustom}
                />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-16">
                <p className="text-3xl mb-2">🍣</p>
                <p className="text-sm text-muted-foreground">No se encontraron productos</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
