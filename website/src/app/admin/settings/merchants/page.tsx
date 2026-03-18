import { AdminLinks, AdminRoute } from "@/lib/routes/admin"
import Link from "next/link"
import { CreateResourceDialog } from "@/components/common/create-resource-dialog"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { isApiErrorResponse } from "@/lib/api/client"
import { listMerchants } from "@/lib/api/merchants"
import { requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"

type MerchantsPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
  }>
}

export default async function MerchantsPage({ searchParams }: MerchantsPageProps) {
  const params = (await searchParams) ?? {}
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const session = await requireAuth()
  const response = await listMerchants(session.accessToken, { page })
  const isError = isApiErrorResponse(response)
  const loading_error = isError ? response.message : null
  const rows = isError
    ? []
    : response.data.map((merchant) => ({
        ...merchant,
        href: AdminRoute.merchantDetails(merchant.merchant_id),
      }))
  const tableMeta = isError ? undefined : normalizeTableMeta(response.meta)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merchants"
        description="Manage merchant accounts, environments, and team access."
        actions={
          <CreateResourceDialog
            title="Create merchant"
            description="Create a new merchant workspace with an owner account."
            triggerLabel="New merchant"
            fields={[
              { name: "name", label: "Merchant name", required: true },
              {
                name: "email",
                label: "Owner email",
                type: "email",
                required: true,
              },
            ]}
          />
        }
      />
      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        searchKeys={["name", "primaryEmail"]}
        columns={[
          { key: "name", label: "Merchant" },
          { key: "primaryEmail", label: "Primary email" },
          { key: "status", label: "Status", type: "status" },
          { key: "memberCount", label: "Members" },
          { key: "environmentCount", label: "Environments" },
          { key: "createdAt", label: "Created" },
        ]}
        rowActions={[
          { label: "View", hrefKey: "href" },
          { label: "Edit" },
          { label: "Disable", variant: "destructive" },
        ]}
      />
      <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-4 py-3 text-sm">
        <div>
          Need bulk onboarding? Contact support for structured merchant imports.
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={AdminLinks.settings}>Contact support</Link>
        </Button>
      </div>
    </div>
  )
}
