"use client"

import * as React from "react"
import { Check, ChevronsUpDown, ListFilter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import type { ScheduleFilters, TruckFilterOptions } from "@/lib/api/schedule"
import { cn } from "@/lib/utils"

type TruckFilters = Pick<ScheduleFilters, "fleet_status" | "availability" | "truck_id" | "truck_tags">
const defaults: TruckFilters = { fleet_status: "active", availability: "all", truck_id: "", truck_tags: "" }

export function TruckFiltersDialog({ filters, options, disabled, onApply }: {
  filters: ScheduleFilters; options?: TruckFilterOptions; disabled: boolean
  onApply: (filters: TruckFilters) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<TruckFilters>(defaults)
  const [registrationOpen, setRegistrationOpen] = React.useState(false)
  const [tagsOpen, setTagsOpen] = React.useState(false)
  const tagIds = draft.truck_tags?.split(",").filter(Boolean) ?? []
  const count = Number(filters.fleet_status !== "all") + Number(filters.availability !== "all") + Number(!!filters.truck_id) + Number(!!filters.truck_tags)
  const registration = options?.vehicles.find(vehicle => vehicle.vehicle_id === draft.truck_id)?.plate_number
  function changeOpen(value: boolean) {
    if (value) setDraft({ fleet_status: filters.fleet_status, availability: filters.availability, truck_id: filters.truck_id ?? "", truck_tags: filters.truck_tags ?? "" })
    setRegistrationOpen(false); setTagsOpen(false); setOpen(value)
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" size="icon" disabled={disabled} aria-label={`Filter trucks${count ? ` (${count} active)` : ""}`} className="relative"><ListFilter className="size-4" />{count > 0 && <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{count}</span>}</Button></DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Filter trucks</DialogTitle><DialogDescription>Combine filters to narrow the truck list.</DialogDescription></DialogHeader>
      <div className="grid gap-5 py-2">
        <div className="grid gap-2"><Label htmlFor="truck-active">Active</Label><select id="truck-active" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.fleet_status} onChange={event => setDraft(old => ({ ...old, fleet_status: event.target.value }))}><option value="all">All trucks</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
        <div className="grid gap-2"><Label htmlFor="truck-availability">Availability</Label><select id="truck-availability" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.availability} onChange={event => setDraft(old => ({ ...old, availability: event.target.value }))}><option value="all">All availability</option><option value="available">Available</option><option value="busy">Ready / Active run</option></select></div>
        <div className="grid gap-2"><Label>Tags</Label><Popover open={tagsOpen} onOpenChange={setTagsOpen}><PopoverTrigger asChild><Button variant="outline" role="combobox" aria-label="Truck tags" aria-expanded={tagsOpen} className="w-full justify-between font-normal"><span className="truncate">{tagIds.length ? `${tagIds.length} tag${tagIds.length === 1 ? "" : "s"} selected` : "All tags"}</span><ChevronsUpDown className="size-4 shrink-0 opacity-50" /></Button></PopoverTrigger><PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0"><Command><CommandInput placeholder="Search tags…" /><CommandList><CommandEmpty>No matching tags.</CommandEmpty>{options?.tags.map(tag => <CommandItem key={tag.tag_id} value={tag.tag_id} keywords={[tag.name]} onSelect={() => setDraft(old => { const selected = old.truck_tags?.split(",").filter(Boolean) ?? []; return { ...old, truck_tags: (selected.includes(tag.tag_id) ? selected.filter(id => id !== tag.tag_id) : [...selected, tag.tag_id]).join(",") } })}><Check className={cn("size-4", !tagIds.includes(tag.tag_id) && "opacity-0")} />{tag.name}</CommandItem>)}</CommandList></Command></PopoverContent></Popover>
          {tagIds.length > 0 && <div className="flex flex-wrap gap-1">{tagIds.map(id => <Button key={id} variant="secondary" size="xs" aria-label={`Remove tag ${options?.tags.find(tag => tag.tag_id === id)?.name ?? id}`} onClick={() => setDraft(old => ({ ...old, truck_tags: tagIds.filter(value => value !== id).join(",") }))}>{options?.tags.find(tag => tag.tag_id === id)?.name ?? id} ×</Button>)}</div>}<p className="text-xs text-muted-foreground">Match any selected tag.</p>
        </div>
        <div className="grid gap-2"><Label>Registration number</Label><Popover open={registrationOpen} onOpenChange={setRegistrationOpen}><PopoverTrigger asChild><Button variant="outline" role="combobox" aria-label="Registration number" aria-expanded={registrationOpen} className="w-full justify-between font-normal"><span className="truncate">{registration || (draft.truck_id ? "Selected truck" : "All registration numbers")}</span><ChevronsUpDown className="size-4 shrink-0 opacity-50" /></Button></PopoverTrigger><PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0"><Command><CommandInput placeholder="Search registration numbers…" /><CommandList><CommandEmpty>No matching registration numbers.</CommandEmpty><CommandItem value="all-registration-numbers" onSelect={() => { setDraft(old => ({ ...old, truck_id: "" })); setRegistrationOpen(false) }}>All registration numbers</CommandItem>{options?.vehicles.map(vehicle => <CommandItem key={vehicle.vehicle_id} value={vehicle.vehicle_id} keywords={[vehicle.plate_number]} onSelect={() => { setDraft(old => ({ ...old, truck_id: vehicle.vehicle_id })); setRegistrationOpen(false) }}><Check className={cn("size-4", draft.truck_id !== vehicle.vehicle_id && "opacity-0")} />{vehicle.plate_number}</CommandItem>)}</CommandList></Command></PopoverContent></Popover></div>
      </div>
      <DialogFooter className="gap-2"><Button variant="ghost" className="sm:mr-auto" onClick={() => setDraft({ ...defaults, fleet_status: "all" })}>Reset</Button><Button variant="outline" onClick={() => changeOpen(false)}>Cancel</Button><Button disabled={disabled} onClick={() => { onApply(draft); changeOpen(false) }}>Apply filters</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
