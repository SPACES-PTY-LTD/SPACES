import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiMethodBadge } from "@/components/docs/api-method-badge"
import { apiReferenceCategories } from "@/lib/docs/api-reference"

export default function ApiReferenceIndexPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-[32px] font-semibold tracking-tight text-zinc-900">API Reference</h1>
        <p className="text-sm text-zinc-600">
          Merchant endpoints grouped by feature area.
        </p>
      </div>

      <div className="space-y-6">
        {apiReferenceCategories.map((category) => (
          <section key={category.slug} className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900">{category.title}</h2>
            <p className="text-sm text-zinc-600">{category.description}</p>

            <div className="grid gap-3 lg:grid-cols-2">
              {category.endpoints.map((endpoint) => {
                const href = `/docs/api-reference/${category.slug}/${endpoint.slug}`

                return (
                  <Link key={endpoint.slug} href={href}>
                    <Card className="h-full border-zinc-200/80 bg-white transition hover:border-zinc-300 hover:bg-zinc-50/60">
                      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                        <CardTitle className="text-base tracking-tight text-zinc-900">{endpoint.title}</CardTitle>
                        <ApiMethodBadge method={endpoint.method} />
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <p className="text-xs text-zinc-500 [font-family:var(--font-docs-mono)]">{endpoint.path}</p>
                        <p className="text-zinc-600">{endpoint.summary}</p>
                        <p className="inline-flex items-center text-xs font-medium text-zinc-900">
                          View endpoint
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
