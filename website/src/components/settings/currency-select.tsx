"use client"

import { costCurrencies } from "@/lib/costs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function CurrencySelect({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <div className="space-y-1.5">
    <span className="text-sm font-medium">Currency</span>
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full" aria-label="Currency"><SelectValue>{value}</SelectValue></SelectTrigger>
      <SelectContent>{Object.keys(costCurrencies).map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent>
    </Select>
    <p className="text-xs text-muted-foreground">Default for new additional costs. Existing costs keep their recorded currency.</p>
  </div>
}
