import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  paused: "bg-sky-100 text-sky-700 border-sky-200",
  failed: "bg-rose-100 text-rose-700 border-rose-200",
  archived: "bg-stone-100 text-stone-600 border-stone-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  ready: "bg-indigo-100 text-indigo-700 border-indigo-200",
  booked: "bg-amber-100 text-amber-700 border-amber-200",
  in_transit: "bg-cyan-100 text-cyan-700 border-cyan-200",
  delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  exception: "bg-rose-100 text-rose-700 border-rose-200",
  cancelled: "bg-stone-100 text-stone-600 border-stone-200",
  assigned: "bg-violet-100 text-violet-700 border-violet-200",
  en_route: "bg-sky-100 text-sky-700 border-sky-200",
  picked_up: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
}

export function StatusBadge({ status }: { status: string }) {
  if(!status) {
    return null
  }
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", STATUS_STYLES[status] ?? "")}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  )
}
