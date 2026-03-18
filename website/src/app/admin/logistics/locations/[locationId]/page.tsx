import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { LocationDetailContent } from "@/components/locations/location-detail-content"

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params
  const session = await requireAuth()

  return (
    <LocationDetailContent
      locationId={locationId}
      accessToken={session.accessToken}
      merchantId={getScopedMerchantId(session)}
    />
  )
}
