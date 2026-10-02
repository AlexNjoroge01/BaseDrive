import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/lib/auth.config"

const { auth } = NextAuth(authConfig)

const PROTECTED = ["/drive", "/shared", "/recent", "/starred", "/trash"]
const AUTH_PAGES = ["/login", "/signup"]

/** Auth gating only. Every API route still checks permissions itself. */
export const proxy = auth((req) => {
  const { pathname, search } = req.nextUrl
  const signedIn = !!req.auth?.user

  if (!signedIn && PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const url = new URL("/login", req.nextUrl)
    url.searchParams.set("next", pathname + search)
    return NextResponse.redirect(url)
  }
  if (signedIn && (AUTH_PAGES.includes(pathname) || pathname === "/")) {
    return NextResponse.redirect(new URL("/drive", req.nextUrl))
  }
  if (!signedIn && pathname === "/") {
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }
  return NextResponse.next()
})

export const config = {
  matcher: ["/", "/login", "/signup", "/drive/:path*", "/shared", "/recent", "/starred", "/trash"],
}
