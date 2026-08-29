import { notFound } from "next/navigation"
import { FeedbackReviewPanel } from "@/components/feedback/feedback-review-panel"
import { PageHeader } from "@/components/layout/page-header"
import { getAdminFeedback } from "@/lib/api/feedback"
import { isApiErrorResponse } from "@/lib/api/client"
import { requireFeedbackReview } from "@/lib/auth"

export default async function FeedbackDetailPage({ params }: { params: Promise<{ feedbackId: string }> }) {
  const { feedbackId } = await params
  const session = await requireFeedbackReview()
  const response = await getAdminFeedback(feedbackId, session.accessToken)
  if (isApiErrorResponse(response)) notFound()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback conversation"
        description="Review the original context, respond to the submitter, and update the workflow."
      />
      <FeedbackReviewPanel feedback={response.data} accessToken={session.accessToken} currentUserId={session.user.uuid ?? null} />
    </div>
  )
}
