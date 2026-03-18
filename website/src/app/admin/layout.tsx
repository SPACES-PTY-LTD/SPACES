import { AdminShell } from "@/components/layout/admin-shell"
import { requireAuth } from "@/lib/auth"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuth()
  return <AdminShell session={session}>{children}</AdminShell>
}
