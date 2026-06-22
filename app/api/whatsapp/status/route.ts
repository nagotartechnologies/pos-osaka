import { NextResponse } from "next/server"
import { getStateInstance, isGreenApiConfigured } from "@/lib/greenapi"

export async function GET() {
  if (!isGreenApiConfigured()) {
    return NextResponse.json({ status: "not_configured" })
  }

  const state = await getStateInstance()
  return NextResponse.json({ status: state || "unknown" })
}
