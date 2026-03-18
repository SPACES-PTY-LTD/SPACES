import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { FileTypesManager } from "@/components/settings/file-types-manager"
import { requireAuth, getScopedMerchantId } from "@/lib/auth"
import { AdminLinks } from "@/lib/routes/admin"

export default async function FileTypesSettingsPage() {
  const session = await requireAuth()
  const merchantId = getScopedMerchantId(session)

  if (!merchantId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="File Types"
          description="Manage shipment, driver, and vehicle file type rules."
        />
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            Select a merchant first to manage merchant-specific file types.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="File Types"
        description="Manage shipment, driver, and vehicle file type rules."
      />
      <FileTypesManager accessToken={session.accessToken} merchantId={merchantId} />
    </div>
  )
}
