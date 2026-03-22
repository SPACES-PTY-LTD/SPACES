"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { CountryMultiSelect } from "@/components/settings/country-multi-select"
import { TimezoneSelect } from "@/components/settings/timezone-select"
import { updateMerchant, updateMerchantSettings, uploadMerchantLogo } from "@/lib/api/merchants"
import { isApiErrorResponse } from "@/lib/api/client"
import { getDefaultTimezone } from "@/lib/geo-options"
import type { Merchant } from "@/lib/types"

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim()
}

export function OrganizationSettingsForm({
  accessToken,
  merchant,
}: {
  accessToken?: string
  merchant: Merchant
}) {
  const router = useRouter()
  const { data: liveSession, update } = useSession()
  const [saving, setSaving] = React.useState(false)
  const [name, setName] = React.useState(merchant.name ?? "")
  const [timezone, setTimezone] = React.useState(merchant.timezone ?? getDefaultTimezone())
  const [countries, setCountries] = React.useState<string[]>(merchant.operating_countries ?? [])
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = React.useState<string | null>(merchant.logo_url ?? null)

  React.useEffect(() => {
    if (!logoFile) return

    const objectUrl = URL.createObjectURL(logoFile)
    setLogoPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [logoFile])

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = normalizeText(name)
    const trimmedTimezone = normalizeText(timezone)

    if (!trimmedName) {
      toast.error("Organization name is required.")
      return
    }

    if (!trimmedTimezone) {
      toast.error("Timezone is required.")
      return
    }

    if (countries.length === 0) {
      toast.error("Select at least one operating country.")
      return
    }

    setSaving(true)

    let currentMerchant: Merchant = merchant

    const profileResponse = await updateMerchant(
      merchant.merchant_id,
      { name: trimmedName },
      accessToken
    )

    if (isApiErrorResponse(profileResponse)) {
      toast.error(profileResponse.message || "Failed to update organization details.")
      setSaving(false)
      return
    }

    currentMerchant = profileResponse

    const settingsResponse = await updateMerchantSettings(
      merchant.merchant_id,
      {
        timezone: trimmedTimezone,
        operating_countries: countries,
      },
      accessToken
    )

    if (isApiErrorResponse(settingsResponse)) {
      toast.error(settingsResponse.message || "Failed to update settings.")
      setSaving(false)
      return
    }

    currentMerchant = settingsResponse

    if (logoFile) {
      const logoResponse = await uploadMerchantLogo(
        merchant.merchant_id,
        { logo: logoFile },
        accessToken
      )

      if (isApiErrorResponse(logoResponse)) {
        toast.error(logoResponse.message || "Logo upload failed.")
        setSaving(false)
        return
      }

      currentMerchant = logoResponse
      setLogoFile(null)
      setLogoPreviewUrl(logoResponse.logo_url ?? null)
    }

    const sessionData = liveSession as
      | {
          merchants?: Merchant[]
          selected_merchant?: Merchant
        }
      | null

    const merchants = (sessionData?.merchants ?? []).map((entry) =>
      entry?.merchant_id === merchant.merchant_id ? currentMerchant : entry
    )

    const selectedMerchant = sessionData?.selected_merchant

    await update({
      merchants,
      selected_merchant:
        selectedMerchant?.merchant_id === merchant.merchant_id
          ? currentMerchant
          : selectedMerchant,
    })

    toast.success("Settings saved.")
    router.refresh()
    setSaving(false)
  }

  return (
    <form onSubmit={onSubmit} className="p-6 gap-4 flex flex-col">
      <div>
        <label htmlFor="organization-name" className="block text-sm font-medium text-muted-foreground">
          Organization name
        </label>
        <input
          type="text"
          id="organization-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-background py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
          placeholder="Enter organization name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground">
          Merchant logo
        </label>
        <div className="mt-1 flex items-center gap-4">
          <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border bg-secondary text-xs text-muted-foreground">
            {logoPreviewUrl ? (
              <Image
                src={logoPreviewUrl}
                alt={`${name || "Merchant"} logo`}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <span>No logo</span>
            )}
          </div>
          <label className="cursor-pointer rounded-md border border-border bg-background py-2 px-3 text-sm text-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
            Upload file
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>

      <div className="pt-4 border-t border-border" />

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Time zone
        </label>
        <TimezoneSelect value={timezone} onChange={setTimezone} placeholder="Select time zone" />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Operating countries
        </label>
        <CountryMultiSelect value={countries} onChange={setCountries} />
      </div>

      <div className="border-t border-border" />
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-primary py-2 px-4 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save changes"}
      </button>
    </form>
  )
}
