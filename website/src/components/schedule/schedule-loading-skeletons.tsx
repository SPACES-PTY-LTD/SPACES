import { Skeleton } from "@/components/ui/skeleton"

export function ScheduleColumnSkeleton({ column }: { column: "drivers" | "runs" | "shipments" }) {
  return <div aria-hidden="true" className="space-y-3">
    {Array.from({ length: column === "runs" ? 3 : 5 }, (_, index) => column === "drivers" ? (
      <div key={index} className="flex min-h-16 items-center gap-2 border-b py-3">
        <Skeleton className="size-4 shrink-0 motion-reduce:animate-none" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-28 max-w-full motion-reduce:animate-none" />
          <Skeleton className="h-3 w-40 max-w-full motion-reduce:animate-none" />
        </div>
      </div>
    ) : column === "runs" ? (
      <div key={index} className="grid grid-cols-[112px_minmax(0,1fr)] border-b @min-[1100px]:grid-cols-[144px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-2 border-r py-3 pr-2">
          <Skeleton className="h-5 w-24 max-w-full motion-reduce:animate-none" />
          <Skeleton className="h-3 w-16 motion-reduce:animate-none" />
        </div>
        <div className="min-w-0 p-2">
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-20 motion-reduce:animate-none" />
              <Skeleton className="h-7 w-16 motion-reduce:animate-none" />
            </div>
            <Skeleton className="h-3 w-48 max-w-full motion-reduce:animate-none" />
            <Skeleton className="h-3 w-32 max-w-full motion-reduce:animate-none" />
            <div className="flex gap-2 overflow-hidden">
              <Skeleton className="h-11 w-[200px] shrink-0 motion-reduce:animate-none" />
              <Skeleton className="size-11 shrink-0 motion-reduce:animate-none" />
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div key={index} className="space-y-3 rounded-lg border p-3">
        <Skeleton className="h-4 w-32 max-w-full motion-reduce:animate-none" />
        <Skeleton className="h-3 w-16 motion-reduce:animate-none" />
        <Skeleton className="h-3 w-40 max-w-full motion-reduce:animate-none" />
        <Skeleton className="h-3 w-36 max-w-full motion-reduce:animate-none" />
        <Skeleton className="h-3 w-28 max-w-full motion-reduce:animate-none" />
        <Skeleton className="h-8 w-28 max-w-full motion-reduce:animate-none" />
      </div>
    ))}
  </div>
}

export function ScheduleLoadingSkeleton() {
  return <div role="status" className="@container flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
    <span className="sr-only">Loading schedule…</span>
    <div aria-hidden="true" className="flex shrink-0 flex-wrap items-center justify-between gap-3 bg-muted/20 px-4 py-3">
      <div className="min-w-0 space-y-2"><h1 className="text-[28px] font-semibold leading-tight">Schedule</h1><Skeleton className="h-5 w-96 max-w-full motion-reduce:animate-none" /></div>
      <div className="flex gap-2"><Skeleton className="h-9 w-24 motion-reduce:animate-none" /><Skeleton className="h-9 w-28 motion-reduce:animate-none" /></div>
    </div>
    <div aria-hidden="true" className="flex shrink-0 flex-wrap gap-2 border-y px-3 py-3">
      <Skeleton className="size-9 motion-reduce:animate-none" /><Skeleton className="h-9 w-40 motion-reduce:animate-none" /><Skeleton className="size-9 motion-reduce:animate-none" /><Skeleton className="ml-auto h-9 w-36 motion-reduce:animate-none" />
    </div>
    <div aria-hidden="true" className="grid shrink-0 grid-cols-3 gap-x-3 gap-y-2 border-b px-3 py-3 @min-[700px]:grid-cols-5">
      {Array.from({ length: 5 }, (_, index) => <div key={index} className="space-y-2"><Skeleton className="h-3 w-28 max-w-full motion-reduce:animate-none" /><Skeleton className="h-4 w-8 motion-reduce:animate-none" /></div>)}
    </div>
    <div aria-hidden="true" className="flex shrink-0 gap-1 border-b p-2 @min-[1100px]:hidden">
      {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-9 flex-1 motion-reduce:animate-none" />)}
    </div>
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 @min-[1100px]:grid-cols-[248px_minmax(0,1fr)_288px]">
      {(["drivers", "runs", "shipments"] as const).map(column => <div key={column} className={`min-h-0 min-w-0 overflow-hidden bg-background ${column === "runs" ? "border-x" : "hidden @min-[1100px]:block"}`}>
        <div aria-hidden="true" className="flex items-center justify-between gap-2 p-4"><Skeleton className="h-7 w-28 motion-reduce:animate-none" /><Skeleton className="size-9 motion-reduce:animate-none" /></div>
        <div className="px-4"><ScheduleColumnSkeleton column={column} /></div>
      </div>)}
    </div>
  </div>
}
