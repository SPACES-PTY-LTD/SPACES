"use client"

import * as React from "react"
import { toast } from "sonner"
import { Edit3, GripVertical, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { isApiErrorResponse } from "@/lib/api/client"
import {
  listLocationTypes,
  patchLocationTypes,
  type UpsertLocationTypePayload,
} from "@/lib/api/location-types"
import type { LocationType } from "@/lib/types"

type EditableLocationType = {
  location_type_id?: string | null
  slug: string
  title: string
  collection_point: boolean
  delivery_point: boolean
  sequence: number
  icon: string
  color: string
  default: boolean
  merchant_id: string
}

type FormValues = {
  merchant_id: string
  slug: string
  title: string
  collection_point: boolean
  delivery_point: boolean
  sequence: string
  icon: string
  color: string
  default: boolean
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim()
}

function createFormValues(
  merchantId: string,
  item?: EditableLocationType
): FormValues {
  return {
    merchant_id: item?.merchant_id ?? merchantId,
    slug: item?.slug ?? "",
    title: item?.title ?? "",
    collection_point: item?.collection_point ?? false,
    delivery_point: item?.delivery_point ?? false,
    sequence: String(item?.sequence ?? 0),
    icon: item?.icon ?? "",
    color: item?.color ?? "",
    default: item?.default ?? false,
  }
}

function fromApiItem(item: LocationType, fallbackMerchantId: string): EditableLocationType {
  return {
    location_type_id: item.location_type_id ?? null,
    slug: item.slug ?? "",
    title: item.title ?? "",
    collection_point: Boolean(item.collection_point),
    delivery_point: Boolean(item.delivery_point),
    sequence: Number.isFinite(item.sequence) ? Number(item.sequence) : 0,
    icon: item.icon ?? "",
    color: item.color ?? "",
    default: Boolean(item.default),
    merchant_id: item.merchant_id ?? fallbackMerchantId,
  }
}

function reorderItems(items: EditableLocationType[], fromIndex: number, toIndex: number) {
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return items
  next.splice(toIndex, 0, moved)
  return next.map((item, index) => ({ ...item, sequence: index + 1 }))
}

function serializeItems(items: EditableLocationType[]) {
  const normalized = items.map((item) => ({
    location_type_id: item.location_type_id ?? null,
    slug: normalizeText(item.slug),
    title: normalizeText(item.title),
    collection_point: item.collection_point,
    delivery_point: item.delivery_point,
    sequence: Math.max(0, Number(item.sequence) || 0),
    icon: normalizeText(item.icon),
    color: normalizeText(item.color),
    default: item.default,
    merchant_id: normalizeText(item.merchant_id),
  }))

  return JSON.stringify(normalized)
}

export function LocationTypesManager({
  accessToken,
  merchantId,
}: {
  accessToken?: string
  merchantId?: string | null
}) {
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [types, setTypes] = React.useState<EditableLocationType[]>([])
  const [initialSerialized, setInitialSerialized] = React.useState("[]")
  const [isFallback, setIsFallback] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null)
  const [formValues, setFormValues] = React.useState<FormValues>(() =>
    createFormValues(merchantId ?? "")
  )
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null)

  const currentSerialized = React.useMemo(() => serializeItems(types), [types])
  const hasUnsavedChanges = currentSerialized !== initialSerialized

  const loadLocationTypes = React.useCallback(async () => {
    if (!merchantId) return
    setLoading(true)
    const response = await listLocationTypes(accessToken, { merchant_id: merchantId })

    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to load location types.")
      setLoading(false)
      return
    }

    if (!response.success) {
      toast.error("Failed to load location types.")
      setLoading(false)
      return
    }

    const mapped = (response.data ?? []).map((item) => fromApiItem(item, merchantId))
    setTypes(mapped)
    setInitialSerialized(serializeItems(mapped))
    setIsFallback(Boolean(response.meta?.is_default_fallback))
    setLoading(false)
  }, [accessToken, merchantId])

  React.useEffect(() => {
    loadLocationTypes()
  }, [loadLocationTypes])

  const openCreateDialog = () => {
    setEditingIndex(null)
    setFormValues(
      createFormValues(merchantId ?? "", {
        merchant_id: merchantId ?? "",
        slug: "",
        title: "",
        collection_point: false,
        delivery_point: false,
        sequence: types.length + 1,
        icon: "",
        color: "",
        default: false,
      })
    )
    setDialogOpen(true)
  }

  const openEditDialog = (index: number) => {
    const item = types[index]
    if (!item) return
    setEditingIndex(index)
    setFormValues(createFormValues(merchantId ?? "", item))
    setDialogOpen(true)
  }

  const onChangeForm = (field: keyof FormValues, value: string | boolean) => {
    setFormValues((prev) => ({ ...prev, [field]: value }))
  }

  const submitDialog = () => {
    const merchantValue = normalizeText(formValues.merchant_id)
    const slug = normalizeText(formValues.slug)
    const title = normalizeText(formValues.title)
    const sequenceParsed = Number.parseInt(formValues.sequence, 10)

    if (!title) {
      toast.error("Title is required.")
      return
    }
    if (!merchantValue) {
      toast.error("Merchant ID is required.")
      return
    }
    if (!Number.isFinite(sequenceParsed) || sequenceParsed < 0) {
      toast.error("Sequence must be a number greater than or equal to 0.")
      return
    }

    const current = editingIndex != null ? types[editingIndex] : undefined
    const nextType: EditableLocationType = {
      location_type_id: current?.location_type_id ?? null,
      merchant_id: merchantValue,
      slug,
      title,
      collection_point: Boolean(formValues.collection_point),
      delivery_point: Boolean(formValues.delivery_point),
      sequence: sequenceParsed,
      icon: normalizeText(formValues.icon),
      color: normalizeText(formValues.color),
      default: Boolean(formValues.default),
    }

    setTypes((prev) => {
      if (editingIndex == null) {
        return [...prev, nextType]
      }
      const next = [...prev]
      next[editingIndex] = nextType
      return next
    })
    setDialogOpen(false)
  }

  const removeType = (index: number) => {
    const item = types[index]
    if (!item) return
    const label = item.title || item.slug || "this location type"
    const confirmed = window.confirm(`Delete ${label}? Save changes to apply.`)
    if (!confirmed) return

    setTypes((prev) =>
      prev
        .filter((_, itemIndex) => itemIndex !== index)
        .map((entry, itemIndex) => ({ ...entry, sequence: itemIndex + 1 }))
    )
  }

  const onDragStart = (index: number) => {
    setDraggingIndex(index)
  }

  const onDrop = (targetIndex: number) => {
    if (draggingIndex == null || draggingIndex === targetIndex) {
      setDraggingIndex(null)
      return
    }

    setTypes((prev) => reorderItems(prev, draggingIndex, targetIndex))
    setDraggingIndex(null)
  }

  const buildPatchPayload = (): UpsertLocationTypePayload[] => {
    return types.map((item, index) => {
      const slug = normalizeText(item.slug)
      const payload: UpsertLocationTypePayload = {
        title: normalizeText(item.title),
        collection_point: item.collection_point,
        delivery_point: item.delivery_point,
        sequence: Number.isFinite(item.sequence) ? Math.max(0, item.sequence) : index + 1,
        icon: normalizeText(item.icon) || null,
        color: normalizeText(item.color) || null,
        default: item.default,
      }

      if (item.location_type_id) {
        payload.location_type_id = item.location_type_id
      }
      if (slug) {
        payload.slug = slug
      }

      return payload
    })
  }

  const saveChanges = async () => {
    if (!merchantId) {
      toast.error("Select a merchant before managing location types.")
      return
    }

   

    setSaving(true)
    const response = await patchLocationTypes(
      {
        merchant_id: merchantId,
        types: buildPatchPayload(),
      },
      accessToken
    )

    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to save location types.")
      setSaving(false)
      return
    }

    if (!response.success) {
      toast.error("Failed to save location types.")
      setSaving(false)
      return
    }

    toast.success("Location types saved.")
    await loadLocationTypes()
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Location Types"
        description="Manage location type labels, behavior flags, and display order."
        actions={
          <>
            <Button variant="outline" onClick={openCreateDialog} disabled={!merchantId || saving}>
              <Plus className="h-4 w-4" />
              New type
            </Button>
            <Button onClick={saveChanges} disabled={!hasUnsavedChanges || saving || loading || !merchantId}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </>
        }
      />

      {!merchantId ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Select a merchant to manage location types.
          </CardContent>
        </Card>
      ) : null}

      {merchantId ? (
        <Card>
          <CardContent className="space-y-4 p-4 md:p-6">
            {isFallback ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
                Showing fallback defaults. Save changes to persist merchant-specific location types.
              </div>
            ) : null}

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading location types...
              </div>
            ) : types.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No location types yet. Create one to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {types.map((type, index) => (
                  <div
                    key={type.location_type_id ?? `new-${index}`}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border/70 bg-background px-3 py-2"
                    draggable
                    onDragStart={() => onDragStart(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => onDrop(index)}
                  >
                    <button
                      type="button"
                      className="cursor-grab text-muted-foreground hover:text-foreground"
                      aria-label="Drag to reorder"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <div className="min-w-[180px] flex-1">
                      <div
                        onClick={() => openEditDialog(index)}
                        className="cursor-pointer text-sm font-medium">{type.title || type.slug}</div>
                    </div>
                    
                    {type.collection_point ? <Badge>Collection</Badge> : null}
                    {type.delivery_point ? <Badge variant="secondary">Delivery</Badge> : null}
                    {type.default ? <Badge variant="secondary">Default</Badge> : null}
                    {type.color ? (
                      <span
                        className="h-4 w-4 rounded-full border border-border"
                        style={{ backgroundColor: type.color }}
                        aria-hidden="true"
                      />
                    ) : null}
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(index)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeType(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingIndex == null ? "Create location type" : "Edit location type"}</DialogTitle>
            <DialogDescription>
              Configure label, usage flags, and display settings.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            {/* <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Merchant ID</label>
              <Input
                value={formValues.merchant_id}
                onChange={(event) => onChangeForm("merchant_id", event.target.value)}
                disabled={editingIndex != null}
              />
            </div> */}
            <div className="grid gap-3 md:grid-cols-1">
              {/* <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Slug</label>
                <Input
                  value={formValues.slug}
                  onChange={(event) => onChangeForm("slug", event.target.value)}
                  required
                />
              </div> */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Title</label>
                <Input
                  value={formValues.title}
                  onChange={(event) => onChangeForm("title", event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {/* <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Sequence</label>
                <Input
                  type="number"
                  min={0}
                  value={formValues.sequence}
                  onChange={(event) => onChangeForm("sequence", event.target.value)}
                />
              </div> */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Icon</label>
                <Input
                  value={formValues.icon}
                  onChange={(event) => onChangeForm("icon", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Color</label>
                <Input
                  type="color"
                  value={formValues.color}
                  onChange={(event) => onChangeForm("color", event.target.value)}
                  placeholder="#16A34A"
                />
              </div>
            </div>

            <div className=" gap-3 rounded-md border border-border/70 p-3 flex flex-col">
              <div className="flex items-center justify-start gap-3">
                <Switch
                  checked={formValues.collection_point}
                  onCheckedChange={(checked) => onChangeForm("collection_point", checked)}
                />
                <label className="text-xs">Collection point</label>
              </div>
              <div className="flex items-center justify-start gap-3">
                
                <Switch
                  checked={formValues.delivery_point}
                  onCheckedChange={(checked) => onChangeForm("delivery_point", checked)}
                />
                <label className="text-xs">Delivery point</label>
              </div>
         
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitDialog}>{editingIndex == null ? "Add type" : "Update type"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
