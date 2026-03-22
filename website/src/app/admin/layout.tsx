import { AdminShell } from "@/components/layout/admin-shell"
import { requireRole } from "@/lib/auth"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireRole(["user", "super_admin"])
  return <AdminShell session={session}>{children}</AdminShell>
}
