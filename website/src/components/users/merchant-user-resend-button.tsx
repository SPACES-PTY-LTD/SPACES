"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { isApiErrorResponse } from "@/lib/api/client"
import { resendMerchantUserInvite } from "@/lib/api/merchants"

export function MerchantUserResendButton({
  merchantId,
  personId,
  accessToken,
}: {
  merchantId: string
  personId: string
  accessToken: string
}) {
  const router = useRouter()

  const handleResend = async () => {
    const response = await resendMerchantUserInvite(merchantId, personId, accessToken)

    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to resend invite.")
      return
    }

    toast.success("Invite resent.")
    router.refresh()
  }

  return (
    <Button variant="outline" onClick={handleResend}>
      Resend Invite
    </Button>
  )
}
