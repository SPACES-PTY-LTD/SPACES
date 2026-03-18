"use client"

import * as React from "react"
import { SessionProvider, signOut, useSession } from "next-auth/react"
import {
  logoutStoredSession,
  registerAuthSessionHandlers,
  syncAuthTokens,
} from "@/lib/auth-session-manager"

function AuthSessionBridge() {
  const { data: session, update, status } = useSession()

  React.useEffect(() => {
    registerAuthSessionHandlers({
      updateSession: update,
      logout: () => signOut({ callbackUrl: "/auth/login" }),
    })

    return () => registerAuthSessionHandlers(null)
  }, [update])

  React.useEffect(() => {
    syncAuthTokens({
      accessToken: session?.accessToken,
      refreshToken: session?.refreshToken,
    })
  }, [session?.accessToken, session?.refreshToken])

  React.useEffect(() => {
    if (status !== "authenticated") return
    if (!session?.authError) return

    void logoutStoredSession()
  }, [session?.authError, status])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthSessionBridge />
      {children}
    </SessionProvider>
  )
}
