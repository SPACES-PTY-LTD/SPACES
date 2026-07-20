"use client"

import * as React from "react"
import { Loader2, Plus, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  analyzeDeliveryNote, confirmDeliveryNoteImport,
} from "@/lib/api/delivery-note-imports"
import { isApiErrorResponse } from "@/lib/api/client"
import type {
  DeliveryNoteAddress, DeliveryNoteExtraction, DeliveryNoteLineItem, Run,
} from "@/lib/types"

const emptyAddress = (): DeliveryNoteAddress => ({
  name: "", company: "", address_line_1: "", address_line_2: "", town: "",
  city: "", province: "", post_code: "", country: "", first_name: "",
  last_name: "", phone: "",
})

const emptyLine = (): DeliveryNoteLineItem => ({
  merchant_order_ref: "", description: "", quantity: 1, type: "",
  weight: null, length_cm: null, width_cm: null, height_cm: null,
})

const emptyExtraction = (): DeliveryNoteExtraction => ({
  delivery_note_number: "", merchant_order_ref: "", collection_date: "",
  pickup_address: emptyAddress(), dropoff_address: emptyAddress(),
  pickup_instructions: "", dropoff_instructions: "", line_items: [emptyLine()],
})

export function DeliveryNoteImportDrawer({
  run, accessToken, open, onOpenChange, onConfirmed,
}: {
  run: Run
  accessToken: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmed: (run: Run) => void
}) {
  const [file, setFile] = React.useState<File | null>(null)
  const [importId, setImportId] = React.useState("")
  const [data, setData] = React.useState<DeliveryNoteExtraction>(emptyExtraction)
  const [mode, setMode] = React.useState<"separate_shipments" | "single_shipment">("separate_shipments")
  const [analyzing, setAnalyzing] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)

  const reset = React.useCallback(() => {
    setFile(null)
    setImportId("")
    setData(emptyExtraction())
    setMode("separate_shipments")
  }, [])

  const setAddress = (
    side: "pickup_address" | "dropoff_address",
    key: keyof DeliveryNoteAddress,
    value: string
  ) => setData((current) => ({ ...current, [side]: { ...current[side], [key]: value } }))

  const setLine = (index: number, key: keyof DeliveryNoteLineItem, value: string) => {
    setData((current) => ({
      ...current,
      line_items: current.line_items.map((item, itemIndex) => itemIndex === index
        ? {
            ...item,
            [key]: ["quantity", "weight", "length_cm", "width_cm", "height_cm"].includes(key)
              ? (value === "" ? null : Number(value))
              : value,
          }
        : item),
    }))
  }

  const analyze = async () => {
    if (!file) return toast.error("Choose a delivery note first.")
    setAnalyzing(true)
    const response = await analyzeDeliveryNote(run.run_id, file, accessToken)
    setAnalyzing(false)
    if (isApiErrorResponse(response)) return toast.error(response.message)
    setImportId(response.data.import_id)
    setData({
      ...emptyExtraction(),
      ...response.data.extracted_data,
      pickup_address: { ...emptyAddress(), ...response.data.extracted_data?.pickup_address },
      dropoff_address: { ...emptyAddress(), ...response.data.extracted_data?.dropoff_address },
      line_items: response.data.extracted_data?.line_items?.length
        ? response.data.extracted_data.line_items
        : [emptyLine()],
      collection_date: response.data.extracted_data?.collection_date?.slice(0, 10) ?? "",
    })
  }

  const confirm = async () => {
    setConfirming(true)
    const response = await confirmDeliveryNoteImport(
      run.run_id, importId, { ...data, grouping_mode: mode }, accessToken
    )
    setConfirming(false)
    if (isApiErrorResponse(response)) return toast.error(response.message)
    toast.success(`${response.data.shipment_ids.length} shipment(s) created and attached.`)
    onConfirmed(response.data.run)
    onOpenChange(false)
    reset()
  }

  const addressFields: Array<[keyof DeliveryNoteAddress, string]> = [
    ["name", "Location name"], ["company", "Company"], ["address_line_1", "Address line 1"],
    ["address_line_2", "Address line 2"], ["town", "Town"], ["city", "City"],
    ["province", "Province"], ["post_code", "Post code"], ["country", "Country"],
    ["first_name", "Contact first name"], ["last_name", "Contact last name"], ["phone", "Phone"],
  ]

  return (
    <Drawer open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset() }}>
      <DrawerContent side="right" className="sm:w-[min(96vw,1100px)]">
        <DrawerHeader>
          <DrawerTitle>Upload Delivery Note</DrawerTitle>
          <DrawerDescription>
            AI extracts a draft only. Review all shipment information before confirming.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {!importId ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <Label htmlFor="delivery-note-file" className="text-base font-medium">Delivery note</Label>
              <p className="mb-4 text-sm text-muted-foreground">PDF, JPEG, PNG or WebP, up to 20 MB.</p>
              <Input
                id="delivery-note-file" type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Delivery note number" value={data.delivery_note_number ?? ""} onChange={(value) => setData({ ...data, delivery_note_number: value })} />
                <Field label="Collection / delivery date" type="date" value={data.collection_date ?? ""} onChange={(value) => setData({ ...data, collection_date: value })} />
                <div className="space-y-2">
                  <Label>Line-item grouping</Label>
                  <Select value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="separate_shipments">Separate shipment per line item</SelectItem>
                      <SelectItem value="single_shipment">One shipment, line items as parcels</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {mode === "single_shipment" ? (
                <Field label="Shipment reference" value={data.merchant_order_ref ?? ""} onChange={(value) => setData({ ...data, merchant_order_ref: value })} />
              ) : null}

              <div className="grid gap-6 lg:grid-cols-2">
                {(["pickup_address", "dropoff_address"] as const).map((side) => (
                  <div key={side} className="space-y-3 rounded-lg border p-4">
                    <h3 className="font-semibold">{side === "pickup_address" ? "Origin / pickup" : "Destination / drop-off"}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {addressFields.map(([key, label]) => (
                        <Field key={key} label={label} value={String(data[side]?.[key] ?? "")} onChange={(value) => setAddress(side, key, value)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Pickup instructions</Label><Textarea value={data.pickup_instructions ?? ""} onChange={(event) => setData({ ...data, pickup_instructions: event.target.value })} /></div>
                <div className="space-y-2"><Label>Drop-off instructions</Label><Textarea value={data.dropoff_instructions ?? ""} onChange={(event) => setData({ ...data, dropoff_instructions: event.target.value })} /></div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Line items</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => setData({ ...data, line_items: [...data.line_items, emptyLine()] })}>
                    <Plus className="mr-2 h-4 w-4" />Add row
                  </Button>
                </div>
                <Table className="min-w-[1050px]">
                  <TableHeader><TableRow>
                    {mode === "separate_shipments" ? <TableHead className="w-44">Shipment reference</TableHead> : null}
                    <TableHead className="w-60">Description</TableHead><TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-32">Type</TableHead><TableHead className="w-28">Weight kg</TableHead>
                    <TableHead className="w-28">Length cm</TableHead><TableHead className="w-28">Width cm</TableHead>
                    <TableHead className="w-28">Height cm</TableHead><TableHead className="w-14" />
                  </TableRow></TableHeader>
                  <TableBody>{data.line_items.map((item, index) => (
                    <TableRow key={index}>
                      {mode === "separate_shipments" ? <TableCell><Input value={item.merchant_order_ref ?? ""} onChange={(e) => setLine(index, "merchant_order_ref", e.target.value)} /></TableCell> : null}
                      <TableCell><Input value={item.description ?? ""} onChange={(e) => setLine(index, "description", e.target.value)} /></TableCell>
                      {(["quantity", "type", "weight", "length_cm", "width_cm", "height_cm"] as const).map((key) => (
                        <TableCell key={key}><Input type={key === "type" ? "text" : "number"} min={key === "quantity" ? 1 : 0} value={item[key] ?? ""} onChange={(e) => setLine(index, key, e.target.value)} /></TableCell>
                      ))}
                      <TableCell><Button type="button" size="icon" variant="ghost" disabled={data.line_items.length === 1} onClick={() => setData({ ...data, line_items: data.line_items.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <DrawerFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!importId ? (
            <Button onClick={() => void analyze()} disabled={!file || analyzing}>
              {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {analyzing ? "Analyzing..." : "Upload and analyze"}
            </Button>
          ) : (
            <Button onClick={() => void confirm()} disabled={confirming}>
              {confirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {confirming ? "Creating shipments..." : "Create and attach shipments"}
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function Field({ label, value, onChange, type = "text" }: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>
}
