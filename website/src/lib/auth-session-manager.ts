"use client"

type SessionUpdatePayload = {
  accessToken?: string
  refreshToken?: string
  accessTokenExpiresAt?: number
  authError?: string
}

type SessionHandlers = {
  updateSession: (payload: SessionUpdatePayload) => Promise<unknown>
  logout: () => Promise<unknown>
}

let handlers: SessionHandlers | null = null
let accessToken: string | null = null
let refreshToken: string | null = null
let accessTokenExpiresAt: number | null = null

export function registerAuthSessionHandlers(nextHandlers: SessionHandlers | null) {
  handlers = nextHandlers
}

export function syncAuthTokens(tokens: {
  accessToken?: string | null
  refreshToken?: string | null
  accessTokenExpiresAt?: number | null
}) {
  accessToken = tokens.accessToken ?? null
  refreshToken = tokens.refreshToken ?? null
  accessTokenExpiresAt = tokens.accessTokenExpiresAt ?? null
}

export function getStoredAuthTokens() {
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
  }
}

export async function updateStoredSession(payload: SessionUpdatePayload) {
  if (typeof payload.accessToken !== "undefined") {
    accessToken = payload.accessToken ?? null
  }
  if (typeof payload.refreshToken !== "undefined") {
    refreshToken = payload.refreshToken ?? null
  }
  if (typeof payload.accessTokenExpiresAt !== "undefined") {
    accessTokenExpiresAt = payload.accessTokenExpiresAt ?? null
  }

  if (handlers) {
    await handlers.updateSession(payload)
  }
}

export async function logoutStoredSession() {
  accessToken = null
  refreshToken = null
  accessTokenExpiresAt = null

  if (handlers) {
    await handlers.logout()
  }
}
