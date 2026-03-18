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
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { Shipment } from "@/lib/types"

type SectionKey =
  | "summary"
  | "locations"
  | "timing"
  | "parcels"
  | "driver"
  | "vehicle"
  | "stops"

type PrintSection = {
  key: SectionKey
  label: string
  checked: boolean
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-"
  return String(value)
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function renderRows(rows: Array<[string, unknown]>) {
  return rows
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(formatValue(value))}</td></tr>`
    )
    .join("")
}

export function ShipmentPrintDialog({
  open,
  onOpenChange,
  shipment,
  invoiceNumber,
  driverName,
  vehicleName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  shipment: Shipment
  invoiceNumber: string
  driverName?: string | null
  vehicleName?: string | null
}) {
  const [sections, setSections] = React.useState<PrintSection[]>([
    { key: "summary", label: "Summary", checked: true },
    { key: "locations", label: "Locations", checked: true },
    { key: "timing", label: "Dates and timing", checked: true },
    { key: "parcels", label: "Parcels", checked: true },
    { key: "driver", label: "Driver", checked: true },
    { key: "vehicle", label: "Vehicle", checked: true },
    { key: "stops", label: "Stops", checked: true },
  ])

  React.useEffect(() => {
    if (!open) return
    setSections((current) => current.map((section) => ({ ...section, checked: true })))
  }, [open])

  const toggleSection = (key: SectionKey, checked: boolean) => {
    setSections((current) =>
      current.map((section) =>
        section.key === key ? { ...section, checked } : section
      )
    )
  }

  const handlePrint = () => {
    const selectedKeys = new Set(
      sections.filter((section) => section.checked).map((section) => section.key)
    )
    if (selectedKeys.size === 0) {
      toast.error("Select at least one section to print.")
      return
    }

    const pickup =
      shipment.pickup_location?.name ??
      shipment.pickup_location?.full_address ??
      shipment.pickup_address?.name ??
      shipment.pickup_address?.full_address
    const dropoff =
      shipment.dropoff_location?.name ??
      shipment.dropoff_location?.full_address ??
      shipment.dropoff_address?.name ??
      shipment.dropoff_address?.full_address

    const blocks: string[] = []

    if (selectedKeys.has("summary")) {
      blocks.push(`
        <section>
          <h2>Summary</h2>
          <table>${renderRows([
            ["Shipment ID", shipment.shipment_id],
            ["Merchant order ref", shipment.merchant_order_ref],
            ["Status", shipment.status],
            ["Delivery note number", shipment.delivery_note_number],
            ["Invoice number", invoiceNumber],
            ["Invoiced at", formatDateTime(shipment.invoiced_at)],
          ])}</table>
        </section>
      `)
    }

    if (selectedKeys.has("locations")) {
      blocks.push(`
        <section>
          <h2>Locations</h2>
          <table>${renderRows([
            ["Pickup", pickup],
            ["Dropoff", dropoff],
            ["Pickup instructions", shipment.pickup_instructions],
            ["Dropoff instructions", shipment.dropoff_instructions],
          ])}</table>
        </section>
      `)
    }

    if (selectedKeys.has("timing")) {
      blocks.push(`
        <section>
          <h2>Dates and timing</h2>
          <table>${renderRows([
            ["Collection date", formatDateTime(shipment.collection_date)],
            ["Ready at", formatDateTime(shipment.ready_at)],
            ["Created at", formatDateTime(shipment.created_at)],
          ])}</table>
        </section>
      `)
    }

    if (selectedKeys.has("parcels")) {
      const parcelRows =
        shipment.parcels?.map(
          (parcel, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(formatValue(parcel.contents_description))}</td>
              <td>${escapeHtml(formatValue(parcel.weight_kg ?? parcel.weight))}</td>
              <td>${escapeHtml(
                `${formatValue(parcel.length_cm)} x ${formatValue(parcel.width_cm)} x ${formatValue(parcel.height_cm)}`
              )}</td>
            </tr>
          `
        ) ?? []
      blocks.push(`
        <section>
          <h2>Parcels</h2>
          <table>
            <thead>
              <tr><th>#</th><th>Description</th><th>Weight</th><th>Dimensions</th></tr>
            </thead>
            <tbody>${parcelRows.join("") || '<tr><td colspan="4">No parcels</td></tr>'}</tbody>
          </table>
        </section>
      `)
    }

    if (selectedKeys.has("driver")) {
      blocks.push(`
        <section>
          <h2>Driver</h2>
          <table>${renderRows([["Driver", driverName ?? "-"]])}</table>
        </section>
      `)
    }

    if (selectedKeys.has("vehicle")) {
      blocks.push(`
        <section>
          <h2>Vehicle</h2>
          <table>${renderRows([["Vehicle", vehicleName ?? "-"]])}</table>
        </section>
      `)
    }

    if (selectedKeys.has("stops")) {
      const stopRows =
        shipment.stops?.map(
          (stop, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(formatValue(stop.event_type))}</td>
              <td>${escapeHtml(
                formatValue(
                  stop.location?.name ??
                    stop.location?.full_address ??
                    stop.vehicle?.plate_number
                )
              )}</td>
              <td>${escapeHtml(formatDateTime(stop.occurred_at ?? stop.entered_at ?? stop.created_at))}</td>
            </tr>
          `
        ) ?? []
      blocks.push(`
        <section>
          <h2>Stops</h2>
          <table>
            <thead>
              <tr><th>#</th><th>Event</th><th>Location</th><th>Time</th></tr>
            </thead>
            <tbody>${stopRows.join("") || '<tr><td colspan="4">No stops</td></tr>'}</tbody>
          </table>
        </section>
      `)
    }

    const printDocument = `
      <!doctype html>
      <html>
        <head>
          <title>Shipment ${escapeHtml(shipment.merchant_order_ref ?? shipment.shipment_id)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin: 0 0 24px; font-size: 24px; }
            h2 { margin: 0 0 12px; font-size: 16px; }
            section { margin-bottom: 24px; break-inside: avoid; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
            th { width: 32%; background: #f9fafb; }
            thead th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Shipment ${escapeHtml(shipment.merchant_order_ref ?? shipment.shipment_id)}</h1>
          ${blocks.join("")}
        </body>
      </html>
    `

    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    iframe.setAttribute("aria-hidden", "true")
    document.body.appendChild(iframe)

    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove()
      }, 1000)
    }

    const iframeWindow = iframe.contentWindow
    if (!iframeWindow) {
      iframe.remove()
      toast.error("Unable to open the print view.")
      return
    }

    iframe.onload = () => {
      iframeWindow.focus()
      iframeWindow.print()
      onOpenChange(false)
      cleanup()
    }

    iframeWindow.document.open()
    iframeWindow.document.write(printDocument)
    iframeWindow.document.close()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Print shipment</DialogTitle>
          <DialogDescription>
            Choose which shipment information to include in the printout.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {sections.map((section) => (
            <div
              key={section.key}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <Label htmlFor={`print-${section.key}`}>{section.label}</Label>
              <Switch
                id={`print-${section.key}`}
                checked={section.checked}
                onCheckedChange={(checked) =>
                  toggleSection(section.key, Boolean(checked))
                }
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handlePrint}>
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
