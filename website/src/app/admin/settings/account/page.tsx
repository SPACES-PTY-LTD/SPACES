import { PageHeader } from "@/components/layout/page-header"
import { AccountSettingsForm } from "@/components/settings/account-settings-form"
import { Card, CardContent } from "@/components/ui/card"
import { isApiErrorResponse } from "@/lib/api/client"
import { getCurrentUserProfile } from "@/lib/api/merchants"
import { requireAuth } from "@/lib/auth"

export default async function AccountSettingsPage() {
  const session = await requireAuth()
  const response = await getCurrentUserProfile(session.accessToken)

  if (isApiErrorResponse(response)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My account"
          description="Manage your personal account details."
        />
        <Card className="max-w-3xl">
          <CardContent className="p-6 text-sm text-destructive">
            {response.message || "Unable to load your account details."}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My account"
        description="Manage your personal account details."
      />
      <AccountSettingsForm user={response} accessToken={session.accessToken} />
    </div>
  )
}
