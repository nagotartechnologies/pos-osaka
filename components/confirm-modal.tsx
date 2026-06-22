"use client"

import { X, AlertTriangle, Loader2 } from "lucide-react"
import { type ReactNode } from "react"

interface ConfirmModalProps {
  open: boolean
  title: string
  description?: string | ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "warning" | "default"
  loading?: boolean
  icon?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  loading = false,
  icon,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null

  const colors = {
    danger: {
      iconBg: "bg-red-500/10",
      iconColor: "text-red-500 dark:text-red-400",
      button: "bg-red-500 hover:bg-red-600 text-white",
    },
    warning: {
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-500 dark:text-amber-400",
      button: "bg-amber-500 hover:bg-amber-600 text-white",
    },
    default: {
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      button: "bg-primary hover:bg-primary/90 text-primary-foreground",
    },
  }[variant]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl bg-card shadow-xl border border-border p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${colors.iconBg} mb-4`}>
            {icon || <AlertTriangle className={`h-6 w-6 ${colors.iconColor}`} />}
          </div>
          <h3 className="text-lg font-semibold text-card-foreground mb-1">{title}</h3>
          {description && (
            <div className="text-sm text-muted-foreground mb-6">{description}</div>
          )}
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-card-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${colors.button}`}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
