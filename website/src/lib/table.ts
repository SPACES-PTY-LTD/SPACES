export type TableMeta = {
  current_page: number
  per_page: number
  total: number
  last_page: number
}

function toPositiveInt(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN

  if (!Number.isFinite(parsed) || parsed < 1) return undefined
  return Math.floor(parsed)
}

export function normalizeTableMeta(meta?: unknown): TableMeta | undefined {
  if (!meta || typeof meta !== "object") return undefined

  const metaRecord = meta as Record<string, unknown>
  const pagination =
    metaRecord.pagination && typeof metaRecord.pagination === "object"
      ? (metaRecord.pagination as Record<string, unknown>)
      : metaRecord

  const currentPage = toPositiveInt(pagination.current_page ?? pagination.page)
  const perPage = toPositiveInt(pagination.per_page ?? pagination.perPage)
  const total = toPositiveInt(pagination.total)
  const lastPageFromMeta = toPositiveInt(pagination.last_page)
  const derivedLastPage =
    perPage && total ? Math.max(1, Math.ceil(total / perPage)) : undefined
  const lastPage = lastPageFromMeta ?? derivedLastPage

  if (!currentPage || !perPage || !total || !lastPage) {
    return undefined
  }

  return {
    current_page: Math.min(currentPage, lastPage),
    per_page: perPage,
    total,
    last_page: lastPage,
  }
}
