"use client"

import { useRef } from "react"

/**
 * Hook para sonido de notificación (Web Audio API) y notificaciones nativas del navegador.
 * Sin archivos de audio externos.
 */
export function useNotificationSound() {
  const audioCtxRef = useRef<AudioContext | null>(null)

  const playNotificationSound = () => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === "suspended") ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = "sine"
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    } catch {}
  }

  const showNativeNotification = (title: string, body: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission !== "granted") {
      Notification.requestPermission()
      return
    }
    try {
      new Notification(title, {
        body,
        icon: "/icon-192.png",
        tag: "whatsapp-chat",
        requireInteraction: false,
      })
    } catch {}
  }

  return { playNotificationSound, showNativeNotification }
}
