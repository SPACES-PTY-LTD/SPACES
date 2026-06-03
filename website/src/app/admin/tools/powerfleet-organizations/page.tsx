import { PageHeader } from "@/components/layout/page-header"
import { PowerfleetOrganizationsExplorer } from "@/components/integrations/powerfleet-organizations-explorer"
import { requireAuth } from "@/lib/auth"

export default async function PowerfleetOrganizationsPage() {
  const session = await requireAuth()
  const selectedMerchant = session.selected_merchant

  return (
    <div className="space-y-6">
      <PageHeader
        title="Available Powerfleet Organizations"
        description="Browse the organizations and subgroups available to the selected merchant's Powerfleet credentials."
      />
      <PowerfleetOrganizationsExplorer
        accessToken={session.accessToken}
        merchantId={selectedMerchant?.merchant_id ?? null}
        merchantName={selectedMerchant?.name ?? null}
      />
    </div>
  )
}
