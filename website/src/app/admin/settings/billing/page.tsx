import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { AdminBillingSettings } from "@/components/billing/admin-billing-settings"
import {
  listAdminBillingAccounts,
  listAdminBillingGateways,
  listAdminCountryPricing,
  listAdminPricingPlans,
} from "@/lib/api/billing"
import { isApiErrorResponse } from "@/lib/api/client"
import { requireSuperAdmin } from "@/lib/auth"

export default async function SettingsBillingPage() {
  const session = await requireSuperAdmin()
  const [gateways, countryPricing, plans, accounts] = await Promise.all([
    listAdminBillingGateways(session.accessToken),
    listAdminCountryPricing(session.accessToken),
    listAdminPricingPlans(session.accessToken),
    listAdminBillingAccounts(session.accessToken),
  ])

  const accountsData = isApiErrorResponse(accounts) ? accounts : accounts.data

  if (
    isApiErrorResponse(gateways) ||
    isApiErrorResponse(countryPricing) ||
    isApiErrorResponse(plans) ||
    isApiErrorResponse(accountsData)
  ) {
    const message =
      (isApiErrorResponse(gateways) && gateways.message) ||
      (isApiErrorResponse(countryPricing) && countryPricing.message) ||
      (isApiErrorResponse(plans) && plans.message) ||
      (isApiErrorResponse(accountsData) && accountsData.message) ||
      "Unable to load billing settings."

    return (
      <div className="space-y-6">
        <PageHeader title="Billing settings" description="Billing catalog, routing, plans, and account summaries." />
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{message}</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Billing settings" description="Billing catalog, routing, plans, and account summaries." />
      <AdminBillingSettings
        gateways={gateways}
        countryPricing={countryPricing}
        plans={plans}
        accounts={accountsData}
      />
    </div>
  )
}
