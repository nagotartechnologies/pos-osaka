"use client"

import Image from "next/image"
import { optimizeCloudinaryUrl } from "@/lib/cloudinary"
import { isNewProduct, type Product } from "@/lib/supabase-menu"

interface ProductCardProps {
  product: Product
  qty: number
  onAdd: (product: Product) => void
  onBuildCustom: (product: Product) => void
}

export function ProductCard({ product, qty, onAdd, onBuildCustom }: ProductCardProps) {
  return (
    <button
      className={`relative rounded-xl border bg-card overflow-hidden text-left transition-all active:scale-[0.97] ${
        qty > 0 ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
      }`}
      onClick={() => onAdd(product)}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-accent">
        <Image
          src={optimizeCloudinaryUrl(product.image, 300)}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          loading="lazy"
        />
        {isNewProduct(product.created_at) && (
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white shadow animate-pulse">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            Nuevo
          </div>
        )}
        {qty > 0 && (
          <div className="absolute top-1.5 right-1.5 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-black text-primary-foreground shadow">
            {qty}
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-semibold text-card-foreground truncate">{product.name}</p>
        {product.description && (
          <p className="text-[10px] text-muted-foreground line-clamp-1 leading-snug mt-0.5">{product.description}</p>
        )}
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs font-bold text-primary">$ {product.price.toLocaleString("es-CL")}</p>
          {product.allow_custom_build && (
            <span
              onClick={(e) => { e.stopPropagation(); onBuildCustom(product) }}
              className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-500/10 cursor-pointer hover:bg-amber-100 transition-colors"
            >
              🎨 A tu pinta
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
