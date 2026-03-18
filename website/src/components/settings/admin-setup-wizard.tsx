"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Globe2,
  MapPin,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { updateMerchantSettings } from "@/lib/api/merchants"
import { isApiErrorResponse } from "@/lib/api/client"
import { listLocationTypes, patchLocationTypes } from "@/lib/api/location-types"
import { AdminLinks } from "@/lib/routes/admin"
import type { LocationType, Merchant } from "@/lib/types"
import { cn } from "@/lib/utils"

type EditableLocationType = {
  location_type_id?: string | null
  title: string
  slug?: string | null
  collection_point: boolean
  delivery_point: boolean
  sequence: number
  icon?: string | null
  color?: string | null
  default: boolean
}

type CountryOption = {
  code: string
  name: string
}

const FALLBACK_COUNTRIES: CountryOption[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "ZA", name: "South Africa" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "IN", name: "India" },
  { code: "AE", name: "United Arab Emirates" },
]

const NON_COUNTRY_REGION_CODES = new Set([
  "EU",
  "EZ",
  "UN",
  "XA",
  "XB",
  "XC",
  "XD",
  "XE",
  "XF",
  "XG",
  "XH",
  "XI",
  "XJ",
  "XL",
  "XM",
  "XN",
  "XO",
  "XP",
  "XQ",
  "XR",
  "XS",
  "XT",
  "XU",
  "XV",
  "XW",
  "XX",
  "XZ",
])

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Africa/Johannesburg",
]

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim()
}

function getDefaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

function getTimezones() {
  if (typeof Intl.supportedValuesOf === "function") {
    const values = Intl.supportedValuesOf("timeZone")
    if (values.length > 0) {
      return values
    }
  }
  return FALLBACK_TIMEZONES
}

function getCountryOptions() {
  if (typeof Intl.DisplayNames !== "function") {
    return FALLBACK_COUNTRIES
  }

  const displayNames = new Intl.DisplayNames(["en"], { type: "region" })
  const values: CountryOption[] = []
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

  for (const firstChar of alphabet) {
    for (const secondChar of alphabet) {
      const code = `${firstChar}${secondChar}`
      if (NON_COUNTRY_REGION_CODES.has(code)) continue
      const name = displayNames.of(code)
      if (!name || name === code) continue
      values.push({ code, name })
    }
  }

  if (values.length === 0) {
    return FALLBACK_COUNTRIES
  }

  return values.sort((a, b) => a.name.localeCompare(b.name))
}

function fromLocationType(item: LocationType, sequence: number): EditableLocationType {
  return {
    location_type_id: item.location_type_id ?? null,
    title: item.title ?? "",
    slug: item.slug ?? "",
    collection_point: Boolean(item.collection_point),
    delivery_point: Boolean(item.delivery_point),
    sequence: Number.isFinite(item.sequence) ? Number(item.sequence) : sequence,
    icon: item.icon ?? null,
    color: item.color ?? null,
    default: Boolean(item.default),
  }
}

export function AdminSetupWizard({
  accessToken,
  merchantId,
  merchantName,
  initialTimezone,
  initialCountries,
  initialAutoCreateShipment,
}: {
  accessToken?: string
  merchantId: string
  merchantName: string
  initialTimezone?: string | null
  initialCountries?: string[] | null
  initialAutoCreateShipment?: boolean
}) {
  const router = useRouter()
  const { data: liveSession, update } = useSession()
  const [step, setStep] = React.useState(0)
  const [saving, setSaving] = React.useState(false)
  const [loadingTypes, setLoadingTypes] = React.useState(false)
  const [locationTypesLoaded, setLocationTypesLoaded] = React.useState(false)
  const [timezoneOpen, setTimezoneOpen] = React.useState(false)
  const [countryOpen, setCountryOpen] = React.useState(false)
  const [timezone, setTimezone] = React.useState(initialTimezone || getDefaultTimezone())
  const [countries, setCountries] = React.useState<string[]>(
    initialCountries?.length ? initialCountries : []
  )
  const [locationTypes, setLocationTypes] = React.useState<EditableLocationType[]>([])
  const [autoCreateShipment, setAutoCreateShipment] = React.useState(
    Boolean(initialAutoCreateShipment)
  )

  const timezoneOptions = React.useMemo(() => getTimezones(), [])
  const countryOptions = React.useMemo(() => getCountryOptions(), [])
  const countryByCode = React.useMemo(
    () =>
      new Map<string, CountryOption>(
        countryOptions.map((country) => [country.code, country] as const)
      ),
    [countryOptions]
  )
  const selectedCountries = React.useMemo(
    () =>
      countries.map((code) => {
        const option = countryByCode.get(code)
        return option ?? { code, name: code }
      }),
    [countries, countryByCode]
  )

  const loadLocationTypes = React.useCallback(async () => {
    setLoadingTypes(true)
    const response = await listLocationTypes(accessToken, { merchant_id: merchantId })
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to load location types.")
      setLoadingTypes(false)
      return
    }
    console.log("Loaded location types for merchant setup", response.data)
    const mapped = (response.data ?? []).map((item, index) => fromLocationType(item, index + 1))
    setLocationTypes(
      mapped.length
        ? mapped
        : [
            {
              title: "Pickup",
              slug: "",
              collection_point: true,
              delivery_point: false,
              sequence: 1,
              default: true,
            },
            {
              title: "Dropoff",
              slug: "",
              collection_point: false,
              delivery_point: true,
              sequence: 2,
              default: false,
            },
          ]
    )
    setLoadingTypes(false)
    setLocationTypesLoaded(true)
  }, [accessToken, merchantId])

  React.useEffect(() => {
    if (step !== 2 || locationTypesLoaded) return
    loadLocationTypes()
  }, [loadLocationTypes, locationTypesLoaded, step])

  const addCountry = (code: string) => {
    setCountries((prev) => (prev.includes(code) ? prev : [...prev, code]))
  }

  const removeCountry = (code: string) => {
    setCountries((prev) => prev.filter((value) => value !== code))
  }

  const updateType = (
    index: number,
    key: keyof EditableLocationType,
    value: string | boolean | number | null
  ) => {
    setLocationTypes((prev) => {
      const next = [...prev]
      const current = next[index]
      if (!current) return prev
      next[index] = { ...current, [key]: value }
      return next
    })
  }

  const addLocationType = () => {
    setLocationTypes((prev) => [
      ...prev,
      {
        title: "",
        slug: "",
        collection_point: false,
        delivery_point: false,
        sequence: prev.length + 1,
        default: false,
      },
    ])
  }

  const removeLocationType = (index: number) => {
    setLocationTypes((prev) =>
      prev
        .filter((_, entryIndex) => entryIndex !== index)
        .map((entry, entryIndex) => ({ ...entry, sequence: entryIndex + 1 }))
    )
  }

  const canProceed = React.useMemo(() => {
    if (step === 0) return Boolean(normalizeText(timezone))
    if (step === 1) return countries.length > 0
    if (step === 2) {
      return locationTypes.length > 0 && locationTypes.every((item) => normalizeText(item.title))
    }
    return true
  }, [countries.length, locationTypes, step, timezone])

  const completeSetup = async () => {
    if (!canProceed) {
      toast.error("Please complete the current step first.")
      return
    }

    setSaving(true)
    const settingsPayload = {
      timezone: normalizeText(timezone),
      operating_countries: countries,
      allow_auto_shipment_creations_at_locations: autoCreateShipment,
      setup_completed_at: new Date().toISOString(),
    }

    const merchantResponse = await updateMerchantSettings(
      merchantId,
      settingsPayload,
      accessToken
    )
    if (isApiErrorResponse(merchantResponse)) {
      toast.error(merchantResponse.message || "Failed to save setup preferences.")
      setSaving(false)
      return
    }

    const sessionData = liveSession as
      | {
          merchants?: Merchant[]
          selected_merchant?: Merchant
        }
      | null

    const merchants = (sessionData?.merchants ?? []).map((merchant) =>
      merchant?.merchant_id === merchantId ? merchantResponse : merchant
    )
    const selectedMerchant = sessionData?.selected_merchant
    await update({
      merchants,
      selected_merchant:
        selectedMerchant?.merchant_id === merchantId ? merchantResponse : selectedMerchant,
    })

    toast.success("Setup complete. You are ready to operate.")
    router.replace(AdminLinks.dashboard)
    router.refresh()
    setSaving(false)
  }

  const saveLocationTypesStep = async () => {
    const response = await patchLocationTypes(
      {
        merchant_id: merchantId,
        types: locationTypes.map((type, index) => {
          const slug = normalizeText(type.slug)
          return {
            location_type_id: type.location_type_id ?? undefined,
            slug: slug || undefined,
            title: normalizeText(type.title),
            collection_point: Boolean(type.collection_point),
            delivery_point: Boolean(type.delivery_point),
            sequence: index + 1,
            icon: normalizeText(type.icon) || null,
            color: normalizeText(type.color) || null,
            default: Boolean(type.default),
          }
        }),
      },
      accessToken
    )

    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to save location types.")
      return false
    }

    toast.success("Location types saved.")
    return true
  }

  const goToNextStep = async () => {
    if (!canProceed) return
    if (step !== 2) {
      setStep((prev) => Math.min(3, prev + 1))
      return
    }

    setSaving(true)
    const saved = await saveLocationTypesStep()
    setSaving(false)
    if (!saved) return
    setStep(3)
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Setup"
        description={`Let us configure ${merchantName} in four quick steps.`}
      />

    

      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe2 className="h-5 w-5 text-primary" />
              Pick your timezone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={timezoneOpen}
                  className="w-full justify-between font-normal"
                >
                  {timezone || "Choose timezone"}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search timezone..." />
                  <CommandList>
                    <CommandEmpty>No timezone found.</CommandEmpty>
                    {timezoneOptions.map((zone) => (
                      <CommandItem
                        key={zone}
                        value={zone}
                        onSelect={() => {
                          setTimezone(zone)
                          setTimezoneOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            timezone === zone ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {zone}
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              This sets default timestamps and scheduling behavior.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-primary" />
              Which countries do you operate in?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Popover open={countryOpen} onOpenChange={setCountryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={countryOpen}
                  className="w-full justify-between font-normal"
                >
                  Select a country
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search countries..." />
                  <CommandList>
                    <CommandEmpty>No country found.</CommandEmpty>
                    {countryOptions.map((country) => (
                      <CommandItem
                        key={country.code}
                        value={`${country.name} ${country.code}`}
                        onSelect={() => {
                          addCountry(country.code)
                          setCountryOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            countries.includes(country.code) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {country.name}
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="flex flex-wrap gap-2">
              {selectedCountries.map((country) => (
                <div
                  key={country.code}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary"
                >
                  {country.name}
                  <button
                    type="button"
                    aria-label={`Remove ${country.name}`}
                    onClick={() => removeCountry(country.code)}
                    className="rounded-full p-0.5 hover:bg-primary/20"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              These countries will be used for map search and address filtering.
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Confirm location types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingTypes ? (
              <div className="text-sm text-muted-foreground">Loading location types...</div>
            ) : (
              <>
                {locationTypes.map((type, index) => (
                  <div
                    key={type.location_type_id ?? `type-${index}`}
                    className="space-y-2 rounded-md border border-border/70 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={type.title}
                        onChange={(event) => updateType(index, "title", event.target.value)}
                        placeholder="Location type title"
                      />
                      <Button
                        variant="ghost"
                        onClick={() => removeLocationType(index)}
                        disabled={locationTypes.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <Switch
                          checked={type.collection_point}
                          onCheckedChange={(checked) =>
                            updateType(index, "collection_point", checked)
                          }
                        />
                        Collection point
                      </label>
                      <label className="flex items-center gap-2">
                        <Switch
                          checked={type.delivery_point}
                          onCheckedChange={(checked) =>
                            updateType(index, "delivery_point", checked)
                          }
                        />
                        Delivery point
                      </label>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addLocationType}>
                  Add location type
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Allow auto creation of shipment?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 rounded-md border border-border/60 p-3">
              <Switch checked={autoCreateShipment} onCheckedChange={setAutoCreateShipment} />
              <div className="space-y-1">
                <div className="text-sm font-medium">Enable auto-create shipment</div>
                <div className="text-xs text-muted-foreground">
                  A shipment will be auto-created if a driver reaches a dropoff location without one.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep((prev) => Math.max(0, prev - 1))} disabled={step === 0 || saving}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        {step < 3 ? (
          <Button onClick={goToNextStep} disabled={!canProceed || saving}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={completeSetup} disabled={saving || !canProceed}>
            {saving ? "Saving..." : "Finish setup"}
          </Button>
        )}
      </div>
    </div>
  )
}
