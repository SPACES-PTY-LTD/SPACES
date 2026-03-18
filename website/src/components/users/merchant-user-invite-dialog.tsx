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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isApiErrorResponse } from "@/lib/api/client"
import { inviteMerchantUser } from "@/lib/api/merchants"
import { merchantUserRoleOptions } from "@/lib/merchant-users"
import type { MerchantAccessRole } from "@/lib/types"

export function MerchantUserInviteDialog({
  merchantId,
  accessToken,
}: {
  merchantId: string
  accessToken: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<MerchantAccessRole>("member")
  const [loading, setLoading] = React.useState(false)

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error("Email is required.")
      return
    }

    setLoading(true)
    try {
      const response = await inviteMerchantUser(
        merchantId,
        { email: email.trim(), role },
        accessToken
      )

      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Failed to invite user.")
        return
      }

      toast.success("Invite sent.")
      setOpen(false)
      setEmail("")
      setRole("member")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Invite user</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>
            Invite a user to the selected merchant. Invite email addresses cannot be edited later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={loading}>
            {loading ? "Sending..." : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
