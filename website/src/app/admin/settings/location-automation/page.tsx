import { LocationAutomationManager } from "@/components/settings/location-automation-manager"
import { requireAuth } from "@/lib/auth"

export default async function LocationAutomationPage() {
  const session = await requireAuth()

  return (
    <LocationAutomationManager
      accessToken={session.accessToken}
      merchantId={session.selected_merchant?.merchant_id ?? null}
      enabled={Boolean(session.selected_merchant?.allow_auto_shipment_creations_at_locations)}
    />
  )
}
