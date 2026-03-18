import { ErrorMessage } from "@/components/common/error-message"
import { PageHeader } from "@/components/layout/page-header"
import { RunsTrackingView } from "@/components/tracking/runs-tracking-view"
import { isApiErrorResponse } from "@/lib/api/client"
import { listRuns } from "@/lib/api/runs"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"

export default async function TrackingPage() {
  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session)
  const canLoad = session.user.role === "super_admin" || Boolean(merchantId)

  if (!canLoad) {
    return (
      <ErrorMessage
        title="Tracking"
        description="Monitor active runs, vehicle locations, and driver status."
        message="Select a merchant to view runs."
      />
    )
  }

  const response = await listRuns(session.accessToken, { merchant_id: merchantId })

  if (isApiErrorResponse(response)) {
    return (
      <ErrorMessage
        title="Tracking"
        description="Monitor active runs, vehicle locations, and driver status."
        message={response.message}
      />
    )
  }
  console.log("Runs response:", response)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tracking"
        description="Monitor active runs, vehicle locations, and driver status."
      />
      <RunsTrackingView
        runs={response.data ?? []}
        initialMeta={response.meta}
        accessToken={session.accessToken}
        merchantId={merchantId}
      />
    </div>
  )
}
