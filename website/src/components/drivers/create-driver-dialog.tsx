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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isApiErrorResponse } from "@/lib/api/client"
import { createDriver } from "@/lib/api/drivers"
import { listCarriers } from "@/lib/api/carriers"
import type { Carrier } from "@/lib/types"

type FormState = {
  name: string
  email: string
  password: string
  telephone: string
  carrierId: string
}

export function CreateDriverDialog({
  accessToken,
  role,
}: {
  accessToken?: string
  role?: string
}) {
  const router = useRouter()
  const isUserRole = role === "user"
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [carriers, setCarriers] = React.useState<Carrier[]>([])
  const [values, setValues] = React.useState<FormState>({
    name: "",
    email: "",
    password: "",
    telephone: "",
    carrierId: "",
  })

  React.useEffect(() => {
    if (!open) return
    let active = true
    ;(async () => {
      try {
        const requests = []
        if (!isUserRole) {
          requests.unshift(listCarriers(accessToken))
        }
        const responses = await Promise.all(requests)
        const carrierResponse = isUserRole ? null : responses[0]
        if (!active) return
        if (carrierResponse && isApiErrorResponse(carrierResponse)) {
          toast.error(carrierResponse.message)
          return
        }
        setCarriers(carrierResponse?.data ?? [])
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load form data."
        )
      }
    })()
    return () => {
      active = false
    }
  }, [open, accessToken, isUserRole])

  const updateValue = (key: keyof FormState, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const reset = () => {
    setValues({
      name: "",
      email: "",
      password: "",
      telephone: "",
      carrierId: "",
    })
  }

  const handleSubmit = async () => {
    const needsCarrier = !isUserRole
    if (
      !values.name ||
      !values.email ||
      !values.password ||
      !values.telephone
    ) {
      console.log("Validation failed", values)
      toast.error("Fill in all required fields.")
      return
    }
    if (needsCarrier && !values.carrierId) {
      console.log("Validation failed", values)
      toast.error("Fill in all required fields.")
      return
    }
    setLoading(true)
    try {
      const payload = {
        name: values.name,
        email: values.email,
        password: values.password,
        telephone: values.telephone,
        ...(needsCarrier ? { carrier_id: values.carrierId } : {}),
      }
      const result = await createDriver(payload, accessToken)
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Driver created.")
      setOpen(false)
      reset()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create driver.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New driver</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create driver</DialogTitle>
          <DialogDescription>
            {isUserRole
              ? "Create a new driver account."
              : "Assign a carrier during creation."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Driver name</label>
            <Input
              value={values.name}
              onChange={(event) => updateValue("name", event.target.value)}
              placeholder=""
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Email</label>
            <Input
              type="email"
              value={values.email}
              onChange={(event) => updateValue("email", event.target.value)}
              placeholder=""
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Password</label>
            <Input
              type="password"
              value={values.password}
              onChange={(event) => updateValue("password", event.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Telephone</label>
            <Input
              value={values.telephone}
              onChange={(event) => updateValue("telephone", event.target.value)}
              placeholder="+27123456789"
            />
          </div>
          {!isUserRole && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Carrier</label>
              <Select
                value={values.carrierId}
                onValueChange={(value) => updateValue("carrierId", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select carrier" />
                </SelectTrigger>
                <SelectContent>
                  {carriers.map((carrier) => {
                    const carrierId = carrier.carrier_id
                    if (!carrierId) return null
                    return (
                      <SelectItem key={carrierId} value={carrierId}>
                        {carrier.name}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false)
              reset()
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating..." : "Create driver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
