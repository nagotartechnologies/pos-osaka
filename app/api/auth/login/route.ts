import { NextRequest, NextResponse } from "next/server"
import { createSessionValue, sessionCookieOptions, signSupabaseJwt, SESSION_COOKIE } from "@/lib/server/session"
import { PIN_REGEX, resolveRoleForPin, isRateLimited, registerFailure, clearFailures, clientIp } from "@/lib/server/pin"

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers)
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 })
  }

  const { pin } = await req.json().catch(() => ({ pin: "" }))
  if (typeof pin !== "string" || !PIN_REGEX.test(pin)) {
    registerFailure(ip)
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 })
  }

  const role = await resolveRoleForPin(pin)
  if (!role) {
    registerFailure(ip)
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 })
  }
  clearFailures(ip)

  const session = await createSessionValue(role)
  const jwt = await signSupabaseJwt({ role, exp: session.exp })
  const res = NextResponse.json({ role, token: jwt?.token ?? null, exp: jwt?.exp ?? null, sessionExp: session.exp })
  res.cookies.set(SESSION_COOKIE, session.value, sessionCookieOptions(session.exp))
  return res
}
