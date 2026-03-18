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
import { isApiErrorResponse } from "@/lib/api/client"
import { updateMerchantUser } from "@/lib/api/merchants"
import type { MerchantPerson } from "@/lib/types"

type FormState = {
  name: string
  telephone: string
}

export function MerchantUserProfileDialog({
  merchantId,
  accessToken,
  person,
  triggerLabel = "Edit details",
}: {
  merchantId: string
  accessToken: string
  person: MerchantPerson
  triggerLabel?: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [values, setValues] = React.useState<FormState>({
    name: person.name ?? "",
    telephone: person.telephone ?? "",
  })

  React.useEffect(() => {
    if (!open) return

    setValues({
      name: person.name ?? "",
      telephone: person.telephone ?? "",
    })
  }, [open, person])

  const handleSubmit = async () => {
    if (!values.name.trim()) {
      toast.error("Name is required.")
      return
    }

    setLoading(true)
    try {
      const response = await updateMerchantUser(
        merchantId,
        person.person_id,
        {
          name: values.name.trim(),
          telephone: values.telephone.trim() || null,
        },
        accessToken
      )

      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Failed to update details.")
        return
      }

      toast.success("User details updated.")
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!person.can_edit_profile}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile details</DialogTitle>
          <DialogDescription>
            Update the name and telephone number for this merchant member.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Name</label>
            <Input
              value={values.name}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Telephone</label>
            <Input
              value={values.telephone}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, telephone: event.target.value }))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
