import type { Merchant } from "@/lib/types"

export function isMerchantSetupComplete(merchant?: Merchant | null) {
  if (!merchant) return false
  return Boolean(merchant.setup_completed_at)
}
