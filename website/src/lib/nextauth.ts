import type { NextAuthOptions } from "next-auth"
import type { JWT } from "next-auth/jwt"
import CredentialsProvider from "next-auth/providers/credentials"
import type { LoginResponse, Merchant } from "@/lib/types"
import { createMerchant, getCurrentUserProfile, listMerchants } from "@/lib/api/merchants"
import { isApiErrorResponse } from "@/lib/api/client"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.example.com"

const ACCESS_TOKEN_REFRESH_BUFFER_MS = 30 * 1000
const DEFAULT_ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000

type AuthPayload = LoginResponse & {
  expires_in?: number
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    return {
      ...token,
      authError: "RefreshAccessTokenError",
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: token.refreshToken,
      }),
    })

    if (!response.ok) {
      return {
        ...token,
        authError: "RefreshAccessTokenError",
      }
    }

    const payload = (await response.json()) as { data?: AuthPayload }
    const auth = payload.data

    if (!auth?.token) {
      return {
        ...token,
        authError: "RefreshAccessTokenError",
      }
    }

    return {
      ...token,
      accessToken: auth.token,
      refreshToken: auth.refresh_token ?? token.refreshToken,
      accessTokenExpiresAt:
        Date.now() + (auth.expires_in ?? DEFAULT_ACCESS_TOKEN_TTL_MS / 1000) * 1000,
      authError: undefined,
    }
  } catch {
    return {
      ...token,
      authError: "RefreshAccessTokenError",
    }
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        login_context: { label: "Login Context", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null
        }

        const loginContext = credentials.login_context ?? "admin"

        const loginUrl = `${API_BASE_URL}/api/v1/auth/login`
        const response = await fetch(loginUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
            login_context: loginContext,
          }),
        })

        
        if (!response.ok) {
          await response.text().catch(() => "")
          // console.log("Auth login failed", {
          //   url: loginUrl,
          //   payload: { email: credentials.email, password: credentials.password },
          //   status: response.status,
          //   statusText: response.statusText,
          //   body: errorText,
          // })
          return null
        }

        const data = (await response.json()).data as AuthPayload
        if (!data?.user?.role || !["user", "super_admin"].includes(data.user.role)) {
          return null
        }

        return {
          id: data.user.user_id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          accessToken: data.token,
          refreshToken: data.refresh_token,
          accessTokenExpiresAt:
            Date.now() + (data.expires_in ?? DEFAULT_ACCESS_TOKEN_TTL_MS / 1000) * 1000,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session) {
        if ("accessToken" in session) {
          token.accessToken = session.accessToken
        }
        if ("refreshToken" in session) {
          token.refreshToken = session.refreshToken
        }
        if ("authError" in session) {
          token.authError = session.authError
        }
        if (session.merchants) {
          token.merchants = session.merchants
          token.merchantsLoaded = true
        }
        if (session.selected_merchant) {
          token.selected_merchant = session.selected_merchant
          token.lastAccessedMerchantId = session.selected_merchant.merchant_id
        }
      }

      if (user) {
        token.userId = user.id
        token.role = (user as { role?: string }).role
        token.accessToken = (user as { accessToken?: string }).accessToken
        token.refreshToken = (user as { refreshToken?: string }).refreshToken
        token.accessTokenExpiresAt = (
          user as { accessTokenExpiresAt?: number }
        ).accessTokenExpiresAt
        token.authError = undefined
        token.merchantsLoaded = false
      }

      if (
        token.accessToken &&
        token.accessTokenExpiresAt &&
        Date.now() >= Number(token.accessTokenExpiresAt) - ACCESS_TOKEN_REFRESH_BUFFER_MS
      ) {
        token = await refreshAccessToken(token)
      }

      const isUserRole = token.role === "user"
      if (isUserRole && token.accessToken && !token.merchantsLoaded) {
        try {
          const [profileResponse, response] = await Promise.all([
            getCurrentUserProfile(String(token.accessToken)),
            listMerchants(String(token.accessToken), { per_page: 100 }),
          ])

          if (isApiErrorResponse(response)) {
            console.error("Failed to load merchants for session", response.message)
            return token
          }

          const persistedMerchantId = isApiErrorResponse(profileResponse)
            ? undefined
            : profileResponse.last_accessed_merchant_id ?? undefined

          token.lastAccessedMerchantId = persistedMerchantId

          let merchants = response.data
          if (merchants.length === 0) {
            const created = await createMerchant(
              { name: "Main" },
              String(token.accessToken)
            )
            if (isApiErrorResponse(created)) {
              console.error("Failed to create default merchant", created.message)
              return token
            }
            merchants = [created]
          }

          const existingSelection = (token.selected_merchant as Merchant | undefined)
          const selected =
            merchants.find(
              (merchant) =>
                merchant.merchant_id === existingSelection?.merchant_id
            ) ??
            merchants.find(
              (merchant) =>
                merchant.merchant_id === token.lastAccessedMerchantId
            ) ?? merchants[0]
          
            // console.log("!!!!!!!!!!!!!!Loaded merchants for session", { merchants, selected })
          token.merchants = merchants
          token.selected_merchant = selected
          token.merchantsLoaded = true
        } catch (error) {
          console.error("Failed to load merchants for session", error)
        }
      }

      return token
    },
    async session({ session, token }) {
      session.user.uuid = (token.userId as string | undefined) ?? null
      session.user.role = token.role as "super_admin" | "user"
      session.accessToken = token.accessToken as string
      session.refreshToken = token.refreshToken as string
      session.merchants = (token.merchants as Merchant[]) ?? []
      session.selected_merchant = token.selected_merchant as Merchant | undefined
      session.authError = token.authError as string | undefined
      return session
    },
  },
  pages: {
    signIn: "/auth/login",
  },
}
