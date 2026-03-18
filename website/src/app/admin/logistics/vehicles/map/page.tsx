import { PageHeader } from "@/components/layout/page-header"
import { VehiclesMapPageContent } from "@/components/vehicles/vehicles-map-page-content"
import { isApiErrorResponse } from "@/lib/api/client"
import { listVehicles } from "@/lib/api/vehicles"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"

export default async function VehiclesMapPage() {
  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session)
  const canLoad = session.user.role === "super_admin" || Boolean(merchantId)
  const response = canLoad
    ? await listVehicles(session.accessToken, {
        per_page: 100,
        page: 1,
        with_location_only: true,
        merchant_id: merchantId,
      })
    : null
  const isError = response ? isApiErrorResponse(response) : false
  const errorMessage =
    response && isApiErrorResponse(response) ? response.message : null
  const data = response && !isApiErrorResponse(response) ? response : null
  const loading_error = canLoad
    ? isError
      ? errorMessage
      : null
    : "Select a merchant to view vehicles."

  const vehicles = isError ? [] : data?.data ?? []
  const meta = isError ? undefined : data?.meta

  return (
    <div className="space-y-6 flex-1 ">
      <PageHeader
        title="Vehicles Map"
        description="View the real-time location of all vehicles in the fleet on an interactive map, allowing you to monitor their movements and optimize routes effectively."
      />
      <VehiclesMapPageContent
        accessToken={session.accessToken}
        merchantId={merchantId}
        initialVehicles={vehicles}
        initialMeta={meta}
        initialError={loading_error}
      />
    </div>
  )
}
