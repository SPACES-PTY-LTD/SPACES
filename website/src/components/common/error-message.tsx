import { PageHeader } from "@/components/layout/page-header"

export function ErrorMessage({
  title,
  description,
  message,
}: {
  title: string
  description?: string
  message: string
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <div className="text-sm text-destructive">{message}</div>
    </div>
  )
}
