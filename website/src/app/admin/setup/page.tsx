import { redirect } from "next/navigation"
import { AdminSetupWizard } from "@/components/settings/admin-setup-wizard"
import { requireAuth } from "@/lib/auth"
import { isMerchantSetupComplete } from "@/lib/merchant-setup"
import { AdminLinks } from "@/lib/routes/admin"

export default async function AdminSetupPage() {
  const session = await requireAuth()
  const merchant = session.selected_merchant


  if (!merchant?.merchant_id) {
    redirect(AdminLinks.settings)
  }

  if (isMerchantSetupComplete(merchant)) {
    redirect(AdminLinks.dashboard)
  }

  return (
    <AdminSetupWizard
      accessToken={session.accessToken}
      merchantId={merchant.merchant_id}
      merchantName={merchant.name ?? "your merchant"}
      initialTimezone={merchant.timezone ?? null}
      initialCountries={merchant.operating_countries ?? null}
      initialAutoCreateShipment={Boolean(
        merchant.allow_auto_shipment_creations_at_locations ??
          merchant.auto_create_shipment_on_dropoff
      )}
    />
  )
}
