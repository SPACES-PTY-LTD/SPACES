"use client"

import * as React from "react"
import moment from "moment"
import { toast } from "sonner"
import { DataTable } from "@/components/common/data-table"
import type { Column } from "@/components/common/data-table"
import { DatePicker } from "@/components/common/date-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { deleteEntityFile, getEntityFileDownloadUrl, listDriverFiles, listShipmentFiles, listVehicleFiles, uploadDriverFile, uploadShipmentFile, uploadVehicleFile } from "@/lib/api/entity-files"
import { listFileTypes } from "@/lib/api/file-types"
import { isApiErrorResponse } from "@/lib/api/client"
import type { EntityFile, FileType } from "@/lib/types"
import { format } from "date-fns"

type EntityType = "shipment" | "driver" | "vehicle"

function formatBytes(value?: number) {
  if (!value || value <= 0) return "-"
  const units = ["B", "KB", "MB", "GB"]
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

export function EntityFilesSection({
  entityType,
  entityId,
  accessToken,
  merchantId,
  title,
  sectionId,
  hideExpiryColumn = false,
  hideStatusColumn = false,
}: {
  entityType: EntityType
  entityId: string
  accessToken?: string
  merchantId?: string | null
  title: string
  sectionId?: string
  hideExpiryColumn?: boolean
  hideStatusColumn?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [files, setFiles] = React.useState<EntityFile[]>([])
  const [fileTypes, setFileTypes] = React.useState<FileType[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [selectedTypeId, setSelectedTypeId] = React.useState("")
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [expiresAt, setExpiresAt] = React.useState<Date | undefined>(undefined)
  const [error, setError] = React.useState<string | null>(null)

  const selectedType =
    fileTypes.find((item) => item.file_type_id === selectedTypeId) ?? null

  const loadData = React.useCallback(async () => {
    if (!accessToken || !entityId) return

    setLoading(true)
    const [fileTypesResponse, filesResponse] = await Promise.all([
      merchantId
        ? listFileTypes(accessToken, {
            merchant_id: merchantId,
            entity_type: entityType,
            is_active: true,
            per_page: 200,
          })
        : Promise.resolve({ data: [] } as { data: FileType[] }),
      entityType === "shipment"
        ? listShipmentFiles(entityId, accessToken)
        : entityType === "driver"
          ? listDriverFiles(entityId, accessToken)
          : listVehicleFiles(entityId, accessToken, { merchant_id: merchantId ?? undefined }),
    ])

    if (isApiErrorResponse(fileTypesResponse)) {
      toast.error(fileTypesResponse.message || "Failed to load file types.")
    } else {
      setFileTypes(fileTypesResponse.data ?? [])
    }

    if (isApiErrorResponse(filesResponse)) {
      toast.error(filesResponse.message || "Failed to load files.")
      setFiles([])
    } else {
      setFiles(filesResponse.data ?? [])
    }

    setLoading(false)
  }, [accessToken, entityId, entityType, merchantId])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  const handleUpload = async () => {
    if (!selectedTypeId) {
      setError("File type is required.")
      return
    }
    if (!selectedFile) {
      setError("File is required.")
      return
    }
    if (selectedType?.requires_expiry && !expiresAt) {
      setError("Expiry date is required for this file type.")
      return
    }

    setSaving(true)
    setError(null)
    const payload = {
      merchant_id: merchantId ?? undefined,
      file_type_id: selectedTypeId,
      file: selectedFile,
      expires_at: expiresAt ? format(expiresAt, "yyyy-MM-dd") : undefined,
    }
    const response =
      entityType === "shipment"
        ? await uploadShipmentFile(entityId, payload, accessToken)
        : entityType === "driver"
          ? await uploadDriverFile(entityId, payload, accessToken)
          : await uploadVehicleFile(entityId, payload, accessToken)

    if (isApiErrorResponse(response)) {
      setError(response.message || "Failed to upload file.")
      setSaving(false)
      return
    }

    toast.success("File uploaded.")
    setOpen(false)
    setSelectedTypeId("")
    setSelectedFile(null)
    setExpiresAt(undefined)
    setSaving(false)
    void loadData()
  }

  const handleDelete = async (fileId: string) => {
    const response = await deleteEntityFile(fileId, accessToken)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to delete file.")
      return
    }
    toast.success("File deleted.")
    void loadData()
  }

  const handleDownload = async (fileId: string) => {
    const response = await getEntityFileDownloadUrl(fileId, accessToken)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Failed to get download URL.")
      return
    }

    window.open(response, "_blank", "noopener,noreferrer")
  }

  const rows = files.map((file) => ({
    ...file,
    type_name: file.file_type?.name ?? "-",
    expiry_display: file.expires_at
      ? moment(file.expires_at).format("YYYY-MM-DD")
      : "-",
    status_display: file.is_expired ? "Expired" : file.expires_at ? "Active" : "No expiry",
    uploaded_by_name: file.uploaded_by_user?.name ?? file.uploaded_by_role ?? "-",
    size_display: formatBytes(file.size_bytes),
    actions: (
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => void handleDownload(file.file_id)}>
          Download
        </Button>
        <Button size="sm" variant="outline" onClick={() => void handleDelete(file.file_id)}>
          Delete
        </Button>
      </div>
    ),
  }))

  const columnDefinitions: Array<Column<(typeof rows)[number]> | null> = [
    { key: "original_name", label: "File name" },
    { key: "type_name", label: "Type" },
    { key: "size_display", label: "Size" },
    hideExpiryColumn ? null : { key: "expiry_display", label: "Expiry" },
    hideStatusColumn ? null : { key: "status_display", label: "Status" },
    { key: "uploaded_by_name", label: "Uploaded by" },
    {
      key: "created_at",
      label: "Uploaded",
      type: "date_time" as const,
      format: "YYYY-MM-DD HH:mm",
    },
    { key: "actions", label: "", customValue: (row: (typeof rows)[number]) => row.actions },
  ]
  const columns = columnDefinitions.filter(
    (column): column is Column<(typeof rows)[number]> => column !== null
  )

  return (
    <Card id={sectionId}>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold">{title}</div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Upload file</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload file</DialogTitle>
                <DialogDescription>
                  Upload a file for this {entityType}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>File type</Label>
                  <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select file type" />
                    </SelectTrigger>
                    <SelectContent>
                      {fileTypes.map((fileType) => (
                        <SelectItem key={fileType.file_type_id} value={fileType.file_type_id}>
                          {fileType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>File</Label>
                  <Input
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      setSelectedFile(file)
                    }}
                  />
                </div>
                {selectedType?.requires_expiry ? (
                  <div className="space-y-2">
                    <Label>Expiry date</Label>
                    <DatePicker
                      value={expiresAt}
                      onChange={setExpiresAt}
                      placeholder="Select expiry date"
                      className="w-full justify-start"
                    />
                  </div>
                ) : null}
                {error ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={() => void handleUpload()} disabled={saving}>
                  {saving ? "Uploading..." : "Upload"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <DataTable
          data={rows}
          loading_error={loading ? "Loading files..." : null}
          emptyMessage="No files uploaded."
          searchKeys={["original_name", "type_name", "uploaded_by_name", "status_display"]}
          columns={columns}
        />
      </CardContent>
    </Card>
  )
}
