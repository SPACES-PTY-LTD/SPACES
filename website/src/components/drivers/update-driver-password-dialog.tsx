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
import { updateDriverPassword } from "@/lib/api/drivers"
import type { Driver } from "@/lib/types"

type FormState = {
  password: string
  confirmPassword: string
}

export function UpdateDriverPasswordDialog({
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
    password: "",
    confirmPassword: "",
  })

  React.useEffect(() => {
    if (!open) {
      setValues({ password: "", confirmPassword: "" })
    }
  }, [open])

  const updateValue = (key: keyof FormState, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!values.password || !values.confirmPassword) {
      toast.error("New password and confirmation are required.")
      return
    }

    if (values.password !== values.confirmPassword) {
      toast.error("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      const result = await updateDriverPassword(
        driver.driver_id,
        {
          password: values.password,
          password_confirmation: values.confirmPassword,
        },
        accessToken
      )

      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }

      toast.success("Driver password updated.")
      setOpen(false)
      onUpdated?.()
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to update driver password."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline">Update password</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update driver password</DialogTitle>
          <DialogDescription>
            Set a new password for this driver.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">New password</label>
            <Input
              type="password"
              value={values.password}
              onChange={(event) => updateValue("password", event.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              Confirm new password
            </label>
            <Input
              type="password"
              value={values.confirmPassword}
              onChange={(event) =>
                updateValue("confirmPassword", event.target.value)
              }
              placeholder="••••••••"
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
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
