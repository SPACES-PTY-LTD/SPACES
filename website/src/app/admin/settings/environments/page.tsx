import { AdminLinks } from "@/lib/routes/admin"
import { revalidatePath } from "next/cache"
import { PageHeader } from "@/components/layout/page-header"
import { CreateResourceDialog } from "@/components/common/create-resource-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createMerchantEnvironment,
  deleteMerchantEnvironment,
  listMerchantEnvironments,
  listMerchants,
  rotateEnvironmentToken,
} from "@/lib/api/merchants"
import { isApiErrorResponse } from "@/lib/api/client"
import { requireAuth } from "@/lib/auth"
import { CopyToken } from "@/components/common/copy-token"
import { Trash } from "lucide-react"

type SearchParams = {
  merchantId?: string
}

export default async function EnvironmentsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const resolvedSearchParams = await searchParams
  const session = await requireAuth()
  const merchantsResponse = await listMerchants(session.accessToken)
  const merchantsError = isApiErrorResponse(merchantsResponse)
    ? merchantsResponse.message
    : null
  const merchants = isApiErrorResponse(merchantsResponse)
    ? []
    : merchantsResponse.data
  const selectedMerchantId =
    resolvedSearchParams?.merchantId ?? merchants[0]?.merchant_id
  const selectedMerchant =
    merchants.find(
      (merchant) => merchant.merchant_id === selectedMerchantId
    ) ?? merchants[0]
  const environmentsResponse = selectedMerchantId
    ? await listMerchantEnvironments(selectedMerchantId, session.accessToken)
    : null
  const environmentsError = environmentsResponse && isApiErrorResponse(environmentsResponse)
    ? environmentsResponse.message
    : null
  const environments =
    !environmentsResponse || isApiErrorResponse(environmentsResponse)
      ? []
      : environmentsResponse.data
  const loadingEnvironmentsError = environmentsError ?? merchantsError

  const createEnvironment = async (values: Record<string, string>) => {
    "use server"
    const session = await requireAuth()
    if (!selectedMerchantId) return
    const result = await createMerchantEnvironment(
      selectedMerchantId,
      {
        name: values.name,
        url: values.url?.trim() ?? "",
        mode: (values.mode as "live" | "test") ?? "test",
        color: values.color?.trim() || undefined,
      },
      session.accessToken
    )
    if (isApiErrorResponse(result)) {
      return
    }
    revalidatePath(AdminLinks.settingsEnvironments)
  }

  const rotateToken = async (formData: FormData) => {
    "use server"
    const environmentId = formData.get("environmentId")
    if (typeof environmentId !== "string" || !selectedMerchantId) return
    const session = await requireAuth()
    const result = await rotateEnvironmentToken(
      selectedMerchantId,
      environmentId,
      session.accessToken
    )
    if (isApiErrorResponse(result)) {
      return
    }
    revalidatePath(AdminLinks.settingsEnvironments)
  }

  const deleteEnvironment = async (formData: FormData) => {
    "use server"
    const environmentId = formData.get("environmentId")
    if (typeof environmentId !== "string" || !selectedMerchantId) return
    const session = await requireAuth()
    const result = await deleteMerchantEnvironment(
      selectedMerchantId,
      environmentId,
      session.accessToken
    )
    if (isApiErrorResponse(result)) {
      return
    }
    revalidatePath(AdminLinks.settingsEnvironments)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Environments"
        description="Manage merchant environments, access tokens, and lifecycle settings."
        actions={
          selectedMerchantId ? (
            <CreateResourceDialog
              title="Create environment"
              description="Add a new environment for the selected merchant."
              triggerLabel="New environment"
              fields={[
                { name: "name", label: "Environment name", required: true },
                {
                  name: "color",
                  label: "Color (hex)",
                  placeholder: "#1F2937",
                },
                {
                  name: "url",
                  label: "URL",
                  placeholder: "https://example.com", 
                }
              ]}
              onSubmit={createEnvironment}
            />
          ) : undefined
        }
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">

            <form className="flex items-center gap-3" method="get">
              <select
                name="merchantId"
                defaultValue={selectedMerchantId}
                className="border-input h-9 w-[240px] rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {merchants.map((merchant) => (
                  <option key={merchant.merchant_id} value={merchant.merchant_id}>
                    {merchant.name}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline" size="sm">
                Switch
              </Button>
            </form>
          </div>
          {selectedMerchant ? (
            <div className="text-xs text-muted-foreground">
              Viewing environments for{" "}
              <span className="font-medium text-foreground">
                {selectedMerchant.name}
              </span>
              .
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              No merchants available yet. Create a merchant to get started.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Environment</TableHead>
                <TableHead>Url</TableHead>
                <TableHead>Token</TableHead>                
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingEnvironmentsError ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-destructive">
                    {loadingEnvironmentsError}
                  </TableCell>
                </TableRow>
              ) : environments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                    No environments found for this merchant.
                  </TableCell>
                </TableRow>
              ) : (
                environments.map((environment) => (
                  <TableRow key={environment.environment_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full border border-border"
                          style={{
                            backgroundColor: environment.color ?? "#1F2937",
                          }}
                        />
                        <span className="font-medium">{environment.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {environment.url}
                    </TableCell>
                    <TableCell>
                      <CopyToken value={environment.token} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <form action={rotateToken}>
                          <input
                            type="hidden"
                            name="environmentId"
                            value={environment.environment_id}
                          />
                          <Button variant="outline" size="sm">
                            Rotate token
                          </Button>
                        </form>
                        <form action={deleteEnvironment}>
                          <input
                            type="hidden"
                            name="environmentId"
                            value={environment.environment_id}
                          />
                          <Button variant="destructive" size="sm">
                            <Trash className="h-4 w-4" />
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
