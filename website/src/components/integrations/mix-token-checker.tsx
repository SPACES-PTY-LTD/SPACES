"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  inspectTrackingProviderMixToken,
  listTrackingProviders,
} from "@/lib/api/tracking-providers"
import { isApiErrorResponse } from "@/lib/api/client"
import type { MixTokenAnalysis, TrackingProvider } from "@/lib/types"

function normalizeProviderName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "-")
}

function isLikelyMixProvider(provider: TrackingProvider) {
  const normalized = normalizeProviderName(provider.name)
  return normalized.includes("mix") || normalized.includes("powerfleet")
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-lg border bg-slate-950 p-4 text-xs text-slate-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function MixTokenChecker({
  accessToken,
  merchantId,
  merchantName,
}: {
  accessToken?: string
  merchantId?: string | null
  merchantName?: string | null
}) {
  const [providers, setProviders] = React.useState<TrackingProvider[]>([])
  const [providerId, setProviderId] = React.useState<string>("")
  const [loadingProviders, setLoadingProviders] = React.useState(true)
  const [runningCheck, setRunningCheck] = React.useState(false)
  const [result, setResult] = React.useState<MixTokenAnalysis | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string>("")

  React.useEffect(() => {
    let cancelled = false

    async function loadProviders() {
      if (!merchantId) {
        setProviders([])
        setProviderId("")
        setLoadingProviders(false)
        return
      }

      setLoadingProviders(true)
      const response = await listTrackingProviders(accessToken, merchantId)

      if (cancelled) {
        return
      }

      if (isApiErrorResponse(response)) {
        setErrorMessage(response.message || "Failed to load tracking providers.")
        setLoadingProviders(false)
        return
      }

      const items = (response.data ?? []).filter((provider) => Boolean(provider.activated))
      const mixCandidates = items.filter(isLikelyMixProvider)
      const nextProviderId =
        mixCandidates.length === 1 ? mixCandidates[0]?.provider_id ?? "" : mixCandidates[0]?.provider_id ?? items[0]?.provider_id ?? ""

      setProviders(items)
      setProviderId(nextProviderId)
      setErrorMessage("")
      setLoadingProviders(false)
    }

    loadProviders()

    return () => {
      cancelled = true
    }
  }, [accessToken, merchantId])

  const selectedProvider = React.useMemo(
    () => providers.find((provider) => provider.provider_id === providerId) ?? null,
    [providers, providerId]
  )

  async function runCheck() {
    if (!merchantId || !providerId) {
      return
    }

    setRunningCheck(true)
    setErrorMessage("")

    const response = await inspectTrackingProviderMixToken(providerId, merchantId, accessToken)

    if (isApiErrorResponse(response)) {
      setResult(null)
      setErrorMessage(response.message || "Failed to inspect MiX token.")
      toast.error(response.message || "Failed to inspect MiX token.")
      setRunningCheck(false)
      return
    }

    setResult(response)
    setRunningCheck(false)
  }

  const timing = result?.timing
  const expiresSoon =
    typeof timing?.seconds_until_expiry === "number" &&
    timing.seconds_until_expiry > 0 &&
    timing.seconds_until_expiry <= 300

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Run MiX token check</CardTitle>
          <CardDescription>
            Uses the saved MiX tracking-provider credentials for the selected merchant and shows the raw auth payload plus decoded token details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Merchant</div>
              <div className="mt-2 text-sm font-medium">{merchantName || "No merchant selected"}</div>
              <div className="text-xs text-muted-foreground">{merchantId || "Select a merchant first."}</div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tracking provider</div>
              <div className="mt-2">
                <Select value={providerId} onValueChange={setProviderId} disabled={loadingProviders || providers.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingProviders ? "Loading providers..." : "Select provider"} />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.provider_id} value={provider.provider_id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {!merchantId ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              A merchant must be selected before this tool can use stored MiX credentials.
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <Button onClick={runCheck} disabled={!merchantId || !providerId || runningCheck || loadingProviders}>
            {runningCheck ? "Running check..." : "Run Mix Check"}
          </Button>
        </CardContent>
      </Card>

      {!result ? (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>Run the check to inspect the MiX token response.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>{result.summary}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Provider</div>
                <div className="mt-2 text-sm font-medium">{selectedProvider?.name ?? result.provider_id}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Token status</div>
                <div className="mt-2">
                  <Badge variant={timing?.is_expired ? "destructive" : expiresSoon ? "secondary" : "default"}>
                    {timing?.is_expired ? "Expired" : expiresSoon ? "Expiring soon" : "Active"}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expires at</div>
                <div className="mt-2 text-sm font-medium">{timing?.expires_at ?? "Unknown"}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Seconds until expiry</div>
                <div className="mt-2 text-sm font-medium">
                  {typeof timing?.seconds_until_expiry === "number" ? timing.seconds_until_expiry : "Unknown"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Raw tokens</CardTitle>
              <CardDescription>Full token values returned by MiX.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 text-sm font-medium">Access token</div>
                <JsonBlock value={result.access_token} />
              </div>
              <div>
                <div className="mb-2 text-sm font-medium">Refresh token</div>
                <JsonBlock value={result.refresh_token} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Decoded access token</CardTitle>
              <CardDescription>JWT header, claims, and derived timestamps for the MiX access token.</CardDescription>
            </CardHeader>
            <CardContent>
              <JsonBlock value={result.access_token_decoded} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Decoded refresh token</CardTitle>
              <CardDescription>JWT header and claims for the MiX refresh token when decodable.</CardDescription>
            </CardHeader>
            <CardContent>
              <JsonBlock value={result.refresh_token_decoded} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Raw MiX response</CardTitle>
              <CardDescription>The exact auth payload returned by the MiX identity endpoint.</CardDescription>
            </CardHeader>
            <CardContent>
              <JsonBlock value={result.raw_response} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Full analysis response</CardTitle>
              <CardDescription>The complete backend response payload rendered as returned to the UI.</CardDescription>
            </CardHeader>
            <CardContent>
              <JsonBlock value={result} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
