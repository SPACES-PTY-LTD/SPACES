import Link from "next/link"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDocumentCoverageReport } from "@/lib/api/reports"
import { isApiErrorResponse } from "@/lib/api/client"
import { requireAuth } from "@/lib/auth"
import { AdminLinks, withAdminQuery } from "@/lib/routes/admin"
import { normalizeTableMeta } from "@/lib/table"

type PageProps = {
  searchParams?: Promise<{
    entity_type?: string
    page?: string
    sort_by?: string
    sort_dir?: string
  }>
}

type SortBy =
  | "merchant_name"
  | "entity_type"
  | "file_type_name"
  | "required_count"
  | "uploaded_count"
  | "missing_count"
  | "expired_count"
  | "compliance_percent"

function entityLabel(entityType: string): string {
  return entityType.charAt(0).toUpperCase() + entityType.slice(1)
}

function formatPercent(value?: number | null): string {
  if (value === null || value === undefined) return "-"
  return `${value.toFixed(1)}%`
}

function normalizeSortBy(value?: string): SortBy {
  if (
    value === "merchant_name" ||
    value === "entity_type" ||
    value === "file_type_name" ||
    value === "required_count" ||
    value === "uploaded_count" ||
    value === "missing_count" ||
    value === "expired_count" ||
    value === "compliance_percent"
  ) {
    return value
  }
  return "missing_count"
}

function normalizeSortDir(value?: string): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc"
}

export default async function DocumentCoveragePage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {}
  const entityType =
    params.entity_type === "driver" || params.entity_type === "vehicle" || params.entity_type === "shipment"
      ? params.entity_type
      : undefined
  const page = Math.max(1, Number(params.page ?? "1") || 1)
  const sortBy = normalizeSortBy(params.sort_by)
  const sortDir = normalizeSortDir(params.sort_dir)

  const session = await requireAuth()
  const merchantId = session.selected_merchant?.merchant_id ?? undefined

  const response = await getDocumentCoverageReport(
    {
      merchant_id: merchantId,
      entity_type: entityType,
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
    merchantName: row.merchant_name ?? "-",
    entityTypeLabel: entityLabel(row.entity_type),
    coverageDisplay: formatPercent(row.compliance_percent),
  }))

  const totalRequired = rows.reduce((sum, row) => sum + row.required_count, 0)
  const totalUploaded = rows.reduce((sum, row) => sum + row.uploaded_count, 0)
  const totalMissing = rows.reduce((sum, row) => sum + row.missing_count, 0)
  const totalExpired = rows.reduce((sum, row) => sum + row.expired_count, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload Coverage by Type"
        description="Coverage of uploaded documents per active file type."
      />

      <div className="flex flex-wrap gap-2">
        {[
          { label: "All", value: undefined },
          { label: "Drivers", value: "driver" },
          { label: "Vehicles", value: "vehicle" },
          { label: "Shipments", value: "shipment" },
        ].map((filter) => (
          <Link
            key={filter.label}
            href={withAdminQuery(AdminLinks.analyticsDocumentCoverage, {
              entity_type: filter.value,
              page: 1,
            })}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              entityType === filter.value || (!entityType && !filter.value)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted/40"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Required</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalRequired}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Uploaded</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalUploaded}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Missing</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalMissing}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Expired uploads</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalExpired}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coverage Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={tableRows}
            meta={meta}
            emptyMessage="No coverage rows found."
            enableSorting
            sortableColumns={[
              "merchantName",
              "entityTypeLabel",
              "file_type_name",
              "required_count",
              "uploaded_count",
              "missing_count",
              "expired_count",
              "coverageDisplay",
            ]}
            sortKeyMap={{
              merchantName: "merchant_name",
              entityTypeLabel: "entity_type",
              file_type_name: "file_type_name",
              required_count: "required_count",
              uploaded_count: "uploaded_count",
              missing_count: "missing_count",
              expired_count: "expired_count",
              coverageDisplay: "compliance_percent",
            }}
            columns={[
              { key: "merchantName", label: "Merchant" },
              { key: "entityTypeLabel", label: "Entity type" },
              { key: "file_type_name", label: "Document type" },
              { key: "required_count", label: "Required", className: "text-right" },
              { key: "uploaded_count", label: "Uploaded", className: "text-right" },
              { key: "missing_count", label: "Missing", className: "text-right" },
              { key: "expired_count", label: "Expired", className: "text-right" },
              { key: "coverageDisplay", label: "Coverage", className: "text-right" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
