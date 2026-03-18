import { DeleteDataManager } from "@/components/settings/delete-data-manager"
import { requireAuth } from "@/lib/auth"

export default async function DeleteDataPage() {
  const session = await requireAuth()

  return (
    <DeleteDataManager
      accessToken={session.accessToken}
      merchantId={session.selected_merchant?.merchant_id ?? null}
    />
  )
}
