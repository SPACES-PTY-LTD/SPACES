import { AddRunShipmentDialog } from "@/components/runs/add-run-shipment-dialog"
import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type { ApiEnvelope, Run } from "@/lib/types"
import { ShipmentQuoteDialog, type ShipmentQuoteFormValues } from "@/components/shipments/shipment-quote-dialog"
import { createShipment } from "@/lib/api/shipments"
import { requireAuth } from "@/lib/auth"
import { AdminLinks, AdminRoute } from "@/lib/routes/admin"
import { shipmentCreatePayload } from "@/lib/shipment-create-payload"
import { revalidatePath } from "next/cache"

export function NewShipmentButton({ merchantId, runId, shipmentIds = [], accessToken, environmentId }: {
  merchantId?: string; runId?: string; shipmentIds?: string[]; accessToken?: string; environmentId?: string | null
}) {
  const createShipmentAction = async (values: ShipmentQuoteFormValues) => {
    "use server"
    const session = await requireAuth()
    const payload = shipmentCreatePayload(values, environmentId ?? undefined)
    const result = runId
      ? await apiFetch<ApiEnvelope<Run>>(`/api/v1/runs/${runId}/shipments/create`, { method: "POST", body: { ...payload, merchant_id: merchantId }, token: session.accessToken })
      : await createShipment(payload, session.accessToken)
    if (isApiErrorResponse(result)) {
      return { error: true, message: result.message }
    }
    if (runId) revalidatePath(AdminRoute.runDetails(runId))
    revalidatePath(AdminLinks.runs)
    revalidatePath(AdminLinks.shipments)
    revalidatePath(AdminLinks.reportsShipments)
  }

  const attachShipmentAction = async (shipmentId: string) => {
    "use server"
    const session = await requireAuth()
    const result = await apiFetch<ApiEnvelope<Run>>(`/api/v1/runs/${runId}/shipments`, {
      method: "POST", body: { shipment_ids: [shipmentId] }, token: session.accessToken,
    })
    if (!isApiErrorResponse(result)) {
      revalidatePath(AdminRoute.runDetails(runId!))
      revalidatePath(AdminLinks.runs)
      revalidatePath(AdminLinks.shipments)
    }
    return result
  }

  if (runId) return <AddRunShipmentDialog merchantId={merchantId} accessToken={accessToken} shipmentIds={shipmentIds} runId={runId} environmentId={environmentId} onCreate={createShipmentAction} onAttach={attachShipmentAction} />

  return (
    <ShipmentQuoteDialog
      merchantId={merchantId}
      environmentId={environmentId ?? undefined}
      token={accessToken}
      title="Create shipment"
      description="Capture pickup, destination, and parcel details."
      triggerLabel="New shipment"
      includeOrderRef
      includeInvoicedAt={false}
      onSubmit={createShipmentAction}
    />
  )
}
