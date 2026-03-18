import Link from "next/link"
import moment from "moment"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminRoute } from "@/lib/routes/admin"
import type { EntityFile } from "@/lib/types"

function getEntityHref(file: EntityFile) {
  if (!file.entity_id || !file.entity_type) return null

  if (file.entity_type === "shipment") {
    return `${AdminRoute.shipmentDetails(file.entity_id)}?tab=files#files`
  }

  if (file.entity_type === "driver") {
    return `${AdminRoute.driverDetails(file.entity_id)}#files`
  }

  if (file.entity_type === "vehicle") {
    return `${AdminRoute.vehicleDetails(file.entity_id)}#files`
  }

  return null
}

export function ExpiredFilesCard({ files }: { files: EntityFile[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Expired files</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {files.length > 0 ? (
          files.map((file) => {
            const entityHref = getEntityHref(file)
            const entityLabel = file.entity_label ?? file.entity_id ?? "Entity"
            const fileTypeName = file.file_type?.name ?? "File"
            const entityTypeLabel = file.entity_type ?? "file"

            return (
              <div
                key={file.file_id}
                className="flex items-start justify-between gap-4 border-b border-border/60 pb-4 last:border-b-0 last:pb-0"
              >
                <div>
                  {entityHref ? (
                    <Link
                      href={entityHref}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {entityLabel}
                    </Link>
                  ) : (
                    <div className="text-sm font-medium">{entityLabel}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {(file.original_name ?? fileTypeName) +
                      " · " +
                      fileTypeName +
                      " · " +
                      entityTypeLabel}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {file.expires_at ? moment(file.expires_at).format("YYYY-MM-DD") : "-"}
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-sm text-muted-foreground">
            No expired files found.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
