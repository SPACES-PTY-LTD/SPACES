import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const ADMIN_HOST = "app.spaces.za.com"

export function middleware(request: NextRequest) {
  const { hostname, pathname } = request.nextUrl

  if (hostname !== ADMIN_HOST || pathname.startsWith("/admin")) {
    return NextResponse.next()
  }

  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = "/admin"
  redirectUrl.search = ""

  return NextResponse.redirect(redirectUrl)
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}
