import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { MerchantUserDeleteDialog } from "@/components/users/merchant-user-delete-dialog"
import { MerchantUserProfileDialog } from "@/components/users/merchant-user-profile-dialog"
import { MerchantUserResendButton } from "@/components/users/merchant-user-resend-button"
import { MerchantUserRoleDialog } from "@/components/users/merchant-user-role-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/common/status-badge"
import { getMerchantUser } from "@/lib/api/merchants"
import { isApiErrorResponse } from "@/lib/api/client"
import { requireMerchantUserManagement } from "@/lib/auth"
import { formatMerchantPersonName, formatMerchantUserRole } from "@/lib/merchant-users"
import { AdminLinks } from "@/lib/routes/admin"

export default async function MerchantUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const session = await requireMerchantUserManagement()
  const merchantId = session.selected_merchant?.merchant_id

  if (!merchantId) {
    return null
  }

  const response = await getMerchantUser(merchantId, userId, session.accessToken)
  const person = isApiErrorResponse(response) ? null : response
  const error = isApiErrorResponse(response) ? response.message : null
  const isSelf = Boolean(person && person.kind === "member" && session.user.uuid === person.person_id)

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Users", href: AdminLinks.users },
          { label: person ? formatMerchantPersonName(person) : "User" },
        ]}
      />
      <PageHeader
        title={person ? formatMerchantPersonName(person) : "User"}
        description={
          person
            ? `${person.kind === "invite" ? "Pending invite" : "Merchant member"} for the selected merchant.`
            : "Merchant user details."
        }
        actions={
          person ? (
            <div className="flex flex-wrap items-center gap-2">
              {person.kind === "invite" && person.can_resend ? (
                <MerchantUserResendButton
                  merchantId={merchantId}
                  personId={person.person_id}
                  accessToken={session.accessToken}
                />
              ) : null}
              {person.kind === "member" && person.can_edit_profile ? (
                <MerchantUserProfileDialog
                  merchantId={merchantId}
                  accessToken={session.accessToken}
                  person={person}
                  triggerLabel={isSelf ? "Edit profile" : "Edit details"}
                />
              ) : null}
              {person.can_edit_role ? (
                <MerchantUserRoleDialog
                  merchantId={merchantId}
                  accessToken={session.accessToken}
                  person={person}
                />
              ) : null}
              {person.can_delete ? (
                <MerchantUserDeleteDialog
                  merchantId={merchantId}
                  accessToken={session.accessToken}
                  person={person}
                />
              ) : null}
            </div>
          ) : undefined
        }
      />

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {person ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className={person.invited_by ? "lg:col-span-2" : "lg:col-span-3"}>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Name</div>
                <div className="font-medium">{person.name ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="font-medium">{person.email}</div>
              </div>
              {person.kind === "member" ? (
                <div>
                  <div className="text-xs text-muted-foreground">Telephone</div>
                  <div className="font-medium">{person.telephone ?? "-"}</div>
                </div>
              ) : null}
              <div>
                <div className="text-xs text-muted-foreground">Type</div>
                <div className="font-medium capitalize">{person.kind}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Role</div>
                <div className="font-medium">{formatMerchantUserRole(person.role)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <StatusBadge status={person.status} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Created</div>
                <div className="font-medium">{person.created_at ?? "-"}</div>
              </div>
              {person.accepted_at ? (
              <div>
                <div className="text-xs text-muted-foreground">Accepted</div>
                <div className="font-medium">{person.accepted_at ?? "-"}</div>
              </div>
              ) : null}
              {person.expires_at ? (
              <div>
                <div className="text-xs text-muted-foreground">Expires</div>
                <div className="font-medium">{person.expires_at ?? "-"}</div>
              </div>
              ) : null}
            </CardContent>
          </Card>

          {person.invited_by ? (
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground">Invited by</div>
                <div className="font-medium">
                  {person.invited_by?.name ?? person.invited_by?.email ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Invite email</div>
                <div className="text-sm text-muted-foreground">
                  Email addresses cannot be edited. Revoke this invite and create a new one to use a different email address.
                </div>
              </div>
            </CardContent>
          </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
