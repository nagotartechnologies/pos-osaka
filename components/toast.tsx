"use client"

import { useEffect, useState, type ReactNode } from "react"
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react"

export interface ToastData {
  id: string
  message: string
  variant?: "success" | "error" | "warning" | "info"
  icon?: ReactNode
  duration?: number
}

interface ToastProps {
  toasts: ToastData[]
  onDismiss: (id: string) => void
}

const variantStyles = {
  success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  error: "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400",
  warning: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
  info: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
}

const variantIcons = {
  success: <CheckCircle2 className="h-4 w-4" />,
  error: <XCircle className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 200)
    }, toast.duration || 3000)
    return () => clearTimeout(timer)
  }, [toast.duration, onDismiss])

  const variant = toast.variant || "success"

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-200 ${variantStyles[variant]} ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      {toast.icon || variantIcons[variant]}
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      <button onClick={() => { setVisible(false); setTimeout(onDismiss, 200) }} className="opacity-50 hover:opacity-100 transition-opacity">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={() => onDismiss(t.id)} />
        </div>
      ))}
    </div>
  )
}

let toastCounter = 0
export function createToast(message: string, variant: ToastData["variant"] = "success", duration = 3000): ToastData {
  return { id: `toast-${++toastCounter}-${Date.now()}`, message, variant, duration }
}
