import { PageHeader } from "@/components/layout/page-header"
import { isApiErrorResponse } from "@/lib/api/client"
import { getVehiclesDailyKpiReport } from "@/lib/api/reports"
import { requireAuth } from "@/lib/auth"
import { VehiclesDailyKpiReport } from "./vehicles-daily-kpi-report"

type PageProps = {
  searchParams?: Promise<{ year?: string; month?: string; only_with_data?: string }>
}

function currentYearMonth(timezone?: string | null) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
  })
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]))
  return { year: Number(parts.year), month: Number(parts.month) }
}

export default async function VehiclesDailyKpiPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {}
  const session = await requireAuth()
  const current = currentYearMonth(session.selected_merchant?.timezone)
  const requestedYear = Number(params.year)
  const requestedMonth = Number(params.month)
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 ? requestedYear : current.year
  const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : current.month
  const onlyWithData = params.only_with_data === "1" || params.only_with_data === "true"

  const response = await getVehiclesDailyKpiReport({
    merchant_id: session.selected_merchant?.merchant_id,
    year,
    month,
    only_with_data: onlyWithData ? true : undefined,
  }, session.accessToken)

  const failed = isApiErrorResponse(response)
  const rows = failed ? [] : response.data ?? []
  const meta = failed ? undefined : response.meta

  return (
    <div className="space-y-6">
      <PageHeader title="Vehicles Daily KPI" description="Daily operational KPI counts for every vehicle in the selected month." />
      {failed ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {response.message || "Unable to load the vehicles daily KPI report."}
        </div>
      ) : (
        <VehiclesDailyKpiReport
          rows={rows}
          year={meta?.year ?? year}
          month={meta?.month ?? month}
          onlyWithData={onlyWithData}
          monthLabel={meta?.month_label ?? `${year}-${String(month).padStart(2, "0")}`}
          daysInMonth={meta?.days_in_month ?? new Date(year, month, 0).getDate()}
          currentLocalDate={meta?.current_local_date ?? `${current.year}-${String(current.month).padStart(2, "0")}-01`}
          availableYears={meta?.available_years?.length ? meta.available_years : [current.year]}
          accessToken={session.accessToken}
          merchantId={session.selected_merchant?.merchant_id}
        />
      )}
    </div>
  )
}
