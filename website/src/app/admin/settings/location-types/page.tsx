import { LocationTypesManager } from "@/components/settings/location-types-manager"
import { requireAuth } from "@/lib/auth"

export default async function LocationTypesPage() {
  const session = await requireAuth()

  return (
    <LocationTypesManager
      accessToken={session.accessToken}
      merchantId={session.selected_merchant?.merchant_id ?? null}
    />
  )
}
