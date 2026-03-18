import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { ShipmentDetailContent } from "@/components/shipments/shipment-detail-content"

export default async function ShipmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ shipmentId: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { shipmentId } = await params
  const resolvedSearchParams = (await searchParams) ?? {}
  const session = await requireAuth()
  const requestedTab = Array.isArray(resolvedSearchParams.tab)
    ? resolvedSearchParams.tab[0]
    : resolvedSearchParams.tab

  return (
    <ShipmentDetailContent
      shipmentId={shipmentId}
      accessToken={session.accessToken}
      merchantId={getScopedMerchantId(session)}
      defaultTab={requestedTab}
    />
  )
}
