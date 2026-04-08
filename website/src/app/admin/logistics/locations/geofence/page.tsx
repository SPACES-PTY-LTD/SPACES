import { PageHeader } from "@/components/layout/page-header"
import { LocationsGeofencePageContent } from "@/components/locations/locations-geofence-page-content"
import { isApiErrorResponse } from "@/lib/api/client"
import { listLocations } from "@/lib/api/locations"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"

export default async function LocationsGeofencePage() {
  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session) ?? session.selected_merchant?.merchant_id
  const canLoad = Boolean(merchantId)
  const response = canLoad
    ? await listLocations(session.accessToken, {
        merchant_id: merchantId,
        page: 1,
        per_page: 100,
        sort_by: "name",
        sort_dir: "asc",
      })
    : null
  const isError = response ? isApiErrorResponse(response) : false
  const errorMessage =
    response && isApiErrorResponse(response) ? response.message : null
  const data = response && !isApiErrorResponse(response) ? response : null
  const loadingError = canLoad
    ? isError
      ? errorMessage
      : null
    : "Select a merchant to view locations."

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-6">
      <PageHeader
        title="Location Geofences"
        description="Search locations, adjust geofence boundaries, and update location address details."
      />
      <LocationsGeofencePageContent
        accessToken={session.accessToken}
        merchantId={merchantId}
        initialLocations={data?.data ?? []}
        initialMeta={data?.meta}
        initialError={loadingError}
      />
    </div>
  )
}
