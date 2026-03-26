"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { BillingSummary, CountryPricing, PaymentGateway, PricingPlan } from "@/lib/types"

export function AdminBillingSettings({
  gateways,
  countryPricing,
  plans,
  accounts,
}: {
  gateways: PaymentGateway[]
  countryPricing: CountryPricing[]
  plans: PricingPlan[]
  accounts: BillingSummary[]
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment gateways</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {gateways.map((gateway) => (
            <div key={gateway.payment_gateway_id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span>{gateway.name}</span>
              <span className="text-muted-foreground">{gateway.code}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Country pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {countryPricing.map((row) => (
            <div key={row.country_pricing_id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span>
                {row.country_name} ({row.country_code})
              </span>
              <span className="text-muted-foreground">
                {row.currency} via {row.payment_gateway?.name ?? "-"}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing plans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {plans.map((plan) => (
            <div key={plan.plan_id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span>{plan.title}</span>
              <span className="text-muted-foreground">
                {plan.vehicle_limit} vehicles • ZAR {plan.monthly_charge_zar.toFixed(2)} / USD {plan.monthly_charge_usd.toFixed(2)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accounts overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {accounts.map((account) => (
            <div key={account.account_id} className="rounded-lg border p-3 text-sm">
              <div className="font-medium">{account.owner?.name || account.owner?.email || account.account_id}</div>
              <div className="text-muted-foreground">
                {account.country_code} • {account.currency} • {account.gateway.name ?? account.gateway.code ?? "-"}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
