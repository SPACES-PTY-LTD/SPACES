"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Download, FileText, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { isApiErrorResponse } from "@/lib/api/client"
import type { ImportCsvResult } from "@/lib/api/imports"

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file: File) {
  const fileName = file.name.toLowerCase()
  const isSupported = fileName.endsWith(".csv") || fileName.endsWith(".txt")
  if (!isSupported) {
    return "Only .csv and .txt files are supported."
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "File size must be 20MB or less."
  }
  return null
}

export function ImportCsvDialog({
  title,
  description,
  sampleHref,
  sampleLabel,
  actionLabel,
  successMessage,
  accessToken,
  merchantId,
  lockMerchant = false,
  onImport,
}: {
  title: string
  description: string
  sampleHref: string
  sampleLabel: string
  actionLabel: string
  successMessage: string
  accessToken?: string
  merchantId?: string | null
  lockMerchant?: boolean
  onImport: (payload: { merchant_id: string; file: File }, token?: string) => Promise<unknown>
}) {
  const router = useRouter()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [open, setOpen] = React.useState(false)
  const [dragActive, setDragActive] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [merchantValue, setMerchantValue] = React.useState(merchantId ?? "")
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [result, setResult] = React.useState<ImportCsvResult | null>(null)

  React.useEffect(() => {
    if (!open) return
    setMerchantValue(merchantId ?? "")
    setSelectedFile(null)
    setResult(null)
    setDragActive(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [merchantId, open])

  const assignFile = (file: File | null) => {
    if (!file) return
    const validationError = validateFile(file)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setSelectedFile(file)
    setResult(null)
  }

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    assignFile(file)
  }

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    const file = event.dataTransfer.files?.[0] ?? null
    assignFile(file)
  }

  const handleSubmit = async () => {
    const trimmedMerchantId = merchantValue.trim()
    if (!trimmedMerchantId) {
      toast.error("Merchant ID is required.")
      return
    }
    if (!isUuid(trimmedMerchantId)) {
      toast.error("Merchant ID must be a valid UUID.")
      return
    }
    if (!selectedFile) {
      toast.error("Select a CSV file to import.")
      return
    }

    setLoading(true)
    try {
      const response = await onImport(
        { merchant_id: trimmedMerchantId, file: selectedFile },
        accessToken
      )
      if (isApiErrorResponse(response)) {
        toast.error(response.message)
        return
      }
      const payload = response as { data?: ImportCsvResult }
      setResult(payload.data ?? null)
      toast.success(successMessage)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import CSV.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <p className="font-medium">Need a template?</p>
            <p className="mt-1 text-muted-foreground">
              Download a sample file with all supported columns and example rows.
            </p>
            <Link
              href={sampleHref}
              className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Download className="h-4 w-4" />
              {sampleLabel}
            </Link>
          </div>

          <div className="space-y-2 hidden">
            <label className="text-xs text-muted-foreground">Merchant ID</label>
            <Input
              value={merchantValue}
              onChange={(event) => setMerchantValue(event.target.value)}
              disabled={lockMerchant}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>

          <div className="space-y-2">
            <div
              className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                dragActive ? "border-primary bg-primary/5" : "border-border"
              }`}
              onDragEnter={(event) => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={(event) => {
                event.preventDefault()
                setDragActive(false)
              }}
              onDrop={onDrop}
            >
              <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Drag and drop your file here</p>
              <p className="text-xs text-muted-foreground">CSV or TXT, max 20MB</p>
              <div className="mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose file
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={onFileInputChange}
              />
            </div>
            {selectedFile ? (
              <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
                <div className="truncate">
                  <p className="truncate font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ""
                  }}
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </div>

          {result ? (
            <div className="rounded-lg border bg-card p-4 text-sm">
              <p className="font-medium">Import summary</p>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                <div className="rounded-md border bg-muted/20 px-2 py-1">
                  <p className="text-xs text-muted-foreground">Processed</p>
                  <p className="font-medium">{result.processed}</p>
                </div>
                <div className="rounded-md border bg-muted/20 px-2 py-1">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium">{result.created}</p>
                </div>
                <div className="rounded-md border bg-muted/20 px-2 py-1">
                  <p className="text-xs text-muted-foreground">Updated</p>
                  <p className="font-medium">{result.updated}</p>
                </div>
                <div className="rounded-md border bg-muted/20 px-2 py-1">
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className="font-medium">{result.failed}</p>
                </div>
              </div>
              {result.errors && result.errors.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Errors</p>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                    {result.errors.map((entry, index) => (
                      <div key={`${entry.line}-${index}`} className="text-xs">
                        <p className="font-medium">Line {entry.line}</p>
                        <p className="text-muted-foreground">{entry.errors.join(", ")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              actionLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
