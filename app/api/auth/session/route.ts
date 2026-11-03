import { NextRequest, NextResponse } from "next/server"
import { getSession, signSupabaseJwt } from "@/lib/server/session"

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const jwt = await signSupabaseJwt(session)
  return NextResponse.json(
    { role: session.role, token: jwt?.token ?? null, exp: jwt?.exp ?? null, sessionExp: session.exp },
    { headers: { "Cache-Control": "no-store" } },
  )
}
