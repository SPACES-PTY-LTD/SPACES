import type { CostTotal } from "@/lib/types"

export const costCurrencies = {
  ZAR: 2, USD: 2, EUR: 2, GBP: 2, BWP: 2, NAD: 2, SZL: 2, LSL: 2,
  MZN: 2, ZMW: 2, KES: 2, TZS: 2, UGX: 0, NGN: 2, GHS: 2, AED: 2,
  AUD: 2, CAD: 2, CHF: 2, CNY: 2, INR: 2, JPY: 0, KWD: 3,
} as const

export function costTotalsLabel(totals?: CostTotal[]) {
  return totals?.length ? totals.map(({ currency, amount }) => `${currency} ${amount}`).join(" · ") : "No costs"
}
