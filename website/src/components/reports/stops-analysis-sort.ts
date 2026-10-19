/** Sort raw measurements rather than rounded display labels; missing values stay last. */
export function sortStopAnalysisRows<T extends object>(rows: T[], key: string, direction: "asc" | "desc"): T[] {
  const value = (row: T): string | number | null => {
    const raw = row[key as keyof T]
    if (raw === null || raw === undefined) return null
    if (key === "enteredAt" || key === "exitedAt") {
      const timestamp = Date.parse(String(raw))
      return Number.isFinite(timestamp) ? timestamp : null
    }
    return typeof raw === "number" ? raw : String(raw)
  }
  return [...rows].sort((a, b) => {
    const left = value(a)
    const right = value(b)
    if (left === null) return right === null ? 0 : 1
    if (right === null) return -1
    const comparison = typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" })
    return direction === "asc" ? comparison : -comparison
  })
}
