import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="text-lg font-semibold">{title}</div>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        {actionLabel ? (
          <Button onClick={onAction}>{actionLabel}</Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
