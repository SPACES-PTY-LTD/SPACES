import { requireSuperAdmin } from "@/lib/auth"

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireSuperAdmin()
  return <>{children}</>
}
