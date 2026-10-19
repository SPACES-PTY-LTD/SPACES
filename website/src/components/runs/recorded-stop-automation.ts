const actionLabels: Record<string, string> = {
  record_vehicle_entry: "Record vehicle entry",
  record_vehicle_exit: "Record vehicle exit",
  start_run: "End run & start new run",
  create_shipment: "Create shipment",
}
const fieldLabels: Record<string, string> = {
  has_active_run: "Has active run",
  run_status: "Run status",
  shipment_exists_for_location: "Shipment exists for location",
  shipment_status: "Shipment status",
  location_matches_run_origin: "Location matches run origin",
  location_matches_run_destination: "Location matches run destination",
}
export type RecordedAutomation = {
  action: string
  trigger: string
  conditions: string[]
  conditionsUnavailable: boolean
  executedAt: string | null
}
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}
function readable(value: string) {
  return value.replaceAll("_", " ")
}
export function parseRecordedAutomation(metadata: unknown): RecordedAutomation[] {
  const entries = record(metadata)?.automation
  if (!Array.isArray(entries)) return []
  // Stored append order is the execution order; timestamps can be absent or equal.
  return entries.flatMap((entry): RecordedAutomation[] => {
    const item = record(entry)
    if (!item || typeof item.action !== "string" || !Object.hasOwn(actionLabels, item.action)) return []
    const rawConditions = Array.isArray(item.conditions) ? item.conditions : []
    const conditions = rawConditions.flatMap((raw): string[] => {
      const condition = record(raw)
      if (!condition || typeof condition.field !== "string" || !Object.hasOwn(fieldLabels, condition.field) ||
        (condition.operator !== "equals" && condition.operator !== "not_equals") ||
        !["string", "number", "boolean"].includes(typeof condition.value)) return []
      const value = String(condition.value)
      return [`${fieldLabels[condition.field]} ${condition.operator === "equals" ? "is" : "is not"} ${value === "true" ? "Yes" : value === "false" ? "No" : readable(value)}`]
    })
    const executedAt = typeof item.executed_at === "string" && Number.isFinite(Date.parse(item.executed_at)) ? item.executed_at : null
    return [{
      action: actionLabels[item.action],
      trigger: item.event === "entry" ? "On entry" : item.event === "exit" ? "On exit" : "Trigger not recorded",
      conditions,
      conditionsUnavailable: conditions.length !== rawConditions.length ||
        (typeof item.condition_count === "number" && item.condition_count > conditions.length) ||
        (conditions.length === 0 && (item.has_conditions === true || !Array.isArray(item.conditions) && item.has_conditions !== false && item.condition_count !== 0)),
      executedAt,
    }]
  })
}
export function automationTimestamp(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Time not recorded"
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}
