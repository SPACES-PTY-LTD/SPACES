"use client"

import { useEffect, useState } from "react"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { downloadDeliveryNoteImport } from "@/lib/api/delivery-note-imports"
import { isApiErrorResponse } from "@/lib/api/client"
import type { Run } from "@/lib/types"

type NoteFile = NonNullable<Run["delivery_note_files"]>[number]

function FilePreview({ runId, file, accessToken }: { runId: string; file: NoteFile; accessToken?: string | null }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    async function load() {
      try {
        const response = await downloadDeliveryNoteImport(runId, file.import_id, accessToken)
        if (!active) return
        if (isApiErrorResponse(response)) {
          setError(response.message)
          return
        }
        objectUrl = URL.createObjectURL(response)
        setUrl(objectUrl)
      } catch {
        if (active) setError("Unable to load this delivery note. Please try again.")
      }
    }
    void load()
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [runId, file.import_id, accessToken, attempt])

  if (error) return <div role="alert" className="space-y-3 p-4"><p>{error}</p><Button variant="outline" onClick={() => { setError(null); setAttempt(value => value + 1) }}>Retry</Button></div>
  if (!url) return <p role="status" className="p-4 text-muted-foreground">Loading delivery note…</p>

  return <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
    <a href={url} download={file.original_name} className="text-sm text-primary underline">Download file</a>
    {file.mime_type === "application/pdf" ? (
      <iframe src={url} title={file.original_name} className="min-h-0 w-full flex-1 rounded-md border" />
    ) : ["image/jpeg", "image/png", "image/webp"].includes(file.mime_type) ? (
      <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/30">
        {/* Authenticated blob URLs are local and do not use the Next image optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={file.original_name} className="mx-auto h-auto max-w-full" />
      </div>
    ) : <p>This file cannot be previewed. Download it to view its contents.</p>}
  </div>
}

export function RunDeliveryNoteFilesCell({ runId, files, accessToken }: {
  runId: string
  files: NoteFile[]
  accessToken?: string | null
}) {
  const [selected, setSelected] = useState<NoteFile | null>(null)
  if (!files.length) return <span className="text-muted-foreground">No</span>

  return <>
    <div className="flex flex-col items-start gap-1">
      <span className="text-xs text-muted-foreground">Yes</span>
      {files.map(file => <button key={file.import_id} type="button" onClick={() => setSelected(file)}
        className="inline-flex max-w-[220px] items-center gap-1 text-left text-primary underline-offset-4 hover:underline focus-visible:outline-2">
        <FileText className="size-4 shrink-0" aria-hidden="true" /><span className="truncate" title={file.original_name}>{file.original_name}</span>
      </button>)}
    </div>
    <Sheet open={selected !== null} onOpenChange={open => { if (!open) setSelected(null) }}>
      <SheetContent className="w-full sm:max-w-4xl">
        <SheetHeader className="pr-12">
          <SheetTitle>Delivery note file</SheetTitle>
          <SheetDescription className="break-all">{selected?.original_name}</SheetDescription>
        </SheetHeader>
        {selected && <FilePreview key={selected.import_id} runId={runId} file={selected} accessToken={accessToken} />}
      </SheetContent>
    </Sheet>
  </>
}
