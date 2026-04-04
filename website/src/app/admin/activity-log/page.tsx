import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { isApiErrorResponse } from "@/lib/api/client"
import { listAdminMerchants } from "@/lib/api/admin"
import { listActivityLogs } from "@/lib/api/activity-logs"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import { getActivityEntityHref, getActivityLogHref } from "@/lib/activity-log"
import { normalizeTableMeta } from "@/lib/table"

type ActivityLogPageProps = {
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

function normalizeSortDir(value: string): "asc" | "desc" | undefined {
  if (value === "asc" || value === "desc") {
    return value
  }
  return undefined
}

export default async function ActivityLogPage({ searchParams }: ActivityLogPageProps) {
  const params = (await searchParams) ?? {}
  const accountId = getSingleValue(params.account_id)
  const merchantId = getSingleValue(params.merchant_id)
  const environmentId = getSingleValue(params.environment_id)
  const actorUserId = getSingleValue(params.actor_user_id)
  const action = getSingleValue(params.action)
  const entityType = getSingleValue(params.entity_type)
  const entityId = getSingleValue(params.entity_id)
  const from = getSingleValue(params.from)
  const to = getSingleValue(params.to)
  const nullEnvironment = getSingleValue(params.null_environment) === "1"
  const page = toPositiveInt(getSingleValue(params.page), 1)
  const perPage = Math.min(100, toPositiveInt(getSingleValue(params.per_page), 20))
  const sortBy = normalizeText(getSingleValue(params.sort_by))
  const sortDir = normalizeSortDir(getSingleValue(params.sort_dir))

  const session = await requireAuth()
  const scopedMerchantId = getScopedMerchantId(session)
  const canLoad = session.user.role === "super_admin" || Boolean(scopedMerchantId)
  const adminMerchantsResponse =
    session.user.role === "super_admin"
      ? await listAdminMerchants(session.accessToken)
      : null
  const adminMerchants =
    adminMerchantsResponse && !isApiErrorResponse(adminMerchantsResponse)
      ? adminMerchantsResponse.data
      : []
  const merchantNameById = new Map<string, string>()
  const merchantSources = [...(session.merchants ?? []), ...adminMerchants]
  merchantSources.forEach((merchant) => {
    const id = merchant.merchant_id?.trim()
    const name = merchant.name?.trim()
    if (id && name) {
      merchantNameById.set(id, name)
    }
  })

  const resolvedMerchantId =
    session.user.role === "super_admin"
      ? normalizeText(merchantId)
      : scopedMerchantId

  const response = canLoad
    ? await listActivityLogs(session.accessToken, {
        page,
        per_page: perPage,
        sort_by: sortBy,
        sort_dir: sortDir,
        account_id: normalizeText(accountId),
        merchant_id: resolvedMerchantId,
        environment_id: nullEnvironment ? "" : normalizeText(environmentId),
        actor_user_id: normalizeText(actorUserId),
        action: normalizeText(action),
        entity_type: normalizeText(entityType),
        entity_id: normalizeText(entityId),
        from: normalizeText(from),
        to: normalizeText(to),
      })
    : null

  const isError = response ? isApiErrorResponse(response) : false
  const loadingError = canLoad
    ? isError
      ? (response && isApiErrorResponse(response)
          ? response.message
          : "Failed to load activity logs.")
      : null
    : "Select a merchant to view activity logs."
  const rows = !response || isError
    ? []
    : response.data.map((item) => ({
        ...item,
        merchant_name_display: item.merchant_id
          ? merchantNameById.get(item.merchant_id) ?? item.merchant_id
          : "-",
        actor_name_display: item.actor_name ?? "System",
        entity_href: getActivityEntityHref(item.entity_type, item.entity_id),
        log_href: getActivityLogHref(item.activity_id),
      }))
  const tableMeta =
    response && !isApiErrorResponse(response) ? normalizeTableMeta(response.meta) : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description="Audit stream of actions across bookings, shipments, drivers, vehicles, and environments."
      />

      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loadingError}
        enableSorting
        sortableColumns={[
          "title",
          "actor_name_display",
          "action",
          "entity_type",
          "activity_id",
          "entity_id",
          "occurred_at",
        ]}
        sortKeyMap={{ actor_name_display: "actor_name" }}
        searchKeys={["title", "actor_name_display", "action", "entity_type"]}
        filters={[
          {
            key: "account_id",
            label: "Account ID",
            type: "text",
            value: accountId,
            url_param_name: "account_id",
            placeholder: "Account ID",
          },
          ...(session.user.role === "super_admin"
            ? [
                {
                  key: "merchant_id",
                  label: "Merchant ID",
                  type: "text" as const,
                  value: merchantId,
                  url_param_name: "merchant_id",
                  placeholder: "Merchant ID",
                },
              ]
            : []),
          {
            key: "environment_id",
            label: "Environment ID",
            type: "text",
            value: environmentId,
            url_param_name: "environment_id",
            placeholder: "Environment ID",
          },
          {
            key: "null_environment",
            label: "NULL environment",
            value: nullEnvironment ? "1" : "",
            url_param_name: "null_environment",
            options: [{ label: "Only NULL", value: "1" }],
          },
          {
            key: "actor_user_id",
            label: "Actor User ID",
            type: "text",
            value: actorUserId,
            url_param_name: "actor_user_id",
            placeholder: "Actor User ID",
          },
          {
            key: "action",
            label: "Action",
            type: "text",
            value: action,
            url_param_name: "action",
            placeholder: "Action (created, updated...)",
          },
          {
            key: "entity_type",
            label: "Entity Type",
            type: "text",
            value: entityType,
            url_param_name: "entity_type",
            placeholder: "Entity Type",
          },
          {
            key: "entity_id",
            label: "Entity ID",
            type: "text",
            value: entityId,
            url_param_name: "entity_id",
            placeholder: "Entity ID",
          },
          {
            key: "from",
            label: "From",
            type: "date",
            value: from,
            url_param_name: "from",
          },
          {
            key: "to",
            label: "To",
            type: "date",
            value: to,
            url_param_name: "to",
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
          { key: "title", label: "Title", link: "log_href" },
          { key: "actor_name_display", label: "Actor" },
          { key: "merchant_name_display", label: "Merchant" },
          { key: "action", label: "Action" },
          { key: "entity_type", label: "Entity" },
          { key: "activity_id", label: "Activity ID", link: "log_href" },
          { key: "entity_id", label: "Entity ID", link: "entity_href" },
          { key: "occurred_at", label: "Occurred", type: "date_time", format: "YYYY-MM-DD HH:mm" },
        ]}
      />
    </div>
  )
}
