import { ScheduleBoard } from "@/components/schedule/schedule-board"
import { PageHeader } from "@/components/layout/page-header"
import { requireAuth } from "@/lib/auth"

export default async function SchedulePage({ searchParams }: { searchParams?: Promise<{ environment_id?: string }> }) {
  const session = await requireAuth()
  const params = await searchParams
  const merchant = session.selected_merchant
  if (!merchant?.merchant_id) return <PageHeader title="Schedule" description="Select a merchant to plan driver runs." />
  return <ScheduleBoard key={`${merchant.merchant_id}:${params?.environment_id ?? ""}`} merchantId={merchant.merchant_id}
    environmentId={params?.environment_id} token={session.accessToken} timezone={merchant.timezone || "UTC"} />
}
