export type DeliveryOrderRow = { shipment_id: string; reference: string; destination?: string | null; address?: string | null }

export function moveDelivery<T>(rows: T[], from: number, to: number): T[] {
  if (from < 0 || from >= rows.length || to < 0 || to >= rows.length || from === to) return rows
  const next = [...rows]
  const [row] = next.splice(from, 1)
  next.splice(to, 0, row)
  return next
}
