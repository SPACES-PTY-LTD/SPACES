"use client"

import { Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/status-badge"
import { downloadDeliveryNoteImport } from "@/lib/api/delivery-note-imports"
import { isApiErrorResponse } from "@/lib/api/client"
import type { DeliveryNoteImport } from "@/lib/types"

export function DeliveryNoteImportList({
  imports, accessToken, runId,
}: {
  imports: DeliveryNoteImport[]
  accessToken: string
  runId?: string
}) {
  const download = async (item: DeliveryNoteImport) => {
    const response = await downloadDeliveryNoteImport(runId ?? item.run_id, item.import_id, accessToken)
    if (isApiErrorResponse(response)) return toast.error(response.message)
    const url = URL.createObjectURL(response)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = item.original_name
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-2">
      {imports.map((item) => (
        <div key={item.import_id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <div className="min-w-0">
            <div className="truncate font-medium">{item.original_name}</div>
            <StatusBadge status={item.status} />
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={() => void download(item)}>
            <Download className="h-4 w-4" />
            <span className="sr-only">Download {item.original_name}</span>
          </Button>
        </div>
      ))}
    </div>
  )
}
