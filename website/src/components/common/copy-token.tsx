"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Copy } from "lucide-react"

export function CopyToken({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success("Token copied.")
      window.setTimeout(() => setCopied(false), 1200)
    } catch (err) {
      toast.error("Failed to copy token."+ (err instanceof Error ? " " + err.message : ""))
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="max-w-[220px] truncate text-xs text-muted-foreground">
        {value}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>
          {copied ? "Copied" : "Copy"}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
