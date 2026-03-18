import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { AdminLinks } from "@/lib/routes/admin"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="System health and workspace configuration."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link href={AdminLinks.settingsFileTypes}>
          <Card className="transition-colors hover:border-foreground/30">
            <CardContent className="space-y-2">
              <div className="text-sm font-semibold">File Types</div>
              <div className="text-sm text-muted-foreground">
                Configure shipment, driver, and vehicle upload requirements.
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href={AdminLinks.settingsLocationTypes}>
          <Card className="transition-colors hover:border-foreground/30">
            <CardContent className="space-y-2">
              <div className="text-sm font-semibold">Location Types</div>
              <div className="text-sm text-muted-foreground">
                Manage merchant-specific location type definitions.
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href={AdminLinks.settingsLocationAutomation}>
          <Card className="transition-colors hover:border-foreground/30">
            <CardContent className="space-y-2">
              <div className="text-sm font-semibold">Location Automation</div>
              <div className="text-sm text-muted-foreground">
                Configure ordered entry and exit actions for each merchant location type.
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href={AdminLinks.settingsEnvironments}>
          <Card className="transition-colors hover:border-foreground/30">
            <CardContent className="space-y-2">
              <div className="text-sm font-semibold">Environments</div>
              <div className="text-sm text-muted-foreground">
                Manage merchant environments and API tokens.
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
