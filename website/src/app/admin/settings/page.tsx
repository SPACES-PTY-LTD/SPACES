import { OrganizationSettingsForm } from "@/components/settings/organization-settings-form"
import { PageHeader } from "@/components/layout/page-header"
import { requireAuth } from "@/lib/auth"

export default async function SettingsPage() {
  const session = await requireAuth()
  const merchant = session.selected_merchant

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="System health and workspace configuration."
      />
      <div className="max-w-3xl mx-auto">
        <div className="border border-border overflow-hidden rounded-xl">
          <div className="p-6 bg-secondary/50">
            <h3 className="font-bold">General</h3>
            <p className="text-sm text-muted-foreground ">
              General settings related to this organization.
            </p>
          </div>
          {merchant ? (
            <OrganizationSettingsForm
              accessToken={session.accessToken}
              merchant={merchant}
            />
          ) : (
            <div className="p-6 text-sm text-muted-foreground">
              Select a merchant to manage settings.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
