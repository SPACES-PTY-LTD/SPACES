"use client"

import { useId } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { automationTimestamp, parseRecordedAutomation } from "./recorded-stop-automation"

export function RecordedStopAutomationPopover({ metadata }: { metadata: unknown }) {
  const titleId = useId()
  const actions = parseRecordedAutomation(metadata)
  if (!actions.length) return <span className="text-muted-foreground">—</span>
  return <Popover>
    <PopoverTrigger asChild><Button variant="outline" size="sm">Explain</Button></PopoverTrigger>
    <PopoverContent align="start" aria-labelledby={titleId} className="w-[420px] max-w-[calc(100vw-2rem)] max-h-[min(70vh,var(--radix-popover-content-available-height))] overflow-y-auto space-y-4">
      <h3 id={titleId} className="font-semibold">Automation at this stop</h3>
      <p className="text-sm text-muted-foreground">These recorded rules matched and were invoked. This does not confirm that a new run or shipment was created.</p>
      <ol className="space-y-4">
        {actions.map((action, index) => <li key={index} className="space-y-2 border-t pt-3 text-sm break-words">
          <p className="font-medium">{index + 1}. {action.action}</p>
          <p className="text-muted-foreground">{action.trigger} · {automationTimestamp(action.executedAt)}</p>
          {action.conditions.length > 0 && <ul className="list-disc space-y-1 pl-5">{action.conditions.map((condition, i) => <li key={i}>{condition}</li>)}</ul>}
          {action.conditionsUnavailable ? <p className="text-muted-foreground">Some condition details were not recorded.</p> : !action.conditions.length && <p className="text-muted-foreground">No conditions.</p>}
        </li>)}
      </ol>
    </PopoverContent>
  </Popover>
}
