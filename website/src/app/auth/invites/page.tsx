import { isApiErrorResponse } from "@/lib/api/client"
import { previewMerchantInvite } from "@/lib/api/merchants"
import { InviteAcceptForm } from "@/components/auth/invite-accept-form"

type InvitePageProps = {
  searchParams?: Promise<{
    token?: string | string[]
  }>
}

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const params = (await searchParams) ?? {}
  const token = Array.isArray(params.token) ? params.token[0] : params.token
  const previewResponse = token ? await previewMerchantInvite(token) : null
  const preview =
    previewResponse && !isApiErrorResponse(previewResponse)
      ? previewResponse.data
      : null
  const previewError =
    previewResponse && isApiErrorResponse(previewResponse)
      ? getInvitePreviewError(previewResponse.payload)
      : null

  return (
    <div className="space-y-6 flex-1 w-full">
      <InviteAcceptForm token={token} preview={preview} previewError={previewError} />
    </div>
  )
}

function getInvitePreviewError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const code = (payload as { error?: { code?: unknown } }).error?.code

  if (code === "INVITE_NOT_FOUND") {
    return "Token not found."
  }

  return null
}
