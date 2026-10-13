"use client"

import { useEffect, useState } from "react"
import { runActiveDuration } from "@/components/runs/run-active-duration"

export function RunActiveDurationCard({ status, startedAt, completedAt, initialNow }: {
  status?: string | null; startedAt?: string | null; completedAt?: string | null; initialNow: string;
}) {
  const [now, setNow] = useState(() => Date.parse(initialNow))
  useEffect(() => {
    if (status !== "in_progress" || !startedAt || !Number.isFinite(Date.parse(startedAt))) return
    const update = () => setNow(Date.now())
    const timer = window.setInterval(update, 1000)
    window.addEventListener("focus", update)
    document.addEventListener("visibilitychange", update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", update)
      document.removeEventListener("visibilitychange", update)
    }
  }, [status, startedAt])

  return <div className="rounded-lg border bg-muted/20 p-4">
    <div className="text-xs text-muted-foreground">Run active for</div>
    <div className="mt-1 text-xl font-semibold tabular-nums">{runActiveDuration(status, startedAt, completedAt, now)}</div>
  </div>
}
