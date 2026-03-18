import { AdminLinks } from "@/lib/routes/admin"
import Link from "next/link"
import moment from "moment"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { ErrorMessage } from "@/components/common/error-message"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { isApiErrorResponse } from "@/lib/api/client"
import { getActivityLog } from "@/lib/api/activity-logs"
import { requireAuth } from "@/lib/auth"
import { getActivityEntityHref } from "@/lib/activity-log"

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  return moment(value).format("YYYY-MM-DD HH:mm:ss")
}

function formatJson(value: unknown) {
  if (!value || (typeof value === "object" && Object.keys(value).length === 0)) {
    return "-"
  }
  return JSON.stringify(value, null, 2)
}

function InfoRow({
  label,
  value,
  href,
}: {
  label: string
  value?: string | null
  href?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium break-all">
        {value ? (
          href ? (
            <Link className="text-primary underline-offset-4 hover:underline" href={href}>
              {value}
            </Link>
          ) : (
            value
          )
        ) : (
          "-"
        )}
      </span>
    </div>
  )
}

export default async function ActivityLogDetailPage({
  params,
}: {
  params: Promise<{ logId: string }>
}) {
  const { logId } = await params
  const session = await requireAuth()
  const activity = await getActivityLog(logId, session.accessToken)

  if (isApiErrorResponse(activity)) {
    return (
      <ErrorMessage
        title="Activity log"
        description="Inspect full audit details for a single event."
        message={activity.message}
      />
    )
  }

  const entityHref = getActivityEntityHref(activity.entity_type, activity.entity_id)
  const actorLabel = activity.actor_name ?? "System"

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Activity log", href: AdminLinks.activityLog },
          { label: activity.activity_id },
        ]}
      />

      <PageHeader
        title={activity.title}
        description={`${activity.entity_type} · ${activity.action}`}
        actions={
          entityHref ? (
            <Button asChild variant="outline">
              <Link href={entityHref}>Open related entity</Link>
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="space-y-4 text-sm">
          <InfoRow label="Activity ID" value={activity.activity_id} />
          <InfoRow label="Account ID" value={activity.account_id} />
          <InfoRow label="Merchant ID" value={activity.merchant_id} />
          <InfoRow label="Environment ID" value={activity.environment_id} />
          <InfoRow label="Actor" value={actorLabel} />
          <InfoRow label="Actor User ID" value={activity.actor_user_id} />
          <InfoRow label="Action" value={activity.action} />
          <InfoRow label="Entity Type" value={activity.entity_type} />
          <InfoRow label="Entity ID" value={activity.entity_id} href={entityHref} />
          <InfoRow label="Request ID" value={activity.request_id} />
          <InfoRow label="IP Address" value={activity.ip_address} />
          <InfoRow label="Occurred At" value={formatDateTime(activity.occurred_at)} />
          <InfoRow label="Created At" value={formatDateTime(activity.created_at)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 text-sm">
          <div className="font-medium">Changes</div>
          <pre className="overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-4 text-xs">
            {formatJson(activity.changes)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 text-sm">
          <div className="font-medium">Metadata</div>
          <pre className="overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-4 text-xs">
            {formatJson(activity.metadata)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
