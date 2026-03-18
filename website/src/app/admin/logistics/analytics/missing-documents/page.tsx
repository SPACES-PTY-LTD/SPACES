import Link from "next/link"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMissingDocumentsReport } from "@/lib/api/reports"
import { isApiErrorResponse } from "@/lib/api/client"
import { requireAuth } from "@/lib/auth"
import { AdminLinks, AdminRoute, withAdminQuery } from "@/lib/routes/admin"
import { normalizeTableMeta } from "@/lib/table"

type PageProps = {
  searchParams?: Promise<{
    entity_type?: string
    page?: string
    sort_by?: string
    sort_dir?: string
  }>
}

const ENTITY_FILTERS: Array<{
  label: string
  value: "all" | "driver" | "vehicle" | "shipment"
}> = [
  { label: "All", value: "all" },
  { label: "Drivers", value: "driver" },
  { label: "Vehicles", value: "vehicle" },
  { label: "Shipments", value: "shipment" },
]

type SortBy = "merchant_name" | "entity_type" | "entity_label" | "file_type_name"

function entityLabel(entityType: string): string {
  return entityType.charAt(0).toUpperCase() + entityType.slice(1)
}

function entityDetailHref(entityType: string, entityId: string): string | null {
  if (entityType === "driver") return AdminRoute.driverDetails(entityId)
  if (entityType === "vehicle") return AdminRoute.vehicleDetails(entityId)
  if (entityType === "shipment") return AdminRoute.shipmentDetails(entityId)
  return null
}

function normalizeSortBy(value?: string): SortBy {
  if (value === "merchant_name" || value === "entity_type" || value === "entity_label" || value === "file_type_name") {
    return value
  }
  return "merchant_name"
}

function normalizeSortDir(value?: string): "asc" | "desc" {
  return value === "desc" ? "desc" : "asc"
}

export default async function MissingDocumentsReportPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {}
  const requestedEntityType = params.entity_type
  const page = Math.max(1, Number(params.page ?? "1") || 1)
  const sortBy = normalizeSortBy(params.sort_by)
  const sortDir = normalizeSortDir(params.sort_dir)
  const entityType =
    requestedEntityType === "driver" ||
    requestedEntityType === "vehicle" ||
    requestedEntityType === "shipment"
      ? requestedEntityType
      : undefined

  const session = await requireAuth()
  const merchantId = session.selected_merchant?.merchant_id ?? undefined

  const reportResponse = await getMissingDocumentsReport(
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

  const rows = !isApiErrorResponse(reportResponse) ? reportResponse.data ?? [] : []
  const rawMeta = !isApiErrorResponse(reportResponse) ? reportResponse.meta : undefined
  const meta = normalizeTableMeta(rawMeta)
  const summary = !isApiErrorResponse(reportResponse) ? rawMeta?.summary_by_type ?? [] : []

  const tableRows = rows.map((row) => ({
    ...row,
    merchantName: row.merchant_name,
    entityTypeLabel: entityLabel(row.entity_type),
    entityHref: entityDetailHref(row.entity_type, row.entity_id) ?? "",
    missingDocumentType: row.file_type_name,
  }))

  const totalMissing = Number(meta?.total ?? rows.length ?? 0)
  const uniqueEntities = new Set(rows.map((row) => `${row.entity_type}:${row.entity_id}`)).size

  return (
    <div className="space-y-6">
      <PageHeader
        title="Missing Documents"
        description="Entries missing required document uploads by file type."
      />

      <div className="flex flex-wrap gap-2">
        {ENTITY_FILTERS.map((filter) => {
          const isActive = (filter.value === "all" && !entityType) || filter.value === entityType
          const href = withAdminQuery(AdminLinks.analyticsMissingDocuments, {
            entity_type: filter.value === "all" ? undefined : filter.value,
            page: 1,
          })

          return (
            <Link
              key={filter.value}
              href={href}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted/40"
              }`}
            >
              {filter.label}
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Missing records</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalMissing}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Unique entries on page</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{uniqueEntities}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Missing document types</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Missing by Document Type</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={summary.map((row) => ({
              ...row,
              merchantName: row.merchant_name,
              entityTypeLabel: entityLabel(row.entity_type),
              documentType: row.file_type_name,
              missingCount: row.missing_count,
            }))}
            emptyMessage="No missing document summary data found."
            columns={[
              { key: "merchantName", label: "Merchant" },
              { key: "entityTypeLabel", label: "Entity type" },
              { key: "documentType", label: "Document type" },
              { key: "missingCount", label: "Missing count", className: "text-right" },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Missing Document Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={tableRows}
            meta={meta}
            emptyMessage="No missing documents found for this filter."
            enableSorting
            sortableColumns={[
              "merchantName",
              "entityTypeLabel",
              "entity_label",
              "missingDocumentType",
            ]}
            sortKeyMap={{
              merchantName: "merchant_name",
              entityTypeLabel: "entity_type",
              entity_label: "entity_label",
              missingDocumentType: "file_type_name",
            }}
            columns={[
              { key: "merchantName", label: "Merchant" },
              { key: "entityTypeLabel", label: "Entity type" },
              { key: "entity_label", label: "Entry", link: "entityHref" },
              { key: "missingDocumentType", label: "Missing document type" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
