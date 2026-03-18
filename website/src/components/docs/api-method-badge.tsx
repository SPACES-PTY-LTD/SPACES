import { cn } from "@/lib/utils"
import type { HttpMethod } from "@/lib/docs/api-reference"

const methodClassMap: Record<HttpMethod, string> = {
  GET: "border-emerald-200 bg-emerald-50 text-emerald-700",
  POST: "border-sky-200 bg-sky-50 text-sky-700",
  PATCH: "border-amber-200 bg-amber-50 text-amber-700",
  PUT: "border-indigo-200 bg-indigo-50 text-indigo-700",
  DELETE: "border-rose-200 bg-rose-50 text-rose-700",
}

export function ApiMethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em]",
        methodClassMap[method]
      )}
    >
      {method}
    </span>
  )
}
