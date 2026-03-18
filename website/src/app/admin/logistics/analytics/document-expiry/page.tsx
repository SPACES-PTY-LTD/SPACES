import Link from "next/link"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDocumentExpiryReport } from "@/lib/api/reports"
import { isApiErrorResponse } from "@/lib/api/client"
import { requireAuth } from "@/lib/auth"
import { AdminLinks, AdminRoute, withAdminQuery } from "@/lib/routes/admin"
import { normalizeTableMeta } from "@/lib/table"

type PageProps = {
  searchParams?: Promise<{
    entity_type?: string
    status?: string
    page?: string
    sort_by?: string
    sort_dir?: string
  }>
}

type SortBy =
  | "merchant_name"
  | "entity_type"
  | "entity_label"
  | "file_type_name"
  | "original_name"
  | "uploaded_at"
  | "expires_at"
  | "days_to_expiry"

function entityDetailHref(entityType: string, entityId?: string | null): string | null {
  if (!entityId) return null
  if (entityType === "driver") return AdminRoute.driverDetails(entityId)
  if (entityType === "vehicle") return AdminRoute.vehicleDetails(entityId)
  if (entityType === "shipment") return AdminRoute.shipmentDetails(entityId)
  return null
}

function entityLabel(entityType: string): string {
  return entityType.charAt(0).toUpperCase() + entityType.slice(1)
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function daysLabel(days?: number | null): string {
  if (days === null || days === undefined) return "-"
  if (days < 0) return `${Math.abs(days)} days overdue`
  if (days === 0) return "Expires today"
  return `${days} days left`
}

function normalizeSortBy(value?: string): SortBy {
  if (
    value === "merchant_name" ||
    value === "entity_type" ||
    value === "entity_label" ||
    value === "file_type_name" ||
    value === "original_name" ||
    value === "uploaded_at" ||
    value === "expires_at" ||
    value === "days_to_expiry"
  ) {
    return value
  }
  return "expires_at"
}

function normalizeSortDir(value?: string): "asc" | "desc" {
  return value === "desc" ? "desc" : "asc"
}

export default async function DocumentExpiryReportPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {}
  const entityType =
    params.entity_type === "driver" || params.entity_type === "vehicle" || params.entity_type === "shipment"
      ? params.entity_type
      : undefined
  const status = params.status === "expired" || params.status === "expiring" ? params.status : undefined
  const page = Math.max(1, Number(params.page ?? "1") || 1)
  const sortBy = normalizeSortBy(params.sort_by)
  const sortDir = normalizeSortDir(params.sort_dir)

  const session = await requireAuth()
  const merchantId = session.selected_merchant?.merchant_id ?? undefined

  const response = await getDocumentExpiryReport(
    {
      merchant_id: merchantId,
      entity_type: entityType,
      status,
      expiring_in_days: 30,
      sort_by: sortBy,
      sort_dir: sortDir,
      page,
      per_page: 100,
    },
    session.accessToken
  )

  const rows = !isApiErrorResponse(response) ? response.data ?? [] : []
  const meta = !isApiErrorResponse(response) ? normalizeTableMeta(response.meta) : undefined

  const tableRows = rows.map((row) => ({
    ...row,
    merchantName: row.merchant_name,
    entityTypeLabel: entityLabel(row.entity_type),
    entryLabel: row.entity_label ?? row.entity_id ?? "-",
    entryHref: entityDetailHref(row.entity_type, row.entity_id) ?? "",
    fileName: row.original_name ?? "-",
    uploadedDisplay: formatDateTime(row.uploaded_at),
    expiresDisplay: formatDateTime(row.expires_at),
    statusDisplay: daysLabel(row.days_to_expiry),
  }))

  const expiredCount = rows.filter((row) => row.expiry_status === "expired").length
  const expiringCount = rows.filter((row) => row.expiry_status === "expiring").length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expired / Expiring Documents"
        description="Documents that are already expired or will expire soon."
      />

      <div className="flex flex-wrap gap-2">
        {[
          { label: "All", entityType: undefined, status: undefined },
          { label: "Expired", entityType, status: "expired" },
          { label: "Expiring (30d)", entityType, status: "expiring" },
        ].map((filter) => (
          <Link
            key={filter.label}
            href={withAdminQuery(AdminLinks.analyticsDocumentExpiry, {
              entity_type: filter.entityType,
              status: filter.status,
              page: 1,
            })}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              status === filter.status || (!status && !filter.status)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted/40"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Rows in result</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{Number(meta?.total ?? rows.length)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Expired on page</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{expiredCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Expiring on page</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{expiringCount}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Expiry List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={tableRows}
            meta={meta}
            emptyMessage="No expired or expiring documents found."
            enableSorting
            sortableColumns={[
              "merchantName",
              "entityTypeLabel",
              "entryLabel",
              "file_type_name",
              "fileName",
              "uploadedDisplay",
              "expiresDisplay",
              "statusDisplay",
            ]}
            sortKeyMap={{
              merchantName: "merchant_name",
              entityTypeLabel: "entity_type",
              entryLabel: "entity_label",
              file_type_name: "file_type_name",
              fileName: "original_name",
              uploadedDisplay: "uploaded_at",
              expiresDisplay: "expires_at",
              statusDisplay: "days_to_expiry",
            }}
            columns={[
              { key: "merchantName", label: "Merchant" },
              { key: "entityTypeLabel", label: "Entity type" },
              { key: "entryLabel", label: "Entry", link: "entryHref" },
              { key: "file_type_name", label: "Document type" },
              { key: "fileName", label: "File" },
              { key: "uploadedDisplay", label: "Uploaded" },
              { key: "expiresDisplay", label: "Expires" },
              { key: "statusDisplay", label: "Status" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
