import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const ADMIN_HOST = "app.spaces.za.com"

export function middleware(request: NextRequest) {
  const { hostname, pathname } = request.nextUrl

  const allowedPaths = [
    "/admin",
    "/api",
    "/invites",
    "/_next/static",
    "/_next/image",
    "/favicon.ico",
    "/sitemap.xml",
    "/robots.txt"
  ]

  console.log(`Middleware: Hostname - ${hostname}, Pathname - ${pathname}`);

  if (hostname !== ADMIN_HOST || allowedPaths.some(path => pathname.startsWith(path))) {
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
