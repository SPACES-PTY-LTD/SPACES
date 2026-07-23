import { PageHeader } from "@/components/layout/page-header"
import { AutorunTestTool } from "@/components/tools/autorun-test-tool"
import { requireRole } from "@/lib/auth"

export default async function AutorunTestPage() {
  const session = await requireRole(["user", "super_admin"])
  const merchant = session.selected_merchant

  return (
    <div className="space-y-6">
      <PageHeader
        title="Autorun Lifecycle Test"
        description="Manually process a truck position through the real Autorun lifecycle and inspect the resulting activity."
      />
      <AutorunTestTool
        accessToken={session.accessToken}
        merchantId={merchant?.merchant_id ?? null}
        merchantName={merchant?.name ?? null}
      />
    </div>
  )
}
