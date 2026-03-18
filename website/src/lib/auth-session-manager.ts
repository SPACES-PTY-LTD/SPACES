"use client"

type SessionUpdatePayload = {
  accessToken?: string
  refreshToken?: string
  authError?: string
}

type SessionHandlers = {
  updateSession: (payload: SessionUpdatePayload) => Promise<unknown>
  logout: () => Promise<unknown>
}

let handlers: SessionHandlers | null = null
let accessToken: string | null = null
let refreshToken: string | null = null

export function registerAuthSessionHandlers(nextHandlers: SessionHandlers | null) {
  handlers = nextHandlers
}

export function syncAuthTokens(tokens: {
  accessToken?: string | null
  refreshToken?: string | null
}) {
  accessToken = tokens.accessToken ?? null
  refreshToken = tokens.refreshToken ?? null
}

export function getStoredAuthTokens() {
  return {
    accessToken,
    refreshToken,
  }
}

export async function updateStoredSession(payload: SessionUpdatePayload) {
  if (typeof payload.accessToken !== "undefined") {
    accessToken = payload.accessToken ?? null
  }
  if (typeof payload.refreshToken !== "undefined") {
    refreshToken = payload.refreshToken ?? null
  }

  if (handlers) {
    await handlers.updateSession(payload)
  }
}

export async function logoutStoredSession() {
  accessToken = null
  refreshToken = null

  if (handlers) {
    await handlers.logout()
  }
}
