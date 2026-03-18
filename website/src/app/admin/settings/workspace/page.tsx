import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"

export default function WorkspaceSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace"
        description="Configure branding, notifications, and workspace defaults."
      />
      <Card>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span>Default timezone</span>
            <span className="font-medium">Africa/Johannesburg</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Notification policy</span>
            <span className="font-medium">Operations + Webhooks</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Brand accent</span>
            <span className="font-medium">Ocean Teal</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
