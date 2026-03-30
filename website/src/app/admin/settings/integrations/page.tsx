import { PageHeader } from "@/components/layout/page-header"
import { TrackingProviders } from "@/components/integrations/tracking-providers"
import { requireAuth } from "@/lib/auth"

export default async function IntegrationsPage() {
  const session = await requireAuth()
  const selectedMerchant = session.selected_merchant
  const merchantId = selectedMerchant?.merchant_id ?? null

  return (
    <div className="space-y-6 flex-1 ">
      <PageHeader
        title="Integrations"
        description="Manage and configure integrations with third-party services to enhance the functionality of your platform."
      />
      <TrackingProviders
        accessToken={session.accessToken}
        merchantId={merchantId}
      />
    </div>
  )
}
