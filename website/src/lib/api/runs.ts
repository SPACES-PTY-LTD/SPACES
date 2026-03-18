import { apiFetch } from "@/lib/api/client"
import type { ApiListResponse, Run } from "@/lib/types"

export async function listRuns(
  token?: string | null,
  params?: { merchant_id?: string; page?: number; per_page?: number; search?: string }
) {
  return apiFetch<ApiListResponse<Run>>("/api/v1/runs", { token, params })
}
