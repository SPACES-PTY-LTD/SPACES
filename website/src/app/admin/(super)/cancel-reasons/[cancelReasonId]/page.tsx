import { AdminLinks } from "@/lib/routes/admin"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ErrorMessage } from "@/components/common/error-message"
import { isApiErrorResponse } from "@/lib/api/client"
import { getCancelReason } from "@/lib/api/cancel-reasons"
import { requireAuth } from "@/lib/auth"

export default async function CancelReasonDetailPage({
  params,
}: {
  params: Promise<{ cancelReasonId: string }>
}) {
  const { cancelReasonId } = await params
  const session = await requireAuth()
  const reason = await getCancelReason(cancelReasonId, session.accessToken)
  if (isApiErrorResponse(reason)) {
    return (
      <ErrorMessage
        title="Cancel reason"
        description="Cancel reason configuration and usage."
        message={reason.message}
      />
    )
  }
  const reasonLabel = reason.label ?? "Cancel Reason"

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[ 
          { label: "Cancel Reasons", href: AdminLinks.cancelReasons },
          { label: reasonLabel },
        ]}
      />
      <PageHeader
        title={reasonLabel}
        description="Cancel reason configuration and usage." 
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline">Edit</Button>
            <Button variant="destructive">Delete</Button>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 text-sm">
            <div className="text-xs text-muted-foreground">Code</div>
            <div className="font-medium">{reason.code}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 text-sm">
            <div className="text-xs text-muted-foreground">Status</div>
            <StatusBadge status={reason.status ?? "inactive"} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
