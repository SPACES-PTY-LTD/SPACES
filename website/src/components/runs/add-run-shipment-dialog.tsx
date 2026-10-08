"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ShipmentCombobox } from "@/components/shipments/shipment-combobox"
import { ShipmentQuoteDialog, type ShipmentQuoteFormValues } from "@/components/shipments/shipment-quote-dialog"
import { isApiErrorResponse } from "@/lib/api/client"

export function AddRunShipmentDialog({ merchantId, accessToken, shipmentIds, runId, environmentId, onCreate, onAttach }: {
  merchantId?: string
  accessToken?: string
  shipmentIds: string[]
  runId: string
  environmentId?: string | null
  onCreate: (values: ShipmentQuoteFormValues) => Promise<unknown>
  onAttach: (shipmentId: string) => Promise<unknown>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [shipmentId, setShipmentId] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)

  function changeOpen(next: boolean) {
    if (submitting.current) return
    setOpen(next)
    if (!next) { setShipmentId(""); setError("") }
  }

  async function attach() {
    if (!shipmentId || submitting.current) return
    submitting.current = true
    setBusy(true)
    setError("")
    try {
      const result = await onAttach(shipmentId)
      if (isApiErrorResponse(result)) {
        setError(result.message)
        return
      }
      setOpen(false)
      setShipmentId("")
      toast.success("Shipment added to run.")
      router.refresh()
    } catch {
      setError("Unable to add the shipment. Please try again.")
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button disabled={!merchantId}><Plus className="size-4" />Add shipment</Button></DialogTrigger>
    <DialogContent showCloseButton={!busy}>
      <DialogHeader>
        <DialogTitle>Add shipment to run</DialogTitle>
        <DialogDescription>Select an existing shipment for this merchant or create a new one.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label>Existing shipment</Label>
        <ShipmentCombobox key={open ? "open" : "closed"} value={shipmentId} onChange={value => { setShipmentId(value); setError("") }} merchantId={merchantId} token={accessToken} disabled={busy} excludeIds={shipmentIds} runId={runId} environmentId={environmentId} />
        <p className="text-xs text-muted-foreground">Search by shipment reference. Completed, cancelled, and already assigned shipments cannot be added.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter className="sm:justify-between">
        <ShipmentQuoteDialog merchantId={merchantId} title="Create shipment for this run" description="Capture pickup, destination, and parcel details. The shipment will be added to this run." triggerLabel="Create new shipment" submitLabel="Create and add shipment" trigger={<Button variant="outline" disabled={busy}>Create new shipment</Button>} includeOrderRef includeInvoicedAt={false} onSubmit={async values => {
          const result = await onCreate(values)
          if (!isApiErrorResponse(result)) {
            changeOpen(false)
            toast.success("Shipment created and added to run.")
            router.refresh()
          }
          return result
        }} />
        <Button disabled={busy || !shipmentId} onClick={() => void attach()}>{busy ? "Adding…" : "Add shipment"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
