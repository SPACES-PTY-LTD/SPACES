import { AdminLinks, AdminRoute } from "@/lib/routes/admin"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { RouteDialog } from "@/components/routes/route-dialog"
import { isApiErrorResponse } from "@/lib/api/client"
import { listRoutes } from "@/lib/api/routes"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"

type RoutesPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
    per_page?: string | string[]
    search?: string | string[]
    merchant_id?: string | string[]
    sort_by?: string | string[]
    sort_dir?: string | string[]
  }>
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
  const allowed = new Set([
    "created_at",
    "updated_at",
    "title",
    "code",
    "estimated_distance",
    "estimated_duration",
  ])
  return allowed.has(value) ? value : "created_at"
}

function normalizeSortDir(value: string) {
  return value === "asc" ? "asc" : "desc"
}

export default async function RoutesPage({ searchParams }: RoutesPageProps) {
  const params = (await searchParams) ?? {}
  const page = toPositiveInt(getSingleValue(params.page), 1)
  const perPage = Math.min(100, toPositiveInt(getSingleValue(params.per_page), 20))
  const search = getSingleValue(params.search)
  const merchantIdParam = getSingleValue(params.merchant_id)
  const sortBy = normalizeSortBy(getSingleValue(params.sort_by))
  const sortDir = normalizeSortDir(getSingleValue(params.sort_dir))

  const session = await requireAuth()
  const scopedMerchantId = getScopedMerchantId(session)
  const canLoad = session.user.role === "super_admin" || Boolean(scopedMerchantId)
  const merchantId =
    session.user.role === "super_admin"
      ? normalizeText(merchantIdParam)
      : scopedMerchantId

  const routesResponse = canLoad
      ? await listRoutes(session.accessToken, {
        page,
        per_page: perPage,
        merchant_id: merchantId,
        search: normalizeText(search),
        sort_by: sortBy,
        sort_dir: sortDir,
      })
    : null

  const isError = routesResponse ? isApiErrorResponse(routesResponse) : false
  const loadingError = canLoad
    ? isError
      ? (routesResponse && isApiErrorResponse(routesResponse)
          ? routesResponse.message
          : "Failed to load routes.")
      : null
    : "Select a merchant to view routes."

  const routes =
    routesResponse && !isApiErrorResponse(routesResponse)
      ? routesResponse.data ?? []
      : []
  const rows = routes.map((route) => ({
    ...route,
    href: AdminRoute.routeDetails(route.route_id),
    stops_count: route.stops?.length ?? 0,
  }))

  const tableMeta =
    routesResponse && !isApiErrorResponse(routesResponse)
      ? normalizeTableMeta(routesResponse.meta)
      : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Routes"
        description="Manage route plans and stop sequences across locations."
        actions={
          <RouteDialog
            accessToken={session.accessToken}
            merchantId={merchantId ?? session.selected_merchant?.merchant_id ?? null}
            lockMerchant={session.user.role !== "super_admin"}
          />
        }
      />

      <DataTable
        data={rows}
        views={
          [
            {
              "label": "All",
              "href": AdminLinks.routes,
            }
          ]
        }
        meta={tableMeta}
        loading_error={loadingError}
        searchKeys={["title", "code", "description"]}
        filters={[
          ...(session.user.role === "super_admin"
            ? [
                {
                  key: "merchant_id",
                  label: "Merchant ID",
                  type: "text" as const,
                  value: merchantIdParam,
                  url_param_name: "merchant_id",
                  placeholder: "Merchant ID",
                },
              ]
            : []),
          {
            key: "search",
            label: "Search",
            type: "text",
            value: search,
            url_param_name: "search",
            placeholder: "Search title or code",
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
          { key: "title", label: "Title", link: "href" },
          { key: "code", label: "Code", link: "href" },
          { key: "description", label: "Description", link: "href" },
          { key: "estimated_distance", label: "Distance (km)", link: "href" },
          { key: "estimated_duration", label: "Duration (min)", link: "href" },
          { key: "stops_count", label: "Stops", link: "href" },
          { key: "updated_at", label: "Updated", type: "date_time", format: "YYYY-MM-DD HH:mm", link: "href" },
        ]}
        rowActions={[{ label: "View", hrefKey: "href" }]}
        enableSorting
        sortableColumns={[
          "title",
          "code",
          "estimated_distance",
          "estimated_duration",
          "updated_at",
        ]}
      />
    </div>
  )
}
