"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isApiErrorResponse } from "@/lib/api/client"
import {
  getPowerfleetOrganisationDetails,
  listPowerfleetOrganisations,
  listPowerfleetSubgroups,
  listTrackingProviders,
} from "@/lib/api/tracking-providers"
import type { PowerfleetGroup, PowerfleetGroupDetails, TrackingProvider } from "@/lib/types"
import { cn } from "@/lib/utils"

type TreeGroup = Omit<PowerfleetGroup, "subgroups"> & {
  subgroups: TreeGroup[]
}

function normalizeProviderName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "-")
}

function isLikelyPowerfleetProvider(provider: TrackingProvider) {
  const normalized = normalizeProviderName(provider.name)
  return normalized.includes("powerfleet") || normalized.includes("mix")
}

function toTreeGroups(groups: PowerfleetGroup[]): TreeGroup[] {
  return groups.map((group) => ({
    ...group,
    has_loaded_subgroups: Boolean(group.has_loaded_subgroups),
    subgroups: toTreeGroups(group.subgroups ?? []),
  }))
}

function updateGroupChildren(groups: TreeGroup[], groupId: string, children: TreeGroup[]): TreeGroup[] {
  return groups.map((group) => {
    if (group.group_id === groupId) {
      return {
        ...group,
        has_loaded_subgroups: true,
        subgroups: children,
      }
    }

    return {
      ...group,
      subgroups: updateGroupChildren(group.subgroups, groupId, children),
    }
  })
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-lg border bg-slate-950 p-4 text-xs text-slate-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border-b py-3 last:border-0">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value || "-"}</div>
    </div>
  )
}

export function PowerfleetOrganizationsExplorer({
  accessToken,
  merchantId,
  merchantName,
}: {
  accessToken?: string
  merchantId?: string | null
  merchantName?: string | null
}) {
  const [providers, setProviders] = React.useState<TrackingProvider[]>([])
  const [providerId, setProviderId] = React.useState("")
  const [groups, setGroups] = React.useState<TreeGroup[]>([])
  const [selectedGroup, setSelectedGroup] = React.useState<TreeGroup | null>(null)
  const [details, setDetails] = React.useState<PowerfleetGroupDetails | null>(null)
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => new Set())
  const [loadingProviders, setLoadingProviders] = React.useState(true)
  const [loadingGroups, setLoadingGroups] = React.useState(false)
  const [loadingNodeId, setLoadingNodeId] = React.useState<string | null>(null)
  const [loadingDetailsId, setLoadingDetailsId] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState("")

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

      if (cancelled) return

      if (isApiErrorResponse(response)) {
        setErrorMessage(response.message || "Failed to load tracking providers.")
        setLoadingProviders(false)
        return
      }

      const items = (response.data ?? [])
        .filter((provider) => Boolean(provider.activated))
        .filter(isLikelyPowerfleetProvider)

      setProviders(items)
      setProviderId(items[0]?.provider_id ?? "")
      setErrorMessage("")
      setLoadingProviders(false)
    }

    loadProviders()

    return () => {
      cancelled = true
    }
  }, [accessToken, merchantId])

  React.useEffect(() => {
    let cancelled = false

    async function loadGroups() {
      if (!merchantId || !providerId) {
        setGroups([])
        setSelectedGroup(null)
        setDetails(null)
        return
      }

      setLoadingGroups(true)
      setSelectedGroup(null)
      setDetails(null)
      setExpandedIds(new Set())

      const response = await listPowerfleetOrganisations(providerId, merchantId, accessToken)

      if (cancelled) return

      if (isApiErrorResponse(response)) {
        setGroups([])
        setErrorMessage(response.message || "Failed to load Powerfleet organizations.")
        toast.error(response.message || "Failed to load Powerfleet organizations.")
        setLoadingGroups(false)
        return
      }

      setGroups(toTreeGroups(response ?? []))
      setErrorMessage("")
      setLoadingGroups(false)
    }

    loadGroups()

    return () => {
      cancelled = true
    }
  }, [accessToken, merchantId, providerId])

  const selectedProvider = React.useMemo(
    () => providers.find((provider) => provider.provider_id === providerId) ?? null,
    [providers, providerId]
  )

  async function loadSubgroups(group: TreeGroup) {
    if (!merchantId || !providerId) return

    setLoadingNodeId(group.group_id)
    const response = await listPowerfleetSubgroups(providerId, merchantId, group.group_id, accessToken)

    if (isApiErrorResponse(response)) {
      setErrorMessage(response.message || "Failed to load Powerfleet subgroups.")
      toast.error(response.message || "Failed to load Powerfleet subgroups.")
      setLoadingNodeId(null)
      return
    }

    setGroups((current) => updateGroupChildren(current, group.group_id, toTreeGroups(response ?? [])))
    setLoadingNodeId(null)
  }

  async function loadDetails(group: TreeGroup) {
    if (!merchantId || !providerId) return

    setSelectedGroup(group)
    setLoadingDetailsId(group.group_id)
    const response = await getPowerfleetOrganisationDetails(providerId, merchantId, group.group_id, accessToken)

    if (isApiErrorResponse(response)) {
      setDetails(null)
      setErrorMessage(response.message || "Failed to load Powerfleet group details.")
      toast.error(response.message || "Failed to load Powerfleet group details.")
      setLoadingDetailsId(null)
      return
    }

    setDetails(response)
    setErrorMessage("")
    setLoadingDetailsId(null)
  }

  async function toggleGroup(group: TreeGroup) {
    const isExpanded = expandedIds.has(group.group_id)
    const nextExpanded = new Set(expandedIds)

    if (isExpanded) {
      nextExpanded.delete(group.group_id)
      setExpandedIds(nextExpanded)
      return
    }

    nextExpanded.add(group.group_id)
    setExpandedIds(nextExpanded)

    if (!group.has_loaded_subgroups) {
      await loadSubgroups(group)
    }
  }

  function renderGroup(group: TreeGroup, depth = 0): React.ReactNode {
    const isExpanded = expandedIds.has(group.group_id)
    const isSelected = selectedGroup?.group_id === group.group_id
    const isLoadingNode = loadingNodeId === group.group_id

    return (
      <React.Fragment key={group.group_id}>
        <div
          className={cn(
            "grid grid-cols-[2rem_1fr_auto] items-center gap-2 border-b px-3 py-2 text-sm last:border-0",
            isSelected ? "bg-muted" : "hover:bg-muted/60"
          )}
          style={{ paddingLeft: `${12 + depth * 18}px` }}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => toggleGroup(group)}
            aria-label={isExpanded ? "Collapse group" : "Expand group"}
          >
            {isLoadingNode ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
          <button
            type="button"
            className="min-w-0 text-left"
            onClick={() => loadDetails(group)}
          >
            <span className="block truncate font-medium">{group.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{group.group_id}</span>
          </button>
          {group.type ? <Badge variant="secondary">{group.type}</Badge> : null}
        </div>
        {isExpanded && group.subgroups.map((child) => renderGroup(child, depth + 1))}
      </React.Fragment>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Powerfleet source</CardTitle>
          <CardDescription>
            Uses the selected merchant&apos;s activated Powerfleet tracking-provider credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-xs font-medium uppercase text-muted-foreground">Merchant</div>
              <div className="mt-2 text-sm font-medium">{merchantName || "No merchant selected"}</div>
              <div className="text-xs text-muted-foreground">{merchantId || "Select a merchant first."}</div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-xs font-medium uppercase text-muted-foreground">Tracking provider</div>
              <div className="mt-2">
                <Select value={providerId} onValueChange={setProviderId} disabled={loadingProviders || providers.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingProviders ? "Loading providers..." : "Select Powerfleet provider"} />
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
              {!loadingProviders && merchantId && providers.length === 0 ? (
                <div className="mt-2 text-xs text-muted-foreground">
                  No activated Powerfleet provider is available for this merchant.
                </div>
              ) : null}
            </div>
          </div>

          {!merchantId ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              A merchant must be selected before this tool can use stored Powerfleet credentials.
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
        <Card>
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
            <CardDescription>
              Expand a group to load its subgroups, or select a group to inspect its details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingGroups ? (
              <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading organizations...
              </div>
            ) : groups.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {providerId ? "No Powerfleet organizations returned." : "Select an activated Powerfleet provider."}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                {groups.map((group) => renderGroup(group))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Group details</CardTitle>
            <CardDescription>
              {selectedProvider ? selectedProvider.name : "Select a group to load its Powerfleet details."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingDetailsId ? (
              <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading details...
              </div>
            ) : !details ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Select an organization or subgroup.
              </div>
            ) : (
              <>
                <div className="rounded-lg border px-4">
                  <DetailRow label="Name" value={details.name} />
                  <DetailRow label="Group ID" value={details.group_id} />
                  <DetailRow label="Group type" value={details.group_type} />
                  <DetailRow label="Display timezone" value={details.display_time_zone} />
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium">Raw response</div>
                  <JsonBlock value={details.raw ?? details} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
