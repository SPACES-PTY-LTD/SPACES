import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { isApiErrorResponse } from "@/lib/api/client"
import { listAdminFeedback } from "@/lib/api/feedback"
import { listAdminMerchants } from "@/lib/api/admin"
import { requireFeedbackReview } from "@/lib/auth"
import { AdminRoute } from "@/lib/routes/admin"
import { normalizeTableMeta } from "@/lib/table"
import type { FeedbackCategory, FeedbackStatus } from "@/lib/types"

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> }

function one(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? ""
}

export default async function FeedbackInboxPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {}
  const page = Math.max(1, Number.parseInt(one(params.page) || "1", 10) || 1)
  const perPage = Math.min(100, Math.max(1, Number.parseInt(one(params.per_page) || "20", 10) || 20))
  const status = one(params.status) as FeedbackStatus | ""
  const category = one(params.category) as FeedbackCategory | ""
  const merchantId = one(params.merchant_id)
  const assignedTo = one(params.assigned_to) as "me" | "unassigned" | ""
  const search = one(params.search)
  const session = await requireFeedbackReview()

  const response = await listAdminFeedback(session.accessToken, {
    page,
    per_page: perPage,
    status: status || undefined,
    category: category || undefined,
    merchant_id: merchantId || undefined,
    assigned_to: assignedTo || undefined,
    search: search || undefined,
  })
  const merchantResponse = session.user.role === "super_admin"
    ? await listAdminMerchants(session.accessToken)
    : null
  const merchantOptionsSource = merchantResponse && !isApiErrorResponse(merchantResponse)
    ? merchantResponse.data
    : (session.merchants ?? []).filter((merchant) => merchant.access?.permissions.can_manage_users)

  const isError = isApiErrorResponse(response)
  const rows = isError ? [] : (response.data ?? []).map((feedback) => ({
    ...feedback,
    unread_display: feedback.unread ? "● New" : "",
    category_display: feedback.category.replace(/_/g, " "),
    sender_display: feedback.submitter ? `${feedback.submitter.name} (${feedback.submitter.email ?? ""})` : "Deleted user",
    merchant_display: feedback.merchant?.name ?? "Platform",
    assignee_display: feedback.assignee?.name ?? "Unassigned",
    href: AdminRoute.feedbackDetails(feedback.feedback_id),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback"
        description="Review feedback conversations across the merchants you are allowed to manage."
      />
      <DataTable
        data={rows}
        meta={isError ? undefined : normalizeTableMeta(response.meta)}
        loading_error={isError ? response.message : null}
        emptyMessage="No feedback matches these filters."
        columns={[
          { key: "unread_display", label: "" },
          { key: "status", label: "Status", type: "status" },
          { key: "category_display", label: "Category" },
          { key: "message_preview", label: "Latest message", className: "max-w-sm truncate" },
          { key: "sender_display", label: "Sent by" },
          { key: "merchant_display", label: "Merchant" },
          { key: "page_path", label: "Page" },
          { key: "assignee_display", label: "Assigned to" },
          { key: "updated_at", label: "Updated", type: "date_time" },
        ]}
        filters={[
          {
            key: "status",
            label: "Status",
            value: status,
            url_param_name: "status",
            options: [
              { label: "Open", value: "open" },
              { label: "In progress", value: "in_progress" },
              { label: "Needs info", value: "needs_info" },
              { label: "Resolved", value: "resolved" },
              { label: "Closed", value: "closed" },
            ],
          },
          {
            key: "category",
            label: "Category",
            value: category,
            url_param_name: "category",
            options: [
              { label: "Bug", value: "bug" },
              { label: "Feature request", value: "feature_request" },
              { label: "General", value: "general" },
            ],
          },
          {
            key: "merchant_id",
            label: "Merchant",
            value: merchantId,
            url_param_name: "merchant_id",
            options: merchantOptionsSource
              .filter((merchant) => merchant.merchant_id && merchant.name)
              .map((merchant) => ({ label: merchant.name, value: merchant.merchant_id })),
          },
          {
            key: "assigned_to",
            label: "Assignment",
            value: assignedTo,
            url_param_name: "assigned_to",
            options: [
              { label: "Assigned to me", value: "me" },
              { label: "Unassigned", value: "unassigned" },
            ],
          },
          {
            key: "search",
            label: "Search",
            type: "text",
            value: search,
            url_param_name: "search",
            placeholder: "Sender, message, or page",
          },
        ]}
        rowActions={[{ label: "Open conversation", hrefKey: "href" }]}
      />
    </div>
  )
}
