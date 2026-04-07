"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { isApiErrorResponse } from "@/lib/api/client"
import { listTags, updateLocationTags, updateVehicleTags } from "@/lib/api/tags"
import type { Tag } from "@/lib/types"

type EntityType = "vehicle" | "location"

function normalizeTagName(name: string) {
  return name.trim().replace(/\s+/g, " ")
}

function tagKey(name: string) {
  return normalizeTagName(name).toLocaleLowerCase()
}

export function EntryTagsManager({
  entityType,
  entityId,
  merchantId,
  accessToken,
  initialTags,
}: {
  entityType: EntityType
  entityId: string
  merchantId?: string | null
  accessToken?: string
  initialTags?: Tag[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [availableTags, setAvailableTags] = React.useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = React.useState<Tag[]>(initialTags ?? [])

  React.useEffect(() => {
    setSelectedTags(initialTags ?? [])
  }, [initialTags])

  React.useEffect(() => {
    if (!open || !merchantId) return

    let ignore = false
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      const response = await listTags(accessToken, {
        merchant_id: merchantId,
        search: search || undefined,
        per_page: 50,
      })
      if (ignore) return

      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Failed to load tags.")
        setAvailableTags([])
      } else {
        setAvailableTags(response.data ?? [])
      }
      setLoading(false)
    }, 200)

    return () => {
      ignore = true
      window.clearTimeout(timeout)
    }
  }, [accessToken, merchantId, open, search])

  const selectedKeys = React.useMemo(
    () => new Set(selectedTags.map((tag) => tagKey(tag.name))),
    [selectedTags]
  )
  const searchName = normalizeTagName(search)
  const canCreate =
    searchName.length > 0 &&
    !selectedKeys.has(tagKey(searchName)) &&
    !availableTags.some((tag) => tagKey(tag.name) === tagKey(searchName))

  const addTag = (tag: Tag) => {
    if (selectedKeys.has(tagKey(tag.name))) return
    setSelectedTags((current) => [...current, tag])
    setSearch("")
  }

  const createDraftTag = () => {
    if (!canCreate) return
    setSelectedTags((current) => [
      ...current,
      {
        tag_id: `draft-${tagKey(searchName)}`,
        name: searchName,
        slug: tagKey(searchName).replace(/\s+/g, "-"),
      },
    ])
    setSearch("")
  }

  const removeTag = (tag: Tag) => {
    setSelectedTags((current) =>
      current.filter((item) => tagKey(item.name) !== tagKey(tag.name))
    )
  }

  const saveTags = async () => {
    setSaving(true)
    const names = selectedTags.map((tag) => tag.name)
    const response =
      entityType === "vehicle"
        ? await updateVehicleTags(entityId, names, accessToken)
        : await updateLocationTags(entityId, names, accessToken)

    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to update tags.")
      setSaving(false)
      return
    }

    setSelectedTags(response.data.tags ?? [])
    toast.success("Tags updated.")
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Tags</h2>
          <p className="text-xs text-muted-foreground">
            Assign shared fleet and location tags.
          </p>
        </div>
        <Button size="sm" onClick={saveTags} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
      </div>

      <div className="mb-3 flex min-h-9 flex-wrap gap-2">
        {selectedTags.length > 0 ? (
          selectedTags.map((tag) => (
            <Badge key={`${tag.tag_id}-${tag.name}`} variant="secondary" className="gap-1">
              {tag.name}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="rounded-sm text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${tag.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">No tags assigned.</span>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={!merchantId}
          >
            Add tag
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or create tags..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {loading ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading tags...
                </div>
              ) : null}
              {!loading && availableTags.length === 0 && !canCreate ? (
                <CommandEmpty>No tags found.</CommandEmpty>
              ) : null}
              <CommandGroup>
                {availableTags.map((tag) => {
                  const selected = selectedKeys.has(tagKey(tag.name))
                  return (
                    <CommandItem
                      key={tag.tag_id}
                      value={tag.name}
                      onSelect={() => addTag(tag)}
                      disabled={selected}
                    >
                      <Check className={selected ? "h-4 w-4 opacity-100" : "h-4 w-4 opacity-0"} />
                      {tag.name}
                    </CommandItem>
                  )
                })}
                {canCreate ? (
                  <CommandItem value={`create-${searchName}`} onSelect={createDraftTag}>
                    <Plus className="h-4 w-4" />
                    Create &quot;{searchName}&quot;
                  </CommandItem>
                ) : null}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
