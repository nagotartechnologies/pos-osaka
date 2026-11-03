import { NextRequest, NextResponse } from "next/server"
import { getStateInstance, getActiveProvider, isWhatsAppConfigured } from "@/lib/whatsapp"
import { verifyInternalRequest } from "@/lib/api-auth"

export async function GET(req: NextRequest) {
  const authError = await verifyInternalRequest(req)
  if (authError) return authError

  const provider = await getActiveProvider()

  if (!(await isWhatsAppConfigured(provider))) {
    return NextResponse.json({ status: "not_configured", provider })
  }

  const state = await getStateInstance(provider)
  return NextResponse.json({ status: state || "unknown", provider })
}
