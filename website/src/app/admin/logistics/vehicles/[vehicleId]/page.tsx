import { VehicleDetailContent } from "@/components/vehicles/vehicle-detail-content"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"

export default async function VehicleDetailPage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params
  const session = await requireAuth()
  return <VehicleDetailContent vehicleId={vehicleId} accessToken={session.accessToken} merchantId={getScopedMerchantId(session)} />
}
