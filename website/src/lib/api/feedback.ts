import { apiFetch } from "@/lib/api/client"
import type {
  ApiEnvelope,
  ApiListResponse,
  Feedback,
  FeedbackCategory,
  FeedbackStatus,
} from "@/lib/types"

export type FeedbackListParams = {
  page?: number
  per_page?: number
  status?: FeedbackStatus
  category?: FeedbackCategory
  merchant_id?: string
  assigned_to?: "me" | "unassigned"
  search?: string
}

type FeedbackListResponse = ApiEnvelope<Feedback[]> & ApiListResponse<Feedback>

export function createFeedback(
  payload: {
    merchant_id?: string | null
    category: FeedbackCategory
    message: string
    page_path: string
  },
  token?: string | null
) {
  return apiFetch<ApiEnvelope<Feedback>>("/api/v1/feedback", {
    method: "POST",
    token,
    body: payload,
  })
}

export function listMyFeedback(token?: string | null, params: FeedbackListParams = {}) {
  return apiFetch<FeedbackListResponse>("/api/v1/feedback/mine", { token, params })
}

export function getMyFeedback(feedbackId: string, token?: string | null) {
  return apiFetch<ApiEnvelope<Feedback>>(`/api/v1/feedback/${feedbackId}`, { token })
}

export function replyToMyFeedback(feedbackId: string, message: string, token?: string | null) {
  return apiFetch<ApiEnvelope<Feedback>>(`/api/v1/feedback/${feedbackId}/replies`, {
    method: "POST",
    token,
    body: { message },
  })
}

export function markMyFeedbackRead(feedbackId: string, token?: string | null) {
  return apiFetch<ApiEnvelope<Feedback>>(`/api/v1/feedback/${feedbackId}/read`, {
    method: "POST",
    token,
  })
}

export function getMyFeedbackUnreadCount(token?: string | null) {
  return apiFetch<ApiEnvelope<{ count: number }>>("/api/v1/feedback/unread-count", { token })
}

export function listAdminFeedback(token?: string | null, params: FeedbackListParams = {}) {
  return apiFetch<FeedbackListResponse>("/api/v1/admin/feedback", { token, params })
}

export function getAdminFeedback(feedbackId: string, token?: string | null) {
  return apiFetch<ApiEnvelope<Feedback>>(`/api/v1/admin/feedback/${feedbackId}`, { token })
}

export function updateAdminFeedback(
  feedbackId: string,
  payload: { status?: FeedbackStatus; assignment?: "self" | "unassigned" },
  token?: string | null
) {
  return apiFetch<ApiEnvelope<Feedback>>(`/api/v1/admin/feedback/${feedbackId}`, {
    method: "PATCH",
    token,
    body: payload,
  })
}

export function replyToAdminFeedback(
  feedbackId: string,
  payload: { message: string; status?: FeedbackStatus },
  token?: string | null
) {
  return apiFetch<ApiEnvelope<Feedback>>(`/api/v1/admin/feedback/${feedbackId}/replies`, {
    method: "POST",
    token,
    body: payload,
  })
}

export function markAdminFeedbackRead(feedbackId: string, token?: string | null) {
  return apiFetch<ApiEnvelope<Feedback>>(`/api/v1/admin/feedback/${feedbackId}/read`, {
    method: "POST",
    token,
  })
}

export function getAdminFeedbackUnreadCount(token?: string | null) {
  return apiFetch<ApiEnvelope<{ count: number }>>("/api/v1/admin/feedback/unread-count", { token })
}
