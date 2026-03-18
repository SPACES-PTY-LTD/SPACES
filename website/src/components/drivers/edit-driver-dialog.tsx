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
import { Textarea } from "@/components/ui/textarea"
import { isApiErrorResponse } from "@/lib/api/client"
import { updateDriver } from "@/lib/api/drivers"
import type { Driver } from "@/lib/types"

type FormState = {
  name: string
  email: string
  telephone: string
  notes: string
}

export function EditDriverDialog({
  driver,
  accessToken,
  onUpdated,
  trigger,
}: {
  driver: Driver
  accessToken?: string
  onUpdated?: () => void
  trigger?: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [values, setValues] = React.useState<FormState>({
    name: driver.name ?? "",
    email: driver.email ?? "",
    telephone: driver.telephone ?? "",
    notes: driver.notes ?? "",
  })

  React.useEffect(() => {
    if (!open) return
    setValues({
      name: driver.name ?? "",
      email: driver.email ?? "",
      telephone: driver.telephone ?? "",
      notes: driver.notes ?? "",
    })
  }, [open, driver])

  const updateValue = (key: keyof FormState, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!values.name || !values.email) {
      toast.error("Name and email are required.")
      return
    }
    setLoading(true)
    try {
      const result = await updateDriver(
        driver.driver_id,
        {
          name: values.name,
          email: values.email,
          telephone: values.telephone || null,
          notes: values.notes || null,
        },
        accessToken
      )
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Driver updated.")
      setOpen(false)
      onUpdated?.()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update driver.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">Edit driver</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit driver</DialogTitle>
          <DialogDescription>Update driver details.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Driver name</label>
            <Input
              value={values.name}
              onChange={(event) => updateValue("name", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Email</label>
            <Input
              type="email"
              value={values.email}
              onChange={(event) => updateValue("email", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Telephone</label>
            <Input
              value={values.telephone}
              onChange={(event) => updateValue("telephone", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Notes</label>
            <Textarea
              value={values.notes}
              onChange={(event) => updateValue("notes", event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
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
