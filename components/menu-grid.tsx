"use client"

import { MenuCard } from "./menu-card"
import type { MenuItem, CartItem } from "@/lib/store"

export function MenuGrid({
  items,
  cart,
  onAddToCart,
  onRemoveFromCart,
}: {
  items: MenuItem[]
  cart: CartItem[]
  onAddToCart: (item: MenuItem) => void
  onRemoveFromCart: (itemId: string) => void
}) {
  const getQuantity = (itemId: string) => {
    const cartItem = cart.find((c) => c.id === itemId)
    return cartItem?.quantity || 0
  }

  return (
    <div className="px-6 pb-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <MenuCard
            key={item.id}
            item={item}
            quantity={getQuantity(item.id)}
            onAdd={() => onAddToCart(item)}
            onRemove={() => onRemoveFromCart(item.id)}
          />
        ))}
      </div>
    </div>
  )
}
