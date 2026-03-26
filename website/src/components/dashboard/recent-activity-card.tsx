import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminLinks } from "@/lib/routes/admin"
import { getActivityEntityHref, getActivityLogHref } from "@/lib/activity-log"
import type { ActivityLog } from "@/lib/types"

function formatRelativeTime(timestamp?: string | null) {
  if (!timestamp) return "-"
  const value = new Date(timestamp).getTime()
  if (Number.isNaN(value)) return "-"

  const deltaMs = value - Date.now()
  const deltaMinutes = Math.round(deltaMs / 60000)
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (Math.abs(deltaMinutes) < 60) return rtf.format(deltaMinutes, "minute")
  const deltaHours = Math.round(deltaMinutes / 60)
  if (Math.abs(deltaHours) < 24) return rtf.format(deltaHours, "hour")
  const deltaDays = Math.round(deltaHours / 24)
  return rtf.format(deltaDays, "day")
}

export function RecentActivityCard({ activity }: { activity: ActivityLog[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Recent activity</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href={AdminLinks.activityLog}>More</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activity.length > 0 ? (
          activity.map((item) => {
            const href =
              getActivityEntityHref(item.entity_type, item.entity_id) ||
              getActivityLogHref(item.activity_id)

            return (
              <div
                key={item.activity_id}
                className="flex items-start justify-between gap-4 border-b border-border/60 pb-4 last:border-b-0 last:pb-0"
              >
                <div>
                  {href ? (
                    <Link
                      href={href}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <div className="text-sm font-medium">{item.title}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {(item.actor_name ?? "System") +
                      " · " +
                      item.entity_type +
                      " · " +
                      item.action}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatRelativeTime(item.occurred_at ?? item.created_at)}
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-sm text-muted-foreground">
            No recent activity found.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
