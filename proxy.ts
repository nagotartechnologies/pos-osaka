import { NextResponse, type NextRequest } from "next/server"
import { getSession } from "@/lib/server/session"

const PUBLIC_PAGES = ["/login", "/carta"]
const ADMIN_ONLY = ["/dashboard", "/menu", "/inventario", "/finanzas", "/configuracion"]

const matches = (pathname: string, routes: string[]) =>
  routes.some((r) => pathname === r || pathname.startsWith(r + "/"))

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (matches(pathname, PUBLIC_PAGES)) return NextResponse.next()

  const session = await getSession(req)
  if (!session) return NextResponse.redirect(new URL("/login", req.url))
  if (session.role === "vendedor" && matches(pathname, ADMIN_ONLY)) {
    return NextResponse.redirect(new URL("/", req.url))
  }
  return NextResponse.next()
}

export const config = {
  // Las API routes validan su propia autorización; se excluyen assets estáticos.
  matcher: ["/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|js|json|txt|xml|webmanifest|woff2?)$).*)"],
}
