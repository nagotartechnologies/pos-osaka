"use client"

import { Check, ImageIcon } from "lucide-react"
import type { ChatMessage } from "@/lib/supabase-chat"

interface MessageBubbleProps {
  msg: ChatMessage
  onImageClick: (url: string) => void
}

function renderMessage(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer"
        className="underline underline-offset-2 opacity-90 hover:opacity-100 break-all">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
}

export function MessageBubble({ msg, onImageClick }: MessageBubbleProps) {
  const isOut = msg.direction === "outgoing"

  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[80%] rounded-lg px-3 py-1.5 shadow-sm ${
          isOut
            ? "bg-[#d9fdd3] dark:bg-emerald-800/60 text-foreground rounded-tr-none"
            : "bg-card border border-border text-card-foreground rounded-tl-none"
        } ${msg.type === "status" ? "italic opacity-80" : ""}`}
      >
        {/* Image */}
        {msg.type === "image" && msg.media_url ? (
          <div className="mb-1 cursor-pointer" onClick={() => onImageClick(msg.media_url!)}>
            <img
              src={msg.media_url}
              alt="Imagen"
              className="rounded-lg max-w-full max-h-64 object-cover hover:opacity-90 transition-opacity"
              loading="lazy"
            />
          </div>
        ) : null}
        {msg.type === "image" && !msg.media_url ? (
          <div className="flex items-center gap-2 mb-1 opacity-60">
            <ImageIcon className="h-4 w-4" />
            <span className="text-xs">Imagen no disponible</span>
          </div>
        ) : null}

        {/* Audio */}
        {msg.type === "audio" && msg.media_url ? (
          <audio controls preload="none" className="max-w-[240px] h-8 mb-1">
            <source src={msg.media_url} type="audio/ogg" />
            <source src={msg.media_url} type="audio/mpeg" />
          </audio>
        ) : msg.type === "audio" && !msg.media_url ? (
          <div className="flex items-center gap-2 mb-1 opacity-60">
            <span className="text-xs">🎤 Audio no disponible</span>
          </div>
        ) : null}

        {/* Text */}
        {msg.type !== "audio" || !msg.media_url ? (
          <p className="text-[13px] whitespace-pre-wrap break-words leading-relaxed">{renderMessage(msg.message)}</p>
        ) : null}

        {/* Timestamp + check */}
        <div className={`flex items-center justify-end gap-1 mt-0.5 ${
          isOut ? "text-muted-foreground/60" : "text-muted-foreground/50"
        }`}>
          <span className="text-[10px]">{formatTime(msg.created_at)}</span>
          {isOut && <Check className="h-3 w-3" />}
        </div>
      </div>
    </div>
  )
}

/** Date separator between messages */
export function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center my-3">
      <span className="rounded-lg bg-card/90 border border-border/50 px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
        {date}
      </span>
    </div>
  )
}
