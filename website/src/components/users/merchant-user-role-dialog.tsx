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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isApiErrorResponse } from "@/lib/api/client"
import { updateMerchantUser } from "@/lib/api/merchants"
import { formatMerchantUserRole, merchantUserRoleOptions } from "@/lib/merchant-users"
import type { MerchantAccessRole, MerchantPerson } from "@/lib/types"

export function MerchantUserRoleDialog({
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
  const [role, setRole] = React.useState<MerchantAccessRole>(person.role)
  const [loading, setLoading] = React.useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await updateMerchantUser(
        merchantId,
        person.person_id,
        { role },
        accessToken
      )

      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Failed to update role.")
        return
      }

      toast.success(`Role updated to ${formatMerchantUserRole(role)}.`)
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!person.can_edit}>Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update access</DialogTitle>
          <DialogDescription>
            Change the merchant role for this {person.kind}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Role</div>
          <Select value={role} onValueChange={(value) => setRole(value as MerchantAccessRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {merchantUserRoleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {merchantUserRoleOptions.find((option) => option.value === role)?.description}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
