export function validateTripRange(from: number, to: number, lower: number, upper: number): string | null {
  if (![from, to, lower, upper].every(Number.isFinite)) return "Choose both dates and times."
  if (from < lower || to > upper) return "Choose dates and times within this trip."
  if (from >= to) return "To must be later than From."
  return null
}
