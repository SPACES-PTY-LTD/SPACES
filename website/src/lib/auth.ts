import { AdminLinks } from "@/lib/routes/admin"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import type { Merchant, Role } from "@/lib/types"
import { authOptions } from "@/lib/nextauth"

export type Session = {
  accessToken: string
  refreshToken?: string
  authError?: string
  merchants?: Merchant[]
  selected_merchant?: Merchant
  user: {
    uuid?: string | null
    name: string
    email: string
    image?: string | null
    role: Role
  }
}

export async function getSession(): Promise<Session | null> {
  
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return null
  }
  
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    authError: session.authError,
    merchants: session.merchants ?? [],
    selected_merchant: session.selected_merchant,
    user: {
      uuid: session.user.uuid ?? null,
      name: session.user.name ?? "User",
      email: session.user.email ?? "",
      image: session.user.image ?? null,
      role: session.user?.role ?? "user",
    },
  }
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession()
  if (!session) {
    redirect("/auth/login?lg=1")
  }
  return session
}

export async function requireRole(roles: Role[]): Promise<Session> {
  const session = await requireAuth()
  if (!session.user.role || !roles.includes(session.user.role)) {
    redirect(AdminLinks.dashboard)
  }
  return session
}

export async function requireSuperAdmin(): Promise<Session> {
  return requireRole(["super_admin"])
}

export function getScopedMerchantId(session: Session): string | undefined {
  if (session.user.role === "super_admin") {
    return undefined
  }

  const selectedMerchantId = session.selected_merchant?.merchant_id?.trim()
  if (selectedMerchantId) {
    return selectedMerchantId
  }

  const fallbackMerchantId = session.merchants?.find((merchant) => merchant.merchant_id?.trim())
    ?.merchant_id

  return fallbackMerchantId?.trim() || undefined
}

export function canManageSelectedMerchantUsers(session: Session): boolean {
  if (session.user.role === "super_admin") {
    return true
  }

  return Boolean(session.selected_merchant?.access?.permissions.can_manage_users)
}

export async function requireMerchantUserManagement(): Promise<Session> {
  const session = await requireAuth()
  if (!canManageSelectedMerchantUsers(session)) {
    redirect(AdminLinks.settings)
  }
  return session
}
