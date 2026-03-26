import type { Merchant } from "@/lib/types"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    refreshToken?: string
    authError?: string
    merchants?: Merchant[]
    selected_merchant?: Merchant
    user: {
      uuid?: string | null
      name?: string | null
      email?: string | null
      image?: string | null
      role?: "super_admin" | "user"
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    authError?: string
    userId?: string
    role?: string
    image?: string | null
    merchants?: Merchant[]
    selected_merchant?: Merchant
    lastAccessedMerchantId?: string
    merchantsLoaded?: boolean
    accessTokenExpiresAt?: number
  }
}
