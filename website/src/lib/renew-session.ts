"use client"

import { getCsrfToken, getSession } from "next-auth/react"
import type { Session } from "next-auth"
import { logoutStoredSession, syncAuthTokens } from "@/lib/auth-session-manager"

let pending: Promise<string | null> | null = null

export function renewBrowserSession(force = false): Promise<string | null> {
  if (pending) return pending
  pending = renew(force).finally(() => { pending = null })
  return pending
}

async function renew(force: boolean): Promise<string | null> {
  try {
    // NextAuth owns rotation and writes its HttpOnly cookie before we retry APIs.
    let session: Session | null
    if (force) {
      const csrfToken = await getCsrfToken()
      if (!csrfToken) return null
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrfToken, data: { forceRefresh: true } }),
      })
      if (!response.ok) return null
      session = await response.json()
    } else {
      const response = await fetch("/api/auth/session", { cache: "no-store" })
      if (!response.ok) return null
      session = await response.json()
    }
    if (!session?.accessToken || session.authError === "RefreshAccessTokenError") {
      await logoutStoredSession()
      return null
    }
    if (session.authError) return null
    // Notify SessionProvider and other tabs only after the replacement cookie exists.
    const current = await getSession()
    if (current?.accessToken && !current.authError) session = current
    syncAuthTokens(session)
    return session.accessToken ?? null
  } catch {
    // Offline, throttled and unavailable services must not destroy the session.
    return null
  }
}
