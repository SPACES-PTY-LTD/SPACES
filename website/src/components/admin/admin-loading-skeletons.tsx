import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function AdminPageHeaderSkeleton({
  withActions = true,
}: {
  withActions?: boolean
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {withActions ? (
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-10" />
        </div>
      ) : null}
    </div>
  )
}

export function AdminTableLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <AdminPageHeaderSkeleton />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <Skeleton className="h-10 flex-1 sm:max-w-sm" />
            <Skeleton className="h-10 w-full sm:w-40" />
            <Skeleton className="h-10 w-full sm:w-40" />
          </div>
          <Skeleton className="h-10 w-full sm:w-28" />
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-4 gap-4 md:grid-cols-6">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="hidden h-4 w-24 md:block" />
            <Skeleton className="hidden h-4 w-12 md:block" />
          </div>

          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-4 gap-4 rounded-lg border p-4 md:grid-cols-6"
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="hidden h-4 w-28 md:block" />
                <Skeleton className="hidden h-8 w-8 justify-self-end rounded-md md:block" />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-4 w-40" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function AdminDetailLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <AdminPageHeaderSkeleton />

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-full max-w-56" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-3 h-16 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-44" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-28 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
