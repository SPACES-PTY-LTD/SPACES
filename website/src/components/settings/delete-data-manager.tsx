"use client"

import * as React from "react"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/page-header"
import { purgeMerchantData, purgeDataTypes, type PurgeDataResponse, type PurgeDataType } from "@/lib/api/delete-data"
import { isApiErrorResponse } from "@/lib/api/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const labels: Record<PurgeDataType, string> = {
  shipments: "Shipments",
  runs: "Runs",
  vehicle_activity: "Vehicle activity",
  routes: "Routes",
  drivers: "Drivers",
  vehicles: "Vehicles",
  locations: "Locations",
  location_types: "Location types",
  api_call_logs: "API call logs",
  idempotency_keys: "Idempotency keys",
  activity_logs: "Activity logs",
}

function formatTypeLabel(value: string) {
  if (value in labels) {
    return labels[value as PurgeDataType]
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function DeleteDataManager({
  accessToken,
  merchantId,
}: {
  accessToken?: string
  merchantId?: string | null
}) {
  const [selectedTypes, setSelectedTypes] = React.useState<PurgeDataType[]>([])
  const [password, setPassword] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [result, setResult] = React.useState<PurgeDataResponse | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const merchantMissing = !merchantId

  function toggleType(type: PurgeDataType) {
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.filter((value) => value !== type)
        : [...current, type]
    )
  }

  function validateForm() {
    if (!merchantId) {
      toast.error("Select a merchant before deleting data.")
      return false
    }

    if (selectedTypes.length === 0) {
      toast.error("Select at least one data type to delete.")
      return false
    }

    if (!password.trim()) {
      toast.error("Password is required.")
      return false
    }

    return true
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!validateForm()) {
      return
    }

    setConfirmOpen(true)
  }

  async function confirmDelete() {
    if (!merchantId || !validateForm()) {
      return
    }

    setSubmitting(true)

    const response = await purgeMerchantData(
      merchantId,
      {
        merchant_id: merchantId,
        password: password.trim(),
        types: selectedTypes,
      },
      accessToken
    )

    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to delete data.")
      setSubmitting(false)
      return
    }

    if (!response.success) {
      toast.error("The delete data request was not accepted.")
      setSubmitting(false)
      return
    }

    setResult(response.data)
    setConfirmOpen(false)
    setPassword("")
    toast.success("Data deletion request completed.")
    setSubmitting(false)
  }

  return (
    <div className="space-y-6 flex-1">
      <PageHeader
        title="Permanent data deletion"
        description="Delete selected merchant data in bulk. This action is destructive and requires your password."
      />

      <Card>
        <CardHeader>
          <CardDescription>
            Choose the data sets to purge for the selected merchant, then confirm with your password. Vehicle activity can now be deleted on its own without removing runs, vehicles, or locations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Deleted records cannot be recovered from this screen. Review the selected types carefully before you continue.
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <Label>Data types</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {purgeDataTypes.map((type) => {
                  const checked = selectedTypes.includes(type)

                  return (
                    <label
                      key={type}
                      className={[
                        "flex items-start gap-3 rounded-lg border p-4 text-sm transition-colors",
                        checked
                          ? "border-destructive bg-destructive/5"
                          : "border-border hover:bg-muted/30",
                        merchantMissing || submitting ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={merchantMissing || submitting}
                        onChange={() => toggleType(type)}
                        className="mt-0.5 h-4 w-4 rounded border-input text-destructive focus:ring-destructive"
                      />
                      <span className="font-medium">{labels[type]}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-data-password">Password</Label>
              <Input
                id="delete-data-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={merchantMissing || submitting}
                placeholder="Enter your password"
              />
            </div>

            {merchantMissing ? (
              <div className="text-sm text-destructive">
                No merchant is selected. Choose a merchant first, then return to this page.
              </div>
            ) : null}

            <Button
              type="submit"
              variant="destructive"
              disabled={merchantMissing || submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete selected data
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm data deletion</DialogTitle>
            <DialogDescription>
              This will permanently delete the selected merchant data. Review the types below before continuing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-destructive">
              This action cannot be undone.
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Selected types</div>
              <div className="flex flex-wrap gap-2">
                {selectedTypes.map((type) => (
                  <Badge key={type} variant="outline">
                    {labels[type]}
                  </Badge>
                ))}
              </div>
            </div>

           
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Confirm delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Deletion results</CardTitle>
            <CardDescription>
              Merchant <span className="font-mono text-xs">{result.merchant_uuid}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {result.requested_types.map((type) => (
                <Badge key={`requested-${type}`} variant="outline">
                  {formatTypeLabel(type)}
                </Badge>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="text-sm font-medium">Requested types</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {result.requested_types.join(", ") || "None"}
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm font-medium">Processed types</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {result.processed_types.join(", ") || "None"}
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              {Object.entries(result.results).map(([type, details]) => (
                <div key={type} className="rounded-lg border">
                  <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                    <div className="font-medium">{formatTypeLabel(type)}</div>
                    <Badge variant="secondary">
                      {details.deleted_rows ?? 0} rows deleted
                    </Badge>
                  </div>
                  <div className="p-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Table</TableHead>
                          <TableHead className="text-right">Deleted rows</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(details.tables ?? {}).map(([tableName, count]) => (
                          <TableRow key={tableName}>
                            <TableCell className="font-mono text-xs">{tableName}</TableCell>
                            <TableCell className="text-right">{count}</TableCell>
                          </TableRow>
                        ))}
                        {Object.keys(details.tables ?? {}).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-sm text-muted-foreground">
                              No table-level details returned.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
