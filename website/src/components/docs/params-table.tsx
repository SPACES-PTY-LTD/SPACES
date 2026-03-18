import type { EndpointField } from "@/lib/docs/api-reference"

type ParamsTableProps = {
  title: string
  fields: EndpointField[]
}

export function ParamsTable({ title, fields }: ParamsTableProps) {
  if (!fields.length) {
    return null
  }

  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold tracking-tight text-zinc-900">{title}</h3>
      <div className="max-w-full w-full overflow-x-auto rounded-xl border border-zinc-200/80 bg-white ">
        <table className="min-w-[560px] w-max text-left text-sm sm:w-full">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 text-xs font-medium">Name</th>
              <th className="px-4 py-2.5 text-xs font-medium">Type</th>
              <th className="px-4 py-2.5 text-xs font-medium">Required</th>
              <th className="px-4 py-2.5 text-xs font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={`${title}-${field.name}`} className="border-t border-zinc-200/80">
                <td className="px-4 py-2.5 text-xs [font-family:var(--font-docs-mono)]">{field.name}</td>
                <td className="px-4 py-2.5 text-xs text-zinc-700">{field.type}</td>
                <td className="px-4 py-2.5 text-xs text-zinc-700">{field.required ? "Yes" : "No"}</td>
                <td className="px-4 py-2.5 text-sm text-zinc-600">
                  {field.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
