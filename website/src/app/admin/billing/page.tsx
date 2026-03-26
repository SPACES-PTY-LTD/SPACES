import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { AccountBillingDashboard } from "@/components/billing/account-billing-dashboard"
import { getBillingSummary, listBillingInvoices, listBillingPlans } from "@/lib/api/billing"
import { isApiErrorResponse } from "@/lib/api/client"
import { requireAuth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AdminLinks } from "@/lib/routes/admin"
import { normalizeTableMeta } from "@/lib/table"

type BillingPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
  }>
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = (await searchParams) ?? {}
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const session = await requireAuth()
  if (session.user.role === "super_admin") {
    redirect(AdminLinks.settingsBilling)
  }
  const summary = await getBillingSummary(session.accessToken)
  const plans = await listBillingPlans(session.accessToken)
  const invoices = await listBillingInvoices(session.accessToken, { page, per_page: 10 })

  if (isApiErrorResponse(summary) || isApiErrorResponse(plans) || isApiErrorResponse(invoices)) {
    const message =
      (isApiErrorResponse(summary) && summary.message) ||
      (isApiErrorResponse(plans) && plans.message) ||
      (isApiErrorResponse(invoices) && invoices.message) ||
      "Unable to load billing."

    return (
      <div className="space-y-6">
        <PageHeader title="Billing" description="Account billing, invoices, and payment methods." />
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{message}</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Account billing, invoices, merchant plans, and payment methods." />
      <AccountBillingDashboard
        summary={summary}
        plans={plans}
        invoiceHistory={invoices.data}
        invoiceHistoryMeta={normalizeTableMeta(invoices.meta)}
        accessToken={session.accessToken}
      />
    </div>
  )
}
