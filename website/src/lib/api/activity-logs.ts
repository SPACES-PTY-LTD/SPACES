import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type { ActivityLog, ApiEnvelope, ApiListResponse } from "@/lib/types"

export type ListActivityLogsParams = {
  page?: number
  per_page?: number
  sort_by?: string
  sort_dir?: "asc" | "desc"
  account_id?: string
  merchant_id?: string
  environment_id?: string
  actor_user_id?: string
  action?: string
  entity_type?: string
  entity_id?: string
  from?: string
  to?: string
}

type GetActivityLogParams = {
  merchant_id?: string
}

type ActivityLogsResponse = ApiEnvelope<ActivityLog[]> & ApiListResponse<ActivityLog>

export async function listActivityLogs(
  token?: string | null,
  params: ListActivityLogsParams = {}
) {
  return apiFetch<ActivityLogsResponse>("/api/v1/activity-logs", {
    token,
    params: {
      page: params.page,
      per_page: params.per_page,
      sort_by: params.sort_by,
      sort_dir: params.sort_dir,
      account_id: params.account_id,
      merchant_id: params.merchant_id,
      environment_id: params.environment_id,
      actor_user_id: params.actor_user_id,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      from: params.from,
      to: params.to,
    },
  })
}

export async function getActivityLog(
  activityId: string,
  token?: string | null,
  params: GetActivityLogParams = {}
) {
  const response = await apiFetch<ApiEnvelope<ActivityLog>>(
    `/api/v1/activity-logs/${activityId}`,
    {
      token,
      params: {
        merchant_id: params.merchant_id,
      },
    }
  )
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}
