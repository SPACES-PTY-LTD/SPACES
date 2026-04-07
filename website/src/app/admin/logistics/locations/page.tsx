import { AdminRoute } from "@/lib/routes/admin"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { ImportLocationsDialog } from "@/components/locations/import-locations-dialog"
import { LocationDialog } from "@/components/locations/location-dialog"
import { isApiErrorResponse } from "@/lib/api/client"
import { listLocations } from "@/lib/api/locations"
import { listLocationTypes } from "@/lib/api/location-types"
import { listTags } from "@/lib/api/tags"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"

type LocationsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : (value ?? "")
}

function normalizeText(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function toPositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 1) return fallback
  return parsed
}

function normalizeSortBy(value: string) {
  const allowed = new Set(["created_at", "name", "code", "company", "city", "type"])
  return allowed.has(value) ? value : "created_at"
}

function normalizeSortDir(value: string) {
  return value === "asc" ? "asc" : "desc"
}

export default async function LocationsPage({ searchParams }: LocationsPageProps) {
  const params = (await searchParams) ?? {}
  const page = toPositiveInt(getSingleValue(params.page), 1)
  const perPage = Math.min(100, toPositiveInt(getSingleValue(params.per_page), 20))
  const locationTypeId = getSingleValue(params.location_type_id)
  const tagId = getSingleValue(params.tag_id)
  const search = getSingleValue(params.search)
  const sortBy = normalizeSortBy(getSingleValue(params.sort_by))
  const sortDir = normalizeSortDir(getSingleValue(params.sort_dir))
  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session)
  const defaultImportMerchantId = merchantId ?? session.selected_merchant?.merchant_id ?? null
  const canLoad = session.user.role === "super_admin" || Boolean(merchantId)
  const locationTypesResponse =
    merchantId
      ? await listLocationTypes(session.accessToken, { merchant_id: merchantId })
      : null
  const locationTypes =
    locationTypesResponse && !isApiErrorResponse(locationTypesResponse)
      ? locationTypesResponse.data
      : []
  const tagsResponse =
    merchantId
      ? await listTags(session.accessToken, { merchant_id: merchantId, per_page: 100 })
      : null
  const tags =
    tagsResponse && !isApiErrorResponse(tagsResponse)
      ? tagsResponse.data
      : []
  const response = canLoad
    ? await listLocations(session.accessToken, {
        merchant_id: merchantId,
        page,
        per_page: perPage,
        search: normalizeText(search),
        location_type_id: normalizeText(locationTypeId),
        tag_id: normalizeText(tagId),
        sort_by: sortBy,
        sort_dir: sortDir,
      })
    : null
  const isError = response ? isApiErrorResponse(response) : false
  const errorMessage =
    response && isApiErrorResponse(response) ? response.message : null
  const locations =
    response && !isApiErrorResponse(response) ? response.data : []
  const loading_error = canLoad
    ? isError
      ? errorMessage
      : null
    : "Select a merchant to view locations."
  const rows = isError
    ? []
    : locations.map((location) => ({
        ...location,
        company: location.company ?? "",
        city: location.city ?? "",
        type: location.type ? location.type.title : "",
        href: location.location_id ? AdminRoute.locationDetails(location.location_id) : "",
      }))
  const tableMeta =
    response && !isApiErrorResponse(response)
      ? normalizeTableMeta(response.meta)
      : undefined
  return (
    <div className="space-y-6 flex-1">
      <PageHeader
        title="Locations"
        description="Manage pickup and dropoff locations."
        actions={
          <div className="flex items-center gap-2">
            <ImportLocationsDialog
              accessToken={session.accessToken}
              merchantId={defaultImportMerchantId}
              lockMerchant={session.user.role !== "super_admin"}
            />
            <LocationDialog
              accessToken={session.accessToken}
              merchantId={merchantId ?? null}
            />
            
          </div>
        }
      />
      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        filters={[
          {
            key: "search",
            label: "Search",
            type: "text",
            value: search ?? "",
            url_param_name: "search",
            placeholder: "Search name, code, company, city...",
          },
          {
            key: "type",
            label: "Type",
            value: locationTypeId ?? "",
            url_param_name: "location_type_id",
            options: locationTypes
              .filter((type) => Boolean(type.location_type_id))
              .map((type) => ({
                label: type.title || type.slug || type.location_type_id || "",
                value: type.location_type_id || "",
              })),
          },
          {
            key: "tag",
            label: "Tag",
            value: tagId ?? "",
            url_param_name: "tag_id",
            options: tags.map((tag) => ({
              label: tag.name,
              value: tag.tag_id,
            })),
          },
          {
            key: "per_page",
            label: "Per page",
            value: String(perPage),
            url_param_name: "per_page",
            options: [
              { label: "20", value: "20" },
              { label: "50", value: "50" },
              { label: "100", value: "100" },
            ],
          },
        ]}
        columns={[
          { key: "name", label: "Name", link: "href" },
          { key: "code", label: "Code", link: "href" },
          { key: "company", label: "Company", link: "href" },
          { key: "type", label: "Type" , link: "href" },
          { key: "tags", label: "Tags", type: "tags" },
          { key: "city", label: "City", link: "href" },
          
        ]}
        rowActions={[
          { label: "View", hrefKey: "href" },
          { label: "Edit" },
          { label: "Delete", variant: "destructive" },
        ]}
        enableSorting
        sortableColumns={["name", "code", "company", "type", "city"]}
      />
    </div>
  )
}
