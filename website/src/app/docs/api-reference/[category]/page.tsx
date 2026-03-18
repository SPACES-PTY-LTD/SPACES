import { notFound, redirect } from "next/navigation"
import { getApiCategory } from "@/lib/docs/api-reference"

export default async function ApiCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  const selectedCategory = getApiCategory(category)

  if (!selectedCategory) {
    notFound()
  }

  const firstEndpoint = selectedCategory.endpoints[0]

  if (!firstEndpoint) {
    redirect("/docs/api-reference")
  }

  redirect(`/docs/api-reference/${selectedCategory.slug}/${firstEndpoint.slug}`)
}
