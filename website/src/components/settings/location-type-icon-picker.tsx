"use client"

import * as React from "react"
import Image from "next/image"
import { Check } from "lucide-react"
import { RadioGroup } from "radix-ui"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { findLocationTypeIcon, getLocationTypeIconPreview, LOCATION_TYPE_ICONS, type LocationTypeIconValue } from "@/lib/location-type-icons"

export function LocationTypeIconPreview({ value, size = 48 }: { value?: string | null; size?: number }) {
  const icon = getLocationTypeIconPreview(value)
  return <Image src={icon.image} alt="" width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />
}

export function LocationTypeIconPicker({ value, onChange }: { value: string; onChange: (value: LocationTypeIconValue) => void }) {
  const [open, setOpen] = React.useState(false)
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const [selection, setSelection] = React.useState<string>("")
  const knownIcon = findLocationTypeIcon(value)
  const preview = getLocationTypeIconPreview(value)

  return (
    <div className="space-y-2">
      <span className="text-xs text-muted-foreground">3D icon</span>
      <div className="flex items-center gap-3 rounded-lg border p-2">
        <LocationTypeIconPreview value={value} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{preview.label}</p>
          {!knownIcon ? <p className="break-words text-xs text-muted-foreground">{value ? `Current value: ${value}. Using Warehouse preview.` : "Default preview. No icon selected."}</p> : null}
        </div>
      </div>
      <Dialog open={open} onOpenChange={(nextOpen) => {
        if (nextOpen) setSelection(knownIcon?.value ?? "")
        setOpen(nextOpen)
      }}>
        <DialogTrigger asChild><Button variant="outline" type="button" className="w-full">Choose icon</Button></DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose a 3D icon</DialogTitle>
            <DialogDescription>Select the model used for this location type in shipment monitoring.</DialogDescription>
          </DialogHeader>
          <RadioGroup.Root
            onKeyDownCapture={(event) => {
              const index = optionRefs.current.indexOf(event.target as HTMLButtonElement)
              if (index < 0) return
              if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
              const step = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0
              if (!step && event.key !== "Home" && event.key !== "End") return
              event.preventDefault()
              const next = event.key === "Home" ? 0 : event.key === "End" ? LOCATION_TYPE_ICONS.length - 1 : (index + step + LOCATION_TYPE_ICONS.length) % LOCATION_TYPE_ICONS.length
              // Update selection together with focus; do not depend on deferred focus timing.
              setSelection(LOCATION_TYPE_ICONS[next].value)
              optionRefs.current[next]?.focus()
            }}
            aria-label="Location icons" value={selection} onValueChange={setSelection} className="grid max-h-[55dvh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3">
            {LOCATION_TYPE_ICONS.map((icon, index) => (
              <RadioGroup.Item key={icon.value} value={icon.value} aria-label={icon.label}
                ref={(element) => { optionRefs.current[index] = element }}
                className="relative flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 p-3 text-center transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=checked]:border-primary data-[state=checked]:bg-primary/10">
                <LocationTypeIconPreview value={icon.value} size={112} />
                <span className="text-sm font-medium">{icon.label}</span>
                <RadioGroup.Indicator className="absolute top-2 right-2 rounded-full bg-primary p-1 text-primary-foreground"><Check className="h-3 w-3" /></RadioGroup.Indicator>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" disabled={!findLocationTypeIcon(selection)} onClick={() => {
              const selected = findLocationTypeIcon(selection)
              if (selected) onChange(selected.value)
              setOpen(false)
            }}>Use icon</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
