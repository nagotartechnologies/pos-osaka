"use client"

import { ShoppingBag, DollarSign, Clock } from "lucide-react"
import type { ClientContext } from "@/lib/supabase-orders"

interface ClientContextPanelProps {
  clientCtx: ClientContext | null
  clientPhone: string
}

export function ClientContextPanel({ clientCtx, clientPhone }: ClientContextPanelProps) {
  if (!clientPhone) return null

  return (
    <div className="border-b border-border bg-[#f0f2f5]/50 dark:bg-card/50 px-4 py-3 space-y-2 animate-in slide-in-from-top duration-200">
      {!clientCtx || clientCtx.totalOrders === 0 ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShoppingBag className="h-3.5 w-3.5" />
          <span className="text-xs">Sin historial de pedidos</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground">{clientCtx.totalOrders} pedidos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-semibold text-foreground">${clientCtx.totalSpent.toLocaleString("es-CL")}</span>
            </div>
            {clientCtx.lastOrderDate && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  {new Date(clientCtx.lastOrderDate).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                </span>
              </div>
            )}
          </div>
          {clientCtx.recentOrders.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Últimos pedidos</p>
              {clientCtx.recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-lg bg-background/50 px-2.5 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-foreground truncate">{o.items}</p>
                  </div>
                  <span className="text-[10px] font-bold text-foreground flex-shrink-0 ml-2">${o.total.toLocaleString("es-CL")}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
