import { PageHeader } from "@/components/layout/page-header"
import { PowerfleetAuthenticationChecker } from "@/components/integrations/mix-token-checker"
import { requireAuth } from "@/lib/auth"

export default async function PowerfleetAuthenticationCheckPage() {
  const session = await requireAuth()
  const selectedMerchant = session.selected_merchant

  return (
    <div className="space-y-6">
      <PageHeader
        title="Powerfleet Authentication Check"
        description="Inspect the Powerfleet login response, token payload, and expiry details for the selected merchant integration."
      />
      <PowerfleetAuthenticationChecker
        accessToken={session.accessToken}
        merchantId={selectedMerchant?.merchant_id ?? null}
        merchantName={selectedMerchant?.name ?? null}
      />
    </div>
  )
}
