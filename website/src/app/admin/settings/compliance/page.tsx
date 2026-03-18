import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"

export default function ComplianceSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        description="Audit readiness and policy guardrails."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">Data retention</div>
            <div className="font-medium">24 months</div>
            <div className="text-xs text-muted-foreground">
              Webhook payload retention policy.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">Access review</div>
            <div className="font-medium">Quarterly</div>
            <div className="text-xs text-muted-foreground">
              Next review scheduled for April 2026.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
