"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  listTrackingProviders,
  activateTrackingProvider,
  getTrackingProviderImportsStatuses,
  importTrackingProviderVehicles,
  importTrackingProviderDrivers,
  importTrackingProviderLocations,
  type TrackingProviderImportStats,
} from "@/lib/api/tracking-providers"
import { isApiErrorResponse } from "@/lib/api/client"
import type { TrackingProvider, TrackingProviderFormField } from "@/lib/types"
import { Import, Loader2, MapPin, Plug, User2 } from "lucide-react"

function getFieldLabel(field: TrackingProviderFormField) {
  return field.label ?? field.name
}

function getFieldType(field: TrackingProviderFormField) {
  const type = (field.type ?? "text").toLowerCase()
  if (["text", "password", "email", "number", "url", "date", "datetime-local"].includes(type)) {
    return type
  }
  if (["boolean", "bool"].includes(type)) {
    return "boolean"
  }
  if (type === "select" || field.options?.length) {
    return "select"
  }
  return "text"
}

function coerceValue(field: TrackingProviderFormField, value: string) {
  const type = getFieldType(field)
  if (type === "number") {
    const number = Number(value)
    return Number.isNaN(number) ? value : number
  }
  if (type === "boolean") {
    return value === "true"
  }
  return value
}

function isProviderActivated(provider: TrackingProvider) {
  return Boolean(provider.activated ?? provider.active ?? provider.is_active)
}

function canImportFromProvider(
  provider: TrackingProvider,
  entity: "vehicles" | "drivers" | "locations"
) {
  if (entity === "drivers") {
    return Boolean(provider.has_driver_importing)
  }
  if (entity === "locations") {
    return Boolean(provider.has_locations_importing)
  }
  return Boolean(provider.has_vehicle_importing)
}

export function TrackingProviders({
  accessToken,
  merchantId,
}: {
  accessToken?: string
  merchantId?: string | null
}) {
  const [providers, setProviders] = React.useState<TrackingProvider[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedProvider, setSelectedProvider] = React.useState<TrackingProvider | null>(null)
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogMode, setDialogMode] = React.useState<"list" | "form">("list")
  const [importDialogOpen, setImportDialogOpen] = React.useState(false)
  const [importingProviderId, setImportingProviderId] = React.useState<string>("")
  const [importingProviderName, setImportingProviderName] = React.useState<string>("")
  const [importStatus, setImportStatus] = React.useState<
    "options" | "processing" | "done" | "error"
  >(
    "options"
  )
  const [importEntity, setImportEntity] = React.useState<"vehicles" | "drivers" | "locations">(
    "vehicles"
  )
  const [importOptions, setImportOptions] = React.useState<{
    only_with_geofences: boolean
    filter_type: string
    wildcard: string
  }>({
    only_with_geofences: false,
    filter_type: "",
    wildcard: "",
  })
  const [importStats, setImportStats] = React.useState<TrackingProviderImportStats | null>(null)
  const [importErrorMessage, setImportErrorMessage] = React.useState<string>("")
  const pollTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadProviders = React.useCallback(async () => {
    setLoading(true)
    console.log("Loading providers with merchantId:", merchantId)
    const response = await listTrackingProviders(accessToken, merchantId)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to load tracking providers.")
      setLoading(false)
      return
    }
    setProviders(response.data ?? [])
    setLoading(false)
  }, [accessToken, merchantId])

  React.useEffect(() => {
    loadProviders()
  }, [loadProviders])

  const openProviderForm = (provider: TrackingProvider) => {
    const integrationData = provider.integration_data ?? {}
    const initialValues: Record<string, string> = {}
    provider.form_fields?.forEach((field) => {
      const value = (integrationData as Record<string, unknown>)[field.name]
      if (value === undefined || value === null) {
        initialValues[field.name] = ""
        return
      }
      initialValues[field.name] = String(value)
    })
    setValues(initialValues)
    setSelectedProvider(provider)
    setDialogMode("form")
    setDialogOpen(true)
  }

  const openProviderList = () => {
    setDialogMode("list")
    setSelectedProvider(null)
    setValues({})
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setSelectedProvider(null)
    setValues({})
    setDialogMode("list")
    setDialogOpen(false)
  }

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const clearImportPolling = React.useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
  }, [])

  React.useEffect(() => {
    return () => {
      clearImportPolling()
    }
  }, [clearImportPolling])

  function openImportOptions(provider: TrackingProvider, entity: "vehicles" | "drivers" | "locations") {
    if (!merchantId) {
      toast.error("Please select a merchant before importing.")
      return
    }

    setImportEntity(entity)
    setImportingProviderId(provider.provider_id)
    setImportingProviderName(provider.name)
    setImportDialogOpen(true)
    setImportStatus("options")
    setImportStats(null)
    setImportErrorMessage("")
    clearImportPolling()
    setImportOptions({
      only_with_geofences: false,
      filter_type: entity === "drivers" ? "name" : entity === "vehicles" ? "registration" : "",
      wildcard: "",
    })
  }

  const finishFromStats = React.useCallback(
    (stats: TrackingProviderImportStats) => {
      setImportStats(stats)
      const inProgressAt = stats.inprogress?.[importEntity]
      if (inProgressAt) {
        return false
      }

      const lastError = stats.last_import_errors?.[importEntity]
      if (lastError) {
        setImportStatus("error")
        setImportErrorMessage(lastError)
        return true
      }

      setImportStatus("done")
      toast.success(
        `${importEntity === "drivers" ? "Driver" : importEntity === "locations" ? "Location" : "Vehicle"} import complete.`
      )
      return true
    },
    [importEntity]
  )

  const scheduleImportStatusPoll = React.useCallback(() => {
    clearImportPolling()
    pollTimeoutRef.current = setTimeout(async () => {
      if (!merchantId) return
      const statusResponse = await getTrackingProviderImportsStatuses(merchantId, accessToken)
      if (isApiErrorResponse(statusResponse)) {
        setImportStatus("error")
        setImportErrorMessage(statusResponse.message || "Failed to check import status.")
        return
      }

      const done = finishFromStats(statusResponse)
      if (!done) {
        scheduleImportStatusPoll()
      }
    }, 10000)
  }, [accessToken, clearImportPolling, finishFromStats, merchantId])

  async function runImport() {
    if (!merchantId || !importingProviderId) {
      toast.error("Please select a merchant before importing.")
      return
    }

    setImportStatus("processing")
    const response =
      importEntity === "vehicles"
        ? await importTrackingProviderVehicles(
            importingProviderId,
            merchantId,
            {
              filter_type: importOptions.filter_type as "registration" | "description",
              wildcard: importOptions.wildcard || undefined,
            },
            accessToken
          )
        : importEntity === "drivers"
          ? await importTrackingProviderDrivers(
              importingProviderId,
              merchantId,
              {
                filter_type: importOptions.filter_type as "name" | "fmdriverid" | "employeenumber",
                wildcard: importOptions.wildcard || undefined,
              },
              accessToken
            )
          : await importTrackingProviderLocations(
              importingProviderId,
              merchantId,
              { only_with_geofences: importOptions.only_with_geofences },
              accessToken
            )

    if (isApiErrorResponse(response)) {
      setImportStatus("error")
      setImportErrorMessage(
        response.message ||
          `${importEntity === "drivers" ? "Driver" : importEntity === "locations" ? "Location" : "Vehicle"} import failed.`
      )
      return
    }
    setImportStats(response.imports_stats ?? null)
    if (response.already_in_progress) {
      toast.info("Import already in progress. Monitoring status...")
    } else if (response.queued) {
      toast.success("Import queued. Monitoring status...")
    }

    const finished = response.imports_stats ? finishFromStats(response.imports_stats) : false
    if (!finished) {
      scheduleImportStatusPoll()
    }
  }

  const handleSubmit = async () => {
    if (!selectedProvider) return
    const fields = selectedProvider.form_fields ?? []
    const missingRequired = fields.find((field) => field.required && !values[field.name])
    if (missingRequired) {
      toast.error(`Please fill in ${getFieldLabel(missingRequired)}.`)
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {}
      fields.forEach((field) => {
        const value = values[field.name] ?? ""
        if (value !== "") {
          payload[field.name] = coerceValue(field, value)
        }
      })
      await activateTrackingProvider(selectedProvider.provider_id, payload, accessToken)
      toast.success("Provider activated.")
      closeDialog()
      await loadProviders()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to activate provider.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    
      {providers.filter((provider) => isProviderActivated(provider)).map((provider) => {
        const imageUrl = provider.logo_file_name ?? null
        return (
          <div
            key={provider.provider_id}
            className="rounded-md border "
          >
            <button
              type="button"
              onClick={() => openProviderForm(provider)}
              className="rounded-md p-3 text-center flex items-center justify-center flex-col w-full"
            >
              <Avatar className="mb-1 h-16 w-72 text-xl">
                {imageUrl ? (
                  <AvatarImage
                    className="object-contain"
                    src={"/tracking_providers/" + imageUrl} alt={provider.name} />
                ) : null}
                <AvatarFallback className="text-4xl font-bold">
                  {provider.name?.charAt(0) ?? "?"}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-bold text-md">{provider.name}</h3>
            </button>

            <div className="p-3">
              <Button
                variant={"ghost"}
                type="button"
                onClick={() => openProviderForm(provider)}
                className="w-full text-left flex justify-start cursor-pointer"
              >
                <Plug className="mr-2 h-4 w-4" />
                <div>Edit connection details</div>
              </Button>
              {canImportFromProvider(provider, "vehicles") ? (
                <Button
                  variant={"ghost"}
                  className="w-full text-left flex justify-start cursor-pointer"
                  onClick={() => openImportOptions(provider, "vehicles")}
                >
                  <Import className="mr-2 h-4 w-4" />
                  <div>Import Vehicles</div>
                </Button>
              ) : null}
              {canImportFromProvider(provider, "drivers") ? (
                <Button
                  variant={"ghost"}
                  className="w-full text-left flex justify-start cursor-pointer"
                  onClick={() => openImportOptions(provider, "drivers")}
                >
                  <User2 className="mr-2 h-4 w-4" />
                  <div>Import Drivers</div>
                </Button>
              ) : null}
              {canImportFromProvider(provider, "locations") ? (
                <Button
                  variant={"ghost"}
                  className="w-full text-left flex justify-start cursor-pointer"
                  onClick={() => openImportOptions(provider, "locations")}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  <div>Import Locations</div>
                </Button>
              ) : null}
            </div>
          </div>
        )
      })}

      {loading ? (
        <div className="rounded-md border-dashed bg-secondary border p-3 text-center flex items-center justify-center flex-col">
          <div className="mb-4 bg-background flex h-16 w-16 items-center justify-center rounded-full border border-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
          <h3 className="font-bold text-md">Loading integrations...</h3>
        </div>
      ) : (
        <button
          className="rounded-md border-dashed bg-secondary border p-3 text-center flex items-center justify-center flex-col"
          onClick={openProviderList}
          type="button"
        >
          <div className="mb-4 bg-background flex h-16 w-16 items-center justify-center rounded-full border border-muted">
            <span className="text-xl font-semibold">+</span>
          </div>
          <h3 className="font-bold text-md">Add Provider</h3>
        </button>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          {dialogMode === "list" ? (
            <>
              <DialogHeader>
                <DialogTitle>Add Provider</DialogTitle>
                <DialogDescription>
                  Select a provider to configure.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                {providers
                  .filter((provider) => !isProviderActivated(provider))
                  .map((provider) => {
                  const imageUrl = "/tracking_providers/"+(provider.image_url ?? provider.logo_url ?? null)
                  return (
                    <button
                      key={provider.provider_id}
                      type="button"
                      className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-left"
                      onClick={() => openProviderForm(provider)}
                    >
                      <Avatar className="h-10 w-10 text-sm">
                        {imageUrl ? (
                          <AvatarImage src={imageUrl} alt={provider.name} />
                        ) : null}
                        <AvatarFallback>
                          {provider.name?.charAt(0) ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">{provider.name}</div>
                        {provider.active || provider.is_active || provider.activated ? (
                          <div className="text-xs text-muted-foreground">Active</div>
                        ) : null}
                      </div>
                    </button>
                    )
                  })}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{selectedProvider?.name ?? "Provider"}</DialogTitle>
                {selectedProvider?.form_fields && selectedProvider.form_fields.length > 0 ? null : (
                  <DialogDescription>
                    Configure the provider credentials and settings.
                  </DialogDescription>
                )}
              </DialogHeader>
              <div className="grid gap-4">
                {(selectedProvider?.form_fields ?? []).map((field) => {
                  const fieldType = getFieldType(field)
                  const fieldValue = values[field.name] ?? ""
                  return (
                    <div key={field.name} className="space-y-2">
                      <label className="text-xs text-muted-foreground">
                        {getFieldLabel(field)}
                      </label>
                      {fieldType === "select" && field.options?.length ? (
                        <Select
                          value={fieldValue}
                          onValueChange={(value) => handleChange(field.name, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : fieldType === "boolean" ? (
                        <Select
                          value={fieldValue}
                          onValueChange={(value) => handleChange(field.name, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">True</SelectItem>
                            <SelectItem value="false">False</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={fieldType}
                          value={fieldValue}
                          onChange={(event) => handleChange(field.name, event.target.value)}
                        />
                      )}
                    </div>
                  )
                })}
                {selectedProvider && (selectedProvider.form_fields ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No configuration fields available for this provider.
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogMode("list")
                    setSelectedProvider(null)
                    setValues({})
                  }}
                  disabled={saving}
                >
                  Back
                </Button>
                <Button onClick={handleSubmit} disabled={saving || loading}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          if (!open && importStatus === "processing") return
          if (!open) {
            clearImportPolling()
          }
          setImportDialogOpen(open)
        }}
      >
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (importStatus === "processing") event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (importStatus === "processing") event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (importStatus === "processing") event.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {importEntity === "drivers"
                ? "Import Drivers"
                : importEntity === "locations"
                  ? "Import Locations"
                  : "Import Vehicles"}
            </DialogTitle>
            <DialogDescription>
              {importingProviderName
                ? `Provider: ${importingProviderName}`
                : `Importing ${importEntity} from provider`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {importStatus === "options" ? (
              <div className="space-y-4">
                {importEntity === "locations" ? (
                  <div className="rounded-md border border-border/70 p-3">
                    <div className="mb-2 text-sm font-medium">Import options</div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm">Only import locations with geofences</div>
                        <div className="text-xs text-muted-foreground">
                          If enabled, only locations that have geofences will be imported.
                        </div>
                      </div>
                      <Switch
                        checked={importOptions.only_with_geofences}
                        onCheckedChange={(checked) =>
                          setImportOptions((prev) => ({ ...prev, only_with_geofences: checked }))
                        }
                      />
                    </div>
                  </div>
                ) : null}

                {importEntity === "drivers" ? (
                  <div className="space-y-3 rounded-md border border-border/70 p-3">
                    <div className="text-sm font-medium">Import options</div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Filter type</label>
                      <Select
                        value={importOptions.filter_type || undefined}
                        onValueChange={(value) =>
                          setImportOptions((prev) => ({ ...prev, filter_type: value }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a filter type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="name">Name</SelectItem>
                            <SelectItem value="fmdriverid">Fmdriverid</SelectItem>
                            <SelectItem value="employeenumber">Employee number</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Keyword</label>
                      <Input
                        value={importOptions.wildcard}
                        onChange={(event) =>
                          setImportOptions((prev) => ({ ...prev, wildcard: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                ) : null}

                {importEntity === "vehicles" ? (
                  <div className="space-y-3 rounded-md border border-border/70 p-3">
                    <div className="text-sm font-medium">Import options</div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Filter type</label>
                      <Select
                        value={importOptions.filter_type || undefined}
                        onValueChange={(value) =>
                          setImportOptions((prev) => ({ ...prev, filter_type: value }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a filter type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="registration">Registration</SelectItem>
                          <SelectItem value="description">Description</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Keyword</label>
                      <Input
                        value={importOptions.wildcard}
                        onChange={(event) =>
                          setImportOptions((prev) => ({ ...prev, wildcard: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {importStatus === "processing" ? (
              <div className="text-muted-foreground">
                {`Processing ${importEntity === "drivers" ? "driver" : importEntity === "locations" ? "location" : "vehicle"} import...`}
              </div>
            ) : null}

            {importStatus === "error" ? (
              <div className="text-destructive text-wrap">
                {importErrorMessage ||
                  `${importEntity === "drivers" ? "Driver" : importEntity === "locations" ? "Location" : "Vehicle"} import failed.`}
              </div>
            ) : null}

            {importStatus === "done" ? (
              <>
                <div>
                  Imported{" "}
                  <span className="font-semibold">
                    {importStats?.last_import_counts?.[importEntity] ?? 0}
                  </span>{" "}
                  {importEntity}.
                </div>
                {importStats?.last_import_errors?.[importEntity] ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                    {String(importStats.last_import_errors[importEntity])}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
          <DialogFooter>
            {importStatus === "options" ? (
              <>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={runImport}>Continue</Button>
              </>
            ) : (
              <Button onClick={() => setImportDialogOpen(false)} disabled={importStatus === "processing"}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
