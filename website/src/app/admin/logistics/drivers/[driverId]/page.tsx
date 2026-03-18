import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { DriverDetailContent } from "@/components/drivers/driver-detail-content"

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ driverId: string }>
}) {
  const { driverId } = await params
  const session = await requireAuth()

  return (
    <DriverDetailContent
      driverId={driverId}
      accessToken={session.accessToken}
      merchantId={getScopedMerchantId(session)}
    />
  )
}
