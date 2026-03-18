"use client"

import * as React from "react"
import { toast } from "sonner"
import { useSearchParams } from "next/navigation"
import { DataTable } from "@/components/common/data-table"
import { createFileType, listFileTypes, updateFileType } from "@/lib/api/file-types"
import { isApiErrorResponse } from "@/lib/api/client"
import type { FileType } from "@/lib/types"
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
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

type EntityType = "shipment" | "driver" | "vehicle"

type FormValues = {
  entity_type: EntityType
  name: string
  slug: string
  description: string
  requires_expiry: boolean
  driver_can_upload: boolean
  is_active: boolean
  sort_order: string
}

function createDefaultForm(entityType: EntityType): FormValues {
  return {
    entity_type: entityType,
    name: "",
    slug: "",
    description: "",
    requires_expiry: false,
    driver_can_upload: false,
    is_active: true,
    sort_order: "0",
  }
}

async function fetchFileTypes(
  accessToken: string | undefined,
  merchantId: string | null | undefined,
  entityType: EntityType
) {
  if (!accessToken || !merchantId) {
    return []
  }

  const response = await listFileTypes(accessToken, {
    merchant_id: merchantId,
    entity_type: entityType,
    per_page: 200,
  })

  if (isApiErrorResponse(response)) {
    throw new Error(response.message || "Failed to load file types.")
  }

  return response.data ?? []
}

export function FileTypesManager({
  accessToken,
  merchantId,
}: {
  accessToken?: string
  merchantId?: string | null
}) {
  const searchParams = useSearchParams()
  const currentEntityType =
    (searchParams.get("entity_type") as EntityType | null) ?? "shipment"
  const [items, setItems] = React.useState<FileType[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<FileType | null>(null)
  const [form, setForm] = React.useState<FormValues>(createDefaultForm(currentEntityType))

  React.useEffect(() => {
    let cancelled = false

    const loadItems = async () => {
      setLoading(true)

      try {
        const nextItems = await fetchFileTypes(
          accessToken,
          merchantId,
          currentEntityType
        )

        if (!cancelled) {
          setItems(nextItems)
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "Failed to load file types."
          toast.error(message)
          setItems([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadItems()

    return () => {
      cancelled = true
    }
  }, [accessToken, currentEntityType, merchantId])

  React.useEffect(() => {
    if (!open) {
      setForm(createDefaultForm(currentEntityType))
      setEditing(null)
    }
  }, [currentEntityType, open])

  const openCreate = () => {
    setEditing(null)
    setForm(createDefaultForm(currentEntityType))
    setOpen(true)
  }

  const openEdit = (item: FileType) => {
    setEditing(item)
    setForm({
      entity_type: item.entity_type,
      name: item.name,
      slug: item.slug ?? "",
      description: item.description ?? "",
      requires_expiry: Boolean(item.requires_expiry),
      driver_can_upload: Boolean(item.driver_can_upload),
      is_active: Boolean(item.is_active),
      sort_order: String(item.sort_order ?? 0),
    })
    setOpen(true)
  }

  const handleSave = async () => {
    if (!merchantId) {
      toast.error("Merchant is required.")
      return
    }
    if (!form.name.trim()) {
      toast.error("Name is required.")
      return
    }

    setSaving(true)

    try {
      const payload = {
        merchant_id: merchantId,
        entity_type: form.entity_type,
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || undefined,
        requires_expiry: form.requires_expiry,
        driver_can_upload: form.driver_can_upload,
        is_active: form.is_active,
        sort_order: Number(form.sort_order || 0),
      }

      const response = editing
        ? await updateFileType(editing.file_type_id, payload, accessToken)
        : await createFileType(payload, accessToken)

      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Failed to save file type.")
        return
      }

      toast.success(editing ? "File type updated." : "File type created.")
      const nextItems = await fetchFileTypes(
        accessToken,
        merchantId,
        currentEntityType
      )
      setItems(nextItems)
      setOpen(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to refresh file types."
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const rows = items.map((item) => ({
    ...item,
    requires_expiry_label: item.requires_expiry ? "Yes" : "No",
    driver_upload_label: item.driver_can_upload ? "Yes" : "No",
    active_label: item.is_active ? "Active" : "Inactive",
    actions: (
      <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
        Edit
      </Button>
    ),
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>New file type</Button>
      </div>
      <DataTable
        views={[
          { label: "Shipments", link: `?entity_type=shipment` },
          { label: "Drivers", link: `?entity_type=driver` },
          { label: "Vehicles", link: `?entity_type=vehicle` },
        ]}
        data={rows}
        loading_error={loading ? "Loading file types..." : null}
        emptyMessage="No file types configured."
        searchKeys={["name", "slug", "description"]}
        columns={[
          { key: "name", label: "Name" },
          { key: "slug", label: "Slug" },
          { key: "description", label: "Description" },
          { key: "requires_expiry_label", label: "Requires expiry" },
          { key: "driver_upload_label", label: "Driver can upload" },
          { key: "active_label", label: "Status" },
          { key: "sort_order", label: "Sort order" },
          { key: "actions", label: "", customValue: (row) => row.actions },
        ]}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit file type" : "New file type"}</DialogTitle>
            <DialogDescription>
              Configure merchant-specific file types for uploads.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Sort order</Label>
              <Input value={form.sort_order} onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Requires expiry</Label>
              <Switch checked={form.requires_expiry} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, requires_expiry: checked }))} />
            </div>
            {form.entity_type !== "vehicle" ? (
              <div className="flex items-center justify-between">
                <Label>Driver can upload</Label>
                <Switch checked={form.driver_can_upload} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, driver_can_upload: checked }))} />
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
