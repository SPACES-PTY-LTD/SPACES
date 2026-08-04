import { DeleteMerchantManager } from "@/components/settings/delete-merchant-manager"
import { requireMerchantDeletion } from "@/lib/auth"

export default async function DeleteMerchantPage() {
  const session = await requireMerchantDeletion()

  return (
    <DeleteMerchantManager
      accessToken={session.accessToken}
      merchant={session.selected_merchant!}
      initialMerchants={session.merchants ?? []}
    />
  )
}
