import { PageHeader } from "@/components/layout/page-header"
import { MixTokenChecker } from "@/components/integrations/mix-token-checker"
import { requireAuth } from "@/lib/auth"

export default async function MixCheckPage() {
  const session = await requireAuth()
  const selectedMerchant = session.selected_merchant

  return (
    <div className="space-y-6">
      <PageHeader
        title="MiX Token Check"
        description="Inspect the MiX login response, token payload, and expiry details for the selected merchant integration."
      />
      <MixTokenChecker
        accessToken={session.accessToken}
        merchantId={selectedMerchant?.merchant_id ?? null}
        merchantName={selectedMerchant?.name ?? null}
      />
    </div>
  )
}
