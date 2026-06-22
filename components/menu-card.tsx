"use client"

import Image from "next/image"
import { Minus, Plus } from "lucide-react"
import type { MenuItem } from "@/lib/store"

export function MenuCard({
  item,
  quantity,
  onAdd,
  onRemove,
}: {
  item: MenuItem
  quantity: number
  onAdd: () => void
  onRemove: () => void
}) {
  return (
    <div className="flex flex-col rounded-2xl bg-card p-3 shadow-sm border border-border hover:shadow-md transition-shadow">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-accent">
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <p className="text-sm font-semibold text-card-foreground leading-tight">{item.name}</p>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-card-foreground">
            $ {item.price}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onRemove}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              aria-label={`Remove one ${item.name}`}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-5 text-center text-sm font-semibold text-card-foreground">{quantity}</span>
            <button
              onClick={onAdd}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              aria-label={`Add one ${item.name}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
