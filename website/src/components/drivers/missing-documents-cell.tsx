"use client"

import Link from "next/link"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function MissingDocumentsCell({ documents, href }: { documents?: string[]; href?: string }) {
  if (!documents) return <span className="text-muted-foreground">—</span>
  if (documents.length === 0) return <span className="text-muted-foreground">0</span>

  const label = `${documents.length} missing document${documents.length === 1 ? "" : "s"}`
  const className = "inline-flex min-w-8 items-center justify-center rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-sm font-medium text-amber-700 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          {href ? (
            <Link href={href} aria-label={label} className={className}>{documents.length}</Link>
          ) : (
            <button type="button" aria-label={label} className={className}>{documents.length}</button>
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-80 p-3 text-left shadow-md">
          <p className="mb-2 font-medium">Missing documents</p>
          <ul className="list-disc space-y-1 pl-4 whitespace-normal break-words">
            {documents.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
