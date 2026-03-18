"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { isApiErrorResponse } from "@/lib/api/client"
import { deleteMerchantUser } from "@/lib/api/merchants"
import { AdminLinks } from "@/lib/routes/admin"
import type { MerchantPerson } from "@/lib/types"

export function MerchantUserDeleteDialog({
  merchantId,
  accessToken,
  person,
}: {
  merchantId: string
  accessToken: string
  person: MerchantPerson
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      const response = await deleteMerchantUser(merchantId, person.person_id, accessToken)

      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Failed to remove merchant user.")
        return
      }

      toast.success(person.kind === "invite" ? "Invite revoked." : "User removed from merchant.")
      router.push(AdminLinks.users)
      router.refresh()
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" disabled={!person.can_delete}>
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{person.kind === "invite" ? "Revoke invite" : "Remove user"}</DialogTitle>
          <DialogDescription>
            {person.kind === "invite"
              ? "This invite will stop working immediately."
              : "This removes the user from the selected merchant only."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
