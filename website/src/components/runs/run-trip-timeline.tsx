"use client"

import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { markerAppearance } from "./run-map-markers"
import { replayAt, type ReplayModel } from "./run-replay"
import styles from "./run-trip-timeline.module.css"

type Props = { model: ReplayModel | null; selected: number | null; onSelect: (time: number | null) => void; loading: boolean; error: string | null; onRetry: () => void; limited: boolean }
export function RunTripTimeline({ model, selected, onSelect, loading, error, onRetry, limited }: Props) {
  const value = model ? Math.min(model.end, Math.max(model.start, selected ?? model.end)) : 0
  const state = model ? replayAt(model, value) : null
  const span = model ? model.end - model.start : 0
  const percent = (time: number) => model && span ? Math.max(0, Math.min(100, (time - model.start) / span * 100)) : 0
  const multiDay = model && new Date(model.start).toDateString() !== new Date(model.end).toDateString()
  const clock = (time: number) => new Date(time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false, ...(multiDay ? { month: "short", day: "numeric" } : {}) })
  const fullTime = (time: number) => new Date(time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" })
  return <section className="border-t bg-background px-4 py-5 sm:px-6" aria-label="Trip timeline">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold sm:text-base">Trip timeline</h3>
      <output className="text-sm font-semibold tabular-nums" aria-live="off">{model ? fullTime(value) : "No recorded times"}</output>
      <Button variant="ghost" size="sm" onClick={() => onSelect(null)} disabled={selected === null} className="text-muted-foreground">Back to latest<ChevronRight className="size-4" /></Button>
    </div>
    {loading && <p className="mt-1 text-xs text-muted-foreground" role="status">Loading whole-trip history…</p>}
    {error && <div role="status" className="flex items-center gap-2 text-xs text-amber-700"><span>{error} Showing available history.</span><Button variant="ghost" size="sm" onClick={onRetry}>Retry history</Button></div>}
    {limited && !loading && <p className="mt-1 text-xs text-muted-foreground">Limited historical data — only recorded activity is available.</p>}
    {model && span > 0 ? <>
      <div className="relative mt-8 h-10 mx-3">
        <div aria-hidden="true" className="absolute inset-x-0 top-[17px] h-1 rounded bg-slate-300" />
        <div aria-hidden="true" className="absolute top-[17px] h-1 rounded bg-blue-500" style={{ width: `${percent(value)}%` }} />
        {model.gaps.map((gap, index) => <div key={`gap-${index}`} aria-hidden="true" className="absolute top-[17px] h-1 border-t-2 border-dashed border-slate-400 bg-background" style={{ left: `${percent(gap.start)}%`, width: `${percent(gap.end) - percent(gap.start)}%` }}>{percent(gap.end) - percent(gap.start) > 3 && <span className="absolute -top-5 left-1/2 hidden sm:block -translate-x-1/2 whitespace-nowrap text-[10px] italic text-muted-foreground">GPS gap</span>}</div>)}
        {model.events.map((event, index) => <div key={index} aria-hidden="true" className={`pointer-events-none absolute top-3 h-3 border border-background ${event.end > event.start ? "rounded-sm" : "w-3 -translate-x-1/2 rounded-full"}`} style={{ left: `${percent(event.start)}%`, width: event.end > event.start ? `max(3px, ${percent(event.end) - percent(event.start)}%)` : undefined, backgroundColor: markerAppearance(event.type).color, zIndex: event.priority }} />)}
        <input className={styles.slider} type="range" min={0} max={Math.ceil(span / 1000)} step={1} value={(value - model.start) / 1000} onChange={event => onSelect(Math.min(model.end, model.start + Number(event.target.value) * 1000))} aria-label="Replay trip time" aria-valuetext={`${fullTime(value)}. ${state?.title}. ${state?.detail}`} />
      </div>
      <div className="mx-3 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        {Array.from({ length: 7 }, (_, index) => <span key={index} className={index > 0 && index < 6 ? "hidden sm:block" : ""}>{clock(model.start + span * index / 6)}</span>)}
      </div>
    </> : <p className="py-5 text-sm text-muted-foreground">{loading ? "Preparing the timeline…" : model ? "Only one recorded time is available." : "No timestamped activity is available for replay."}</p>}
    <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: selected !== null && state?.event ? markerAppearance(state.event.type).color : "#64748b" }} />
      <strong className="font-semibold">{selected === null ? "Latest view" : state?.title}</strong>
      <span className="text-xs text-muted-foreground sm:border-l sm:pl-3">{selected === null ? "Drag the timeline to explore the trip" : state?.detail}{selected !== null && state?.event && state.event.end > state.event.start ? ` · ${clock(state.event.start)}–${clock(state.event.end)}` : ""}</span>
      {selected !== null && <span className="ml-auto text-xs text-muted-foreground">Drag through the trip</span>}
    </div>
  </section>
}
