"use client"

import * as React from "react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ShipmentCombobox } from "@/components/shipments/shipment-combobox"
import { isApiErrorResponse } from "@/lib/api/client"
import { listShipmentQuotes } from "@/lib/api/shipments"

export type ResourceField = {
  name: string
  label: string
  type?:
    | "text"
    | "email"
    | "number"
    | "textarea"
    | "select"
    | "shipment_search"
    | "shipment_quotes"
  placeholder?: string
  required?: boolean
  options?: { label: string; value: string }[]
  dependsOn?: string
}

export function CreateResourceDialog({
  title,
  description,
  fields,
  onSubmit,
  triggerLabel = "Create",
  shipmentSearchToken,
  shipmentMerchantId,
}: {
  title: string
  description?: string
  fields: ResourceField[]
  triggerLabel?: string
  onSubmit?: (values: Record<string, string>) => Promise<unknown> | void
  shipmentSearchToken?: string | null
  shipmentMerchantId?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [shipmentQuotes, setShipmentQuotes] = React.useState<
    { label: string; value: string }[]
  >([])
  const [shipmentQuotesLoading, setShipmentQuotesLoading] =
    React.useState(false)
  const [shipmentQuotesError, setShipmentQuotesError] = React.useState<
    string | null
  >(null)

  const shipmentQuotesField = fields.find(
    (field) => field.type === "shipment_quotes"
  )
  const shipmentId = shipmentQuotesField?.dependsOn
    ? values[shipmentQuotesField.dependsOn]
    : ""

  React.useEffect(() => {
    if (!shipmentQuotesField) return
    if (shipmentQuotesField.name) {
      setValues((prev) => {
        if (!prev[shipmentQuotesField.name]) return prev
        const next = { ...prev }
        delete next[shipmentQuotesField.name]
        return next
      })
    }
    if (!shipmentId) {
      setShipmentQuotes([])
      setShipmentQuotesError(null)
      return
    }
    let cancelled = false
    setShipmentQuotesLoading(true)
    listShipmentQuotes(shipmentId, shipmentSearchToken, {
      merchant_id: shipmentMerchantId,
    })
      .then((response) => {
        if (cancelled) return
        if (isApiErrorResponse(response)) {
          setShipmentQuotesError(response.message)
          setShipmentQuotes([])
          return
        }
        const options = (response.data ?? []).map((quote) => ({
          value: quote.quote_id,
          label: `${quote.quote_id} • ${quote.status ?? "unknown"}`,
        }))
        setShipmentQuotes(options)
        setShipmentQuotesError(null)
      })
      .catch((error) => {
        if (cancelled) return
        setShipmentQuotesError(
          error instanceof Error ? error.message : "Failed to load quotes."
        )
        setShipmentQuotes([])
      })
      .finally(() => {
        if (cancelled) return
        setShipmentQuotesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [shipmentId, shipmentMerchantId, shipmentQuotesField, shipmentSearchToken])

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {}
    fields.forEach((field) => {
      if (field.required && !values[field.name]) {
        nextErrors[field.name] = "Required"
      }
    })

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    try {
      const result = await onSubmit?.(values)
      if (isApiErrorResponse(result)) {
        setSubmitError(result.message)
        toast.error(result.message)
        return
      }
      setOpen(false)
      setValues({})
      setSubmitError(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create resource."
      setSubmitError(message)
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="grid gap-4">
          {submitError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {submitError}
            </div>
          ) : null}
          {fields.map((field) => {
            const value = values[field.name] ?? ""
            return (
              <div key={field.name} className="space-y-2">
                <Label>{field.label}</Label>
                {field.type === "textarea" ? (
                  <Textarea
                    placeholder={field.placeholder}
                    value={value}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        [field.name]: event.target.value,
                      }))
                    }
                  />
                ) : field.type === "select" ? (
                  <Select
                    value={value}
                    onValueChange={(nextValue) =>
                      setValues((prev) => ({
                        ...prev,
                        [field.name]: nextValue,
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={field.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options ?? []).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "shipment_search" ? (
                  <ShipmentCombobox
                    value={value}
                    placeholder={field.placeholder ?? "Search shipments..."}
                    token={shipmentSearchToken}
                    merchantId={shipmentMerchantId}
                    onChange={(nextValue) =>
                      setValues((prev) => ({
                        ...prev,
                        [field.name]: nextValue,
                      }))
                    }
                  />
                ) : field.type === "shipment_quotes" ? (
                  <div className="space-y-2">
                    <Select
                      value={value}
                      onValueChange={(nextValue) =>
                        setValues((prev) => ({
                          ...prev,
                          [field.name]: nextValue,
                        }))
                      }
                      disabled={!shipmentId || shipmentQuotesLoading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            shipmentId
                              ? field.placeholder ?? "Select a quote"
                              : "Select shipment first"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {shipmentQuotesLoading ? (
                          <SelectItem value="__loading__" disabled>
                            Loading quotes...
                          </SelectItem>
                        ) : null}
                        {shipmentQuotesError ? (
                          <SelectItem value="__error__" disabled>
                            {shipmentQuotesError}
                          </SelectItem>
                        ) : null}
                        {shipmentQuotes.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {shipmentId &&
                    !shipmentQuotesLoading &&
                    !shipmentQuotesError &&
                    shipmentQuotes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No quotes found.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <Input
                    type={field.type ?? "text"}
                    placeholder={field.placeholder}
                    value={value}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        [field.name]: event.target.value,
                      }))
                    }
                  />
                )}
                {errors[field.name] ? (
                  <p className="text-xs text-destructive">
                    {errors[field.name]}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
