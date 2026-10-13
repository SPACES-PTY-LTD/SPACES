import { ScheduleBoard } from "@/components/schedule/schedule-board"
import { PageHeader } from "@/components/layout/page-header"
import { requireAuth } from "@/lib/auth"

export default async function SchedulePage() {
  const session = await requireAuth()
  const merchant = session.selected_merchant
  if (!merchant?.merchant_id) return <PageHeader title="Schedule" description="Select a merchant to plan driver runs." />
  return <ScheduleBoard key={merchant.merchant_id} merchantId={merchant.merchant_id}
    token={session.accessToken} timezone={merchant.timezone || "UTC"} />
}
