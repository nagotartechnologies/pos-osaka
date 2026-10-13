import { NextResponse } from "next/server"
import { getStateInstance, getActiveProvider, isWhatsAppConfigured } from "@/lib/whatsapp"

export async function GET() {
  const provider = await getActiveProvider()

  if (!(await isWhatsAppConfigured(provider))) {
    return NextResponse.json({ status: "not_configured", provider })
  }

  const state = await getStateInstance(provider)
  return NextResponse.json({ status: state || "unknown", provider })
}
