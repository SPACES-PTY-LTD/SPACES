"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DataTable } from "@/components/common/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isApiErrorResponse } from "@/lib/api/client"
import {
  chargeBillingInvoice,
  deleteBillingPaymentMethod,
  getBillingInvoice,
  setDefaultBillingPaymentMethod,
  setupBillingPaymentMethod,
  syncBillingPaymentMethods,
  updateMerchantBillingPlan,
} from "@/lib/api/billing"
import type { BillingInvoice, BillingSummary, PricingPlan } from "@/lib/types"
import type { TableMeta } from "@/lib/table"

export function AccountBillingDashboard({
  summary,
  plans,
  invoiceHistory,
  invoiceHistoryMeta,
  accessToken,
}: {
  summary: BillingSummary
  plans: PricingPlan[]
  invoiceHistory: BillingInvoice[]
  invoiceHistoryMeta?: TableMeta
  accessToken: string
}) {
  const router = useRouter()
  const [savingMerchantId, setSavingMerchantId] = useState<string | null>(null)
  const [chargingInvoiceId, setChargingInvoiceId] = useState<string | null>(null)
  const [syncingCards, setSyncingCards] = useState(false)
  const [preparingSetup, setPreparingSetup] = useState(false)
  const [selectedPlanIds, setSelectedPlanIds] = useState<Record<string, string | undefined>>({})
  const [pendingFreeDowngrade, setPendingFreeDowngrade] = useState<{
    merchantId: string
    planId: string
  } | null>(null)
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null)
  const [viewingInvoice, setViewingInvoice] = useState<BillingInvoice | null>(null)
  const [loadingInvoice, setLoadingInvoice] = useState(false)

  const refresh = () => router.refresh()

  useEffect(() => {
    setSelectedPlanIds(
      Object.fromEntries(
        summary.merchants.map((merchant) => [merchant.merchant_id, merchant.plan_id ?? undefined])
      )
    )
  }, [summary.merchants])

  const freePlan = useMemo(
    () => plans.find((plan) => plan.is_free),
    [plans]
  )
  const preview = summary.current_invoice_preview

  async function handleMerchantPlanChange(merchantId: string, planId: string) {
    setSavingMerchantId(merchantId)
    const response = await updateMerchantBillingPlan(merchantId, planId, accessToken)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to update merchant plan.")
      setSavingMerchantId(null)
      return
    }
    toast.success("Merchant plan updated.")
    setSavingMerchantId(null)
    refresh()
  }

  function handlePlanSelection(merchantId: string, planId: string) {
    const plan = plans.find((entry) => entry.plan_id === planId)

    setSelectedPlanIds((current) => ({
      ...current,
      [merchantId]: planId,
    }))

    if (plan?.is_free) {
      setPendingFreeDowngrade({ merchantId, planId })
      return
    }

    void handleMerchantPlanChange(merchantId, planId)
  }

  async function confirmFreeDowngrade() {
    if (!pendingFreeDowngrade) {
      return
    }

    await handleMerchantPlanChange(pendingFreeDowngrade.merchantId, pendingFreeDowngrade.planId)
    setPendingFreeDowngrade(null)
  }

  function cancelFreeDowngrade() {
    if (!pendingFreeDowngrade) {
      return
    }

    const merchant = summary.merchants.find(
      (entry) => entry.merchant_id === pendingFreeDowngrade.merchantId
    )

    setSelectedPlanIds((current) => ({
      ...current,
      [pendingFreeDowngrade.merchantId]: merchant?.plan_id ?? undefined,
    }))
    setPendingFreeDowngrade(null)
  }

  async function handlePrepareSetup() {
    setPreparingSetup(true)
    const response = await setupBillingPaymentMethod({}, accessToken)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to prepare payment method setup.")
      setPreparingSetup(false)
      return
    }

    if (response.redirect_url) {
      window.location.href = response.redirect_url
      return
    }

    if (response.client_secret) {
      toast.message("Gateway setup prepared.", {
        description: "Use the returned client secret in the hosted gateway capture flow. No card data is stored in our system.",
      })
    } else {
      toast.message("Gateway setup information ready.", {
        description: String(response.metadata?.message ?? "Complete card capture through the selected gateway."),
      })
    }
    setPreparingSetup(false)
  }

  async function handleSyncPaymentMethods() {
    setSyncingCards(true)
    const response = await syncBillingPaymentMethods({}, accessToken)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to sync payment methods.")
      setSyncingCards(false)
      return
    }
    toast.success(
      response.retrieved_from_gateway
        ? `Synced ${response.cards.length} saved card(s) from the gateway.`
        : `Refreshed ${response.cards.length} masked gateway-linked payment method(s).`
    )
    setSyncingCards(false)
    refresh()
  }

  async function handleSetDefault(paymentMethodId: string) {
    const response = await setDefaultBillingPaymentMethod(paymentMethodId, accessToken)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to update default payment method.")
      return
    }
    toast.success("Default payment method updated.")
    refresh()
  }

  async function handleDelete(paymentMethodId: string) {
    const response = await deleteBillingPaymentMethod(paymentMethodId, accessToken)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to delete payment method.")
      return
    }
    toast.success("Payment method removed.")
    refresh()
  }

  async function handleCharge(invoiceId: string) {
    setChargingInvoiceId(invoiceId)
    const response = await chargeBillingInvoice(invoiceId, accessToken)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to charge invoice.")
      setChargingInvoiceId(null)
      return
    }
    toast.success("Invoice charge attempted.")
    setChargingInvoiceId(null)
    refresh()
  }

  async function handleViewInvoice(invoiceId: string) {
    setInvoiceDialogOpen(true)
    setViewingInvoiceId(invoiceId)
    setLoadingInvoice(true)

    const response = await getBillingInvoice(invoiceId, accessToken)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to load invoice.")
      setLoadingInvoice(false)
      return
    }

    setViewingInvoice(response)
    setLoadingInvoice(false)
  }

  const invoiceHistoryRows = invoiceHistory.map((invoice) => ({
    invoice_id: invoice.invoice_id,
    invoice_number: invoice.invoice_number,
    billing_period_start: invoice.billing_period_start,
    billing_period_end: invoice.billing_period_end,
    payment_status: invoice.payment_status,
    total_label: `${invoice.currency} ${invoice.total.toFixed(2)}`,
  }))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Billing country</CardDescription>
            <CardTitle>{summary.country_code}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Currency</CardDescription>
            <CardTitle>{summary.currency}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Next billing date</CardDescription>
            <CardTitle>{summary.next_billing_date ?? "-"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gateway</CardDescription>
            <CardTitle>{summary.gateway.name ?? summary.gateway.code ?? "-"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Billing mode</CardDescription>
            <CardTitle>{summary.is_billing_exempt ? "Exempt" : "Billable"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Billing cycle</CardTitle>
          <CardDescription>
            Your current billing window and the next date on which a new invoice will be generated.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-sm text-muted-foreground">Current period start</div>
            <div className="font-medium">{summary.current_billing_period_start ?? "-"}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Current period end</div>
            <div className="font-medium">{summary.current_billing_period_end ?? "-"}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Next invoice date</div>
            <div className="font-medium">{summary.next_billing_date ?? "-"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Merchant plans</CardTitle>
          <CardDescription>
            Manage the billing plan for each merchant on this account.
            {!summary.can_select_free_plan && freePlan ? ` The free plan is only available until ${summary.free_plan_available_until ?? "the end of the trial window"}.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary.merchants.map((merchant) => (
            <div key={merchant.merchant_id} className="rounded-lg border p-4">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{merchant.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {merchant.active_vehicle_count} active vehicles, {merchant.extra_vehicle_count} extra vehicles
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div>{summary.currency} {merchant.monthly_charge.toFixed(2)} base</div>
                  <div className="text-muted-foreground">
                    {summary.currency} {merchant.extra_vehicle_total.toFixed(2)} overage
                  </div>
                </div>
              </div>
              <Select
                value={selectedPlanIds[merchant.merchant_id]}
                onValueChange={(value) => handlePlanSelection(merchant.merchant_id, value)}
                disabled={savingMerchantId === merchant.merchant_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.plan_id} value={plan.plan_id}>
                      {plan.title} ({plan.vehicle_limit} vehicles)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment methods</CardTitle>
          <CardDescription>
            Card capture happens only on the gateway side. Your billing country resolves this account to{" "}
            {summary.gateway.name ?? summary.gateway.code}, and we store masked metadata plus reusable provider references only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">Resolved gateway</div>
              <div className="text-sm text-muted-foreground">
                {summary.gateway.name ?? summary.gateway.code} based on billing country {summary.country_code}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleSyncPaymentMethods}
                disabled={syncingCards}
              >
                {syncingCards ? "Refreshing..." : "Refresh saved methods"}
              </Button>
              <Button
                onClick={handlePrepareSetup}
                disabled={preparingSetup || !summary.gateway_capabilities.supports_hosted_card_capture}
              >
                {preparingSetup ? "Preparing..." : "Add via gateway"}
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {summary.gateway_capabilities.supports_card_retrieval
              ? "This gateway can sync saved cards directly from the provider."
              : "This gateway does not expose a reliable saved-card list API. Saved methods shown here come from masked gateway authorization or token metadata only."}
          </div>

          <div className="space-y-3">
            {summary.payment_methods.length === 0 ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                No synced payment methods available.
              </div>
            ) : null}
            {summary.payment_methods.map((method) => (
              <div key={method.payment_method_id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">
                    {method.brand || method.payment_gateway?.name || method.gateway_code} {method.last_four ? `•••• ${method.last_four}` : ""}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {method.is_default ? "Default" : "Secondary"} • {method.status}
                    {method.retrieved_from_gateway ? " • Synced from gateway" : " • Masked metadata"}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!method.is_default ? (
                    <Button variant="outline" size="sm" onClick={() => handleSetDefault(method.payment_method_id)}>
                      Make default
                    </Button>
                  ) : null}
                  <Button variant="outline" size="sm" onClick={() => handleDelete(method.payment_method_id)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current invoice preview</CardTitle>
          <CardDescription>
            Preview of the invoice for the current billing period before the next invoice is generated.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm text-muted-foreground">Billing period</div>
              <div className="font-medium">
                {preview?.billing_period_start ?? "-"} to{" "}
                {preview?.billing_period_end ?? "-"}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Currency</div>
              <div className="font-medium">{preview?.currency ?? summary.currency}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Subtotal</div>
              <div className="font-medium">
                {preview?.currency ?? summary.currency} {preview ? preview.subtotal.toFixed(2) : "0.00"}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total</div>
              <div className="font-medium">
                {preview?.currency ?? summary.currency} {preview ? preview.total.toFixed(2) : "0.00"}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {preview?.lines.length ? (
              preview.lines.map((line, index) => (
                <div key={`${line.description}-${index}`} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">{line.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {line.merchant?.name ?? "Account"} • {line.quantity} x {preview.currency}{" "}
                        {line.unit_amount.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right font-medium">
                      {preview.currency} {line.subtotal.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                No billable merchant lines are available for this billing period yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Previous invoices</CardTitle>
          <CardDescription>View historical invoices for this account.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={invoiceHistoryRows}
            meta={invoiceHistoryMeta}
            columns={[
              {
                key: "invoice_number",
                label: "Invoice",
                customValue: (row) => (
                  <button
                    type="button"
                    className="font-medium text-left text-primary hover:underline"
                    onClick={() => void handleViewInvoice(String(row.invoice_id))}
                  >
                    {String(row.invoice_number)}
                  </button>
                ),
              },
              {
                key: "billing_period_start",
                label: "Period",
                customValue: (row) => `${String(row.billing_period_start)} to ${String(row.billing_period_end)}`,
              },
              { key: "payment_status", label: "Payment status", type: "status" },
              { key: "total_label", label: "Total" },
            ]}
            emptyMessage="No previous invoices found."
          />
        </CardContent>
      </Card>

      <Dialog open={pendingFreeDowngrade !== null} onOpenChange={(open) => (!open ? cancelFreeDowngrade() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm downgrade</DialogTitle>
            <DialogDescription>
              Are you sure you want to downgrade to the 1 car package, note the other vehicles data will be deleted from sour system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelFreeDowngrade}>
              Cancel
            </Button>
            <Button onClick={() => void confirmFreeDowngrade()}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={invoiceDialogOpen}
        onOpenChange={(open) => {
          setInvoiceDialogOpen(open)
          if (!open) {
            setViewingInvoiceId(null)
            setViewingInvoice(null)
            setLoadingInvoice(false)
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewingInvoice?.invoice_number ?? "Invoice details"}</DialogTitle>
            <DialogDescription>
              {viewingInvoice
                ? `${viewingInvoice.billing_period_start} to ${viewingInvoice.billing_period_end}`
                : "Review invoice lines, totals, and payment status."}
            </DialogDescription>
          </DialogHeader>

          {loadingInvoice ? (
            <div className="text-sm text-muted-foreground">Loading invoice...</div>
          ) : viewingInvoice ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <div className="text-sm text-muted-foreground">Payment status</div>
                  <div className="font-medium">{viewingInvoice.payment_status}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Invoice status</div>
                  <div className="font-medium">{viewingInvoice.invoice_status}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Due date</div>
                  <div className="font-medium">{viewingInvoice.due_date ?? "-"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="font-medium">
                    {viewingInvoice.currency} {viewingInvoice.total.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {viewingInvoice.lines?.map((line) => (
                  <div key={line.invoice_line_id ?? line.description} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium">{line.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {line.merchant?.name ?? "Account"} • {line.quantity} x {viewingInvoice.currency}{" "}
                          {line.unit_amount.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right font-medium">
                        {viewingInvoice.currency} {line.subtotal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {viewingInvoice.payment_status !== "paid" ? (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    disabled={chargingInvoiceId === viewingInvoice.invoice_id}
                    onClick={() => void handleCharge(viewingInvoice.invoice_id)}
                  >
                    {chargingInvoiceId === viewingInvoice.invoice_id ? "Charging..." : "Charge now"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {viewingInvoiceId ? "Unable to load invoice details." : "Select an invoice to view its details."}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
