import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { MerchantUserInviteDialog } from "@/components/users/merchant-user-invite-dialog"
import { listMerchantUsers } from "@/lib/api/merchants"
import { isApiErrorResponse } from "@/lib/api/client"
import { requireMerchantUserManagement } from "@/lib/auth"
import { AdminRoute } from "@/lib/routes/admin"
import { normalizeTableMeta } from "@/lib/table"

type UsersPageProps = {
  searchParams?: Promise<{
    page?: string | string[]
  }>
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const params = (await searchParams) ?? {}
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const parsedPage = rawPage ? Number.parseInt(rawPage, 10) : 1
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const session = await requireMerchantUserManagement()
  const merchantId = session.selected_merchant?.merchant_id

  if (!merchantId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Users"
          description="Select a merchant before managing merchant users."
        />
      </div>
    )
  }

  const response = await listMerchantUsers(merchantId, session.accessToken, { page })
  const isError = isApiErrorResponse(response)
  const loading_error = isError ? response.message : null
  const rows = isError
    ? []
    : response.data.map((person) => ({
        id: person.person_id,
        name: person.name ?? person.email,
        email: person.email,
        role: person.role,
        status: person.status,
        kind: person.kind,
        href: AdminRoute.userDetails(person.person_id),
      }))
  const tableMeta = isError ? undefined : normalizeTableMeta(response.meta)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Members and pending invites for the selected merchant."
        actions={<MerchantUserInviteDialog merchantId={merchantId} accessToken={session.accessToken} />}
      />
      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loading_error}
        searchKeys={["name", "email", "role", "kind"]}
        columns={[
          { key: "name", label: "Name", link: "href" },
          { key: "email", label: "Email" },
          { key: "kind", label: "Type" },
          { key: "role", label: "Role" },
          { key: "status", label: "Status", type: "status" },
        ]}
        rowActions={[{ label: "View", hrefKey: "href" }]}
      />
    </div>
  )
}
