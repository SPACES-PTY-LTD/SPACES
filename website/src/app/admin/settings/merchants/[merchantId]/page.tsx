import { AdminLinks } from "@/lib/routes/admin"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { CreateResourceDialog } from "@/components/common/create-resource-dialog"
import { DataTable } from "@/components/common/data-table"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isApiErrorResponse } from "@/lib/api/client"
import {
  getMerchant,
  listMerchantEnvironments,
  listMerchantInvites,
  listMerchantMembers,
} from "@/lib/api/merchants"
import { requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"

export default async function MerchantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ merchantId: string }>
  searchParams?: Promise<{ page?: string | string[] }>
}) {
  const { merchantId } = await params
  const resolvedSearchParams = (await searchParams) ?? {}
  const rawPage = Array.isArray(resolvedSearchParams.page)
    ? resolvedSearchParams.page[0]
    : resolvedSearchParams.page
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const session = await requireAuth()
  const [merchantResponse, membersResponse, invitesResponse, environmentsResponse] =
    await Promise.all([
    getMerchant(merchantId, session.accessToken),
    listMerchantMembers(merchantId, session.accessToken, { page }),
    listMerchantInvites(merchantId, session.accessToken, { page }),
    listMerchantEnvironments(merchantId, session.accessToken, { page }),
  ])
  const merchantError = isApiErrorResponse(merchantResponse)
    ? merchantResponse.message
    : null
  const membersError = isApiErrorResponse(membersResponse)
    ? membersResponse.message
    : null
  const invitesError = isApiErrorResponse(invitesResponse)
    ? invitesResponse.message
    : null
  const environmentsError = isApiErrorResponse(environmentsResponse)
    ? environmentsResponse.message
    : null

  const merchant = isApiErrorResponse(merchantResponse) ? null : merchantResponse
  const members = isApiErrorResponse(membersResponse) ? [] : membersResponse.data
  const invites = isApiErrorResponse(invitesResponse) ? [] : invitesResponse.data
  const environments = isApiErrorResponse(environmentsResponse)
    ? []
    : environmentsResponse.data

  const memberRows = membersError
    ? []
    : members.map((member) => ({
        id: member.user_id,
        name: member.name,
        email: member.email,
        role: member.role,
        status: member.status,
      }))
  const inviteRows = invitesError
    ? []
    : invites.map((invite) => ({
        id: invite.invite_id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        createdAt: invite.createdAt,
      }))
  const environmentRows = environmentsError
    ? []
    : environments.map((environment) => ({
        id: environment.environment_id,
        name: environment.name,
        mode: environment.mode,
        token: environment.token,
        status: environment.status,
      }))
  const membersMeta = isApiErrorResponse(membersResponse)
    ? undefined
    : normalizeTableMeta(membersResponse.meta)
  const invitesMeta = isApiErrorResponse(invitesResponse)
    ? undefined
    : normalizeTableMeta(invitesResponse.meta)
  const environmentsMeta = isApiErrorResponse(environmentsResponse)
    ? undefined
    : normalizeTableMeta(environmentsResponse.meta)

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Merchants", href: AdminLinks.merchants },
          { label: merchant?.name ?? "Merchant" },
        ]}
      />
      <PageHeader
        title={merchant?.name ?? "Merchant"}
        description="Merchant workspace overview and access controls."
        actions={
          <CreateResourceDialog
            title="Invite member"
            triggerLabel="Invite member"
            fields={[
              { name: "email", label: "Email", type: "email", required: true },
              { name: "role", label: "Role", required: true },
            ]}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-xs text-muted-foreground">Status</div>
            <StatusBadge status={merchant?.status ?? "unknown"} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-xs text-muted-foreground">Members</div>
            <div className="text-lg font-semibold">
              {merchant?.memberCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-xs text-muted-foreground">Environments</div>
            <div className="text-lg font-semibold">
              {merchant?.environmentCount ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
          <TabsTrigger value="environments">Environments</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <DataTable
            data={memberRows}
            meta={membersMeta}
            loading_error={membersError ?? merchantError}
            searchKeys={["name", "email"]}
            columns={[
              { key: "name", label: "Member" },
              { key: "email", label: "Email" },
              { key: "role", label: "Role" },
              {
                key: "status",
                label: "Status",
                type: "status",
              },
            ]}
            rowActions={[{ label: "Edit" }, { label: "Remove" }]}
          />
        </TabsContent>
        <TabsContent value="invites">
          <DataTable
            data={inviteRows}
            meta={invitesMeta}
            loading_error={invitesError ?? merchantError}
            searchKeys={["email"]}
            columns={[
              { key: "email", label: "Email" },
              { key: "role", label: "Role" },
              {
                key: "status",
                label: "Status",
                type: "status",
              },
              { key: "createdAt", label: "Sent" },
            ]}
            rowActions={[{ label: "Resend" }, { label: "Revoke" }]}
          />
        </TabsContent>
        <TabsContent value="environments">
          <DataTable
            data={environmentRows}
            meta={environmentsMeta}
            loading_error={environmentsError ?? merchantError}
            columns={[
              { key: "name", label: "Environment" },
              { key: "mode", label: "Mode" },
              { key: "token", label: "Token" },
              {
                key: "status",
                label: "Status",
                type: "status",
              },
            ]}
            rowActions={[{ label: "Rotate token" }, { label: "Delete" }]}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
