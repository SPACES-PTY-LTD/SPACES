import { notFound } from "next/navigation"
import { ApiMethodBadge } from "@/components/docs/api-method-badge"
import { CodeExampleTabs } from "@/components/docs/code-example-tabs"
import { ParamsTable } from "@/components/docs/params-table"
import { PrismCodeBlock } from "@/components/docs/prism-code-block"
import {
  apiReferenceCategories,
  buildCodeSamples,
  getApiEndpoint,
} from "@/lib/docs/api-reference"

function toPhpLiteral(value: unknown, indentLevel = 0): string {
  const indent = "  ".repeat(indentLevel)
  const nextIndent = "  ".repeat(indentLevel + 1)

  if (value === null) {
    return "null"
  }

  if (typeof value === "string") {
    return `'${value.replace(/'/g, "\\'")}'`
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value)
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]"
    }

    const items = value
      .map((item) => `${nextIndent}${toPhpLiteral(item, indentLevel + 1)}`)
      .join(",\n")

    return `[\n${items}\n${indent}]`
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      return "[]"
    }

    const items = entries
      .map(
        ([key, item]) =>
          `${nextIndent}'${key}' => ${toPhpLiteral(item, indentLevel + 1)}`
      )
      .join(",\n")

    return `[\n${items}\n${indent}]`
  }

  return "null"
}

export function generateStaticParams() {
  return apiReferenceCategories.flatMap((category) =>
    category.endpoints.map((endpoint) => ({
      category: category.slug,
      endpoint: endpoint.slug,
    }))
  )
}

export default async function ApiEndpointPage({
  params,
}: {
  params: Promise<{ category: string; endpoint: string }>
}) {
  const { category, endpoint } = await params
  const selectedEndpoint = getApiEndpoint(category, endpoint)

  if (!selectedEndpoint) {
    notFound()
  }

  const codeSamples = buildCodeSamples(selectedEndpoint)
  const phpResponseExample = `<?php\n\nreturn ${toPhpLiteral(selectedEndpoint.responseExample)};\n`

  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <ApiMethodBadge method={selectedEndpoint.method} />
          <p className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 [font-family:var(--font-docs-mono)]">
            {selectedEndpoint.path}
          </p>
          <p className="text-xs text-zinc-500">
            Auth: {selectedEndpoint.auth === "bearer" ? "Bearer token" : "None"}
          </p>
        </div>

        <div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-zinc-900">
            {selectedEndpoint.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            {selectedEndpoint.description}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_430px]">
        <div className="space-y-7">
          <ParamsTable title="Path parameters" fields={selectedEndpoint.pathParams ?? []} />
          <ParamsTable title="Query parameters" fields={selectedEndpoint.queryParams ?? []} />
          <ParamsTable title="Body parameters" fields={selectedEndpoint.bodyFields ?? []} />

          {selectedEndpoint.responseExample ? (
            <section className="space-y-3">
              <h3 className="text-base font-semibold tracking-tight text-zinc-900">Example response</h3>
              <PrismCodeBlock code={phpResponseExample} language="php" />
            </section>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-24 lg:h-fit">
          <div className="space-y-3 rounded-xl border border-zinc-200/80 bg-white p-4">
            <h3 className="text-base font-semibold tracking-tight text-zinc-900">Request examples</h3>
            <CodeExampleTabs examples={codeSamples} />
          </div>
        </div>
      </div>
    </div>
  )
}
