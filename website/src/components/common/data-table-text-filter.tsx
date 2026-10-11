"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"

export function DataTableTextFilter({
  value,
  onValueChange,
  submitOnEnter = false,
  placeholder,
}: {
  value: string
  onValueChange: (value: string) => void
  submitOnEnter?: boolean
  placeholder: string
}) {
  const [draft, setDraft] = React.useState({ appliedValue: value, value })

  // Follow committed filters when navigation changes the applied value.
  if (draft.appliedValue !== value) {
    setDraft({ appliedValue: value, value })
  }

  return (
    <Input
      value={submitOnEnter ? draft.value : value}
      onChange={(event) => {
        if (submitOnEnter) {
          setDraft({ appliedValue: value, value: event.target.value })
        } else {
          onValueChange(event.target.value)
        }
      }}
      onKeyDown={(event) => {
        if (submitOnEnter && event.key === "Enter" && !event.nativeEvent.isComposing) {
          event.preventDefault()
          onValueChange(draft.value)
        }
      }}
      className="h-9 w-[220px] text-sm"
      placeholder={placeholder}
      aria-label={placeholder}
    />
  )
}
