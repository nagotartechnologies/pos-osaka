"use client"

import { useState, useEffect, useMemo } from "react"
import { categories as defaultCategories, menuItems } from "@/lib/store"
import { loadCategories } from "@/lib/config-store"

export function CategoryFilter({
  selectedCategory,
  onSelectCategory,
}: {
  selectedCategory: string
  onSelectCategory: (id: string) => void
}) {
  const [customCats, setCustomCats] = useState<{ id: string; name: string }[] | null>(null)

  useEffect(() => {
    const saved = loadCategories()
    if (saved && saved.length > 0) setCustomCats(saved)
  }, [])

  // Polling para detectar cambios desde /menu
  useEffect(() => {
    const interval = setInterval(() => {
      const saved = loadCategories()
      if (saved) setCustomCats(saved)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const categories = useMemo(() => {
    const allCat = defaultCategories.find((c) => c.id === "all")
    const source = customCats || defaultCategories.filter((c) => c.id !== "all")
    const cats = source.map((c) => ({
      id: c.id,
      name: c.name,
      itemCount: menuItems.filter((i) => i.category === c.id).length,
    }))
    return allCat ? [{ id: allCat.id, name: allCat.name, itemCount: menuItems.length }, ...cats] : cats
  }, [customCats])

  return (
    <div className="px-6 py-4">
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category.id)}
            className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 min-w-fit whitespace-nowrap transition-all ${
              selectedCategory === category.id
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-transparent bg-card hover:border-border"
            }`}
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
              selectedCategory === category.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}>
              {category.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-left">
              <p
                className={`text-xs font-semibold ${
                  selectedCategory === category.id ? "text-primary" : "text-card-foreground"
                }`}
              >
                {category.name}
              </p>
              <p className="text-[10px] text-muted-foreground">{category.itemCount} items</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
