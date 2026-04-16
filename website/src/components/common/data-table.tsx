"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import moment from "moment"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/common/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/common/status-badge"
import { UpdateDeliveryNoteDialog } from "@/components/shipments/update-delivery-note-dialog"
import { UpdateInvoiceNumberDialog } from "@/components/shipments/update-invoice-number-dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { format, parseISO } from "date-fns"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  Search,
} from "lucide-react"
import { Button } from "../ui/button"

export type Column<T> = {
  key: keyof T | string
  label: string
  className?: string
  type?: "text" | "status" | "date_time" | "count_array" | "image" | "tags" | "delivery_note_number" | "invoice_number"
  size?: "sm" | "md" | "lg"
  format?: string
  customValue?: (row: T) => React.ReactNode
  link?: keyof T | string
}

export type Filter<T> = {
  key: keyof T | string
  label: string
  value?: string
  url_param_name?: string
  type?: "select" | "date" | "text"
  placeholder?: string
  options?: { label: string; value: string }[]
}

export type RowAction<T> = {
  label: string
  href?: string
  hrefKey?: keyof T | string
  variant?: "default" | "destructive"
}

export type DataTableSelectionMode = "visible" | "all_filtered"

export type DataTableSelectionState<T> = {
  mode: DataTableSelectionMode
  selectedIds: string[]
  selectedRows: T[]
  selectedCount: number
  totalCount: number
  currentPageCount: number
  queryParams: URLSearchParams
  clearSelection: () => void
}

export type DataTableBulkAction<T> = {
  label: string
  variant?: "default" | "destructive"
  disabled?: (selection: DataTableSelectionState<T>) => boolean
  onSelect: (selection: DataTableSelectionState<T>) => void
}

export type DataTableSelection<T> = {
  idKey: keyof T | string
  label?: string
  bulkActions?: DataTableBulkAction<T>[]
  renderBulkActions?: (selection: DataTableSelectionState<T>) => React.ReactNode
}

export type DataTableView = {
  label: string
  href?: string
  link?: string
  match?: "exact" | "subset"
  ignoreParams?: string[]
}

function DeliveryNoteNumberCell<T extends Record<string, unknown>>({
  row,
  displayValue,
  deliveryNoteNumber,
}: {
  row: T
  displayValue: React.ReactNode
  deliveryNoteNumber: string
}) {
  const [open, setOpen] = React.useState(false)
  const rawShipmentId = getValue(row, "shipment_id")
  const shipmentId =
    typeof rawShipmentId === "string" && rawShipmentId.trim().length > 0
      ? rawShipmentId.trim()
      : ""

  if (!shipmentId) {
    return displayValue
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-left text-primary underline-offset-4 hover:underline"
      >
        <span>{displayValue}</span>
        <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="sr-only">Edit delivery note number</span>
      </button>
      <UpdateDeliveryNoteDialog
        open={open}
        onOpenChange={setOpen}
        shipmentId={shipmentId}
        deliveryNoteNumber={deliveryNoteNumber}
      />
    </>
  )
}

function InvoiceNumberCell<T extends Record<string, unknown>>({
  row,
  displayValue,
  invoiceNumber,
  deliveryNoteNumber,
}: {
  row: T
  displayValue: React.ReactNode
  invoiceNumber: string
  deliveryNoteNumber: string
}) {
  const [open, setOpen] = React.useState(false)
  const rawShipmentId = getValue(row, "shipment_id")
  const shipmentId =
    typeof rawShipmentId === "string" && rawShipmentId.trim().length > 0
      ? rawShipmentId.trim()
      : ""

  if (!shipmentId) {
    return displayValue
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-left text-primary underline-offset-4 hover:underline"
      >
        <span>{displayValue}</span>
        <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="sr-only">Edit invoice number</span>
      </button>
      <UpdateInvoiceNumberDialog
        open={open}
        onOpenChange={setOpen}
        shipmentId={shipmentId}
        invoiceNumber={invoiceNumber}
        deliveryNoteNumber={deliveryNoteNumber}
      />
    </>
  )
}

function getValue<T extends Record<string, unknown>>(
  row: T,
  key: keyof T | string
) {
  const path = String(key)
  if (!path.includes(".")) {
    return row[key as keyof T]
  }

  return path
    .split(".")
    .reduce<unknown>((value, segment) => {
      if (value && typeof value === "object" && segment in value) {
        return (value as Record<string, unknown>)[segment]
      }
      return undefined
    }, row)
}

function parseFilterDate(value?: string) {
  if (!value) return undefined
  const parsed = parseISO(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchKeys,
  filters,
  views,
  rowActions,
  selection,
  emptyMessage = "No matching records found.",
  loading_error,
  meta,
  enableSorting = false,
  sortableColumns,
  width = null,
  sortKeyMap,
  sortByParam = "sort_by",
  sortDirParam = "sort_dir",
}: {
  data: T[]
  columns: Column<T>[]
  searchKeys?: Array<keyof T | string>
  filters?: Filter<T>[]
  views?: DataTableView[]
  rowActions?: RowAction<T>[]
  selection?: DataTableSelection<T>
  pageSize?: number
  emptyMessage?: string
  loading_error?: string | null,
  meta?: {
    current_page: number,
    last_page: number,
    per_page: number,
    total: number,
  },
  enableSorting?: boolean
  sortableColumns?: Array<keyof T | string>
  width?: string | null
  sortKeyMap?: Record<string, string>
  sortByParam?: string
  sortDirParam?: string
}) {
  const [query, setQuery] = React.useState("");
  const [show_filters, setShowFilters] = React.useState(false)
  const [filterValues, setFilterValues] = React.useState<Record<string, string>>(
    {}
  )
  const [selectedIdSet, setSelectedIdSet] = React.useState<Set<string>>(
    () => new Set()
  )
  const [selectionMode, setSelectionMode] =
    React.useState<DataTableSelectionMode>("visible")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamSignature = searchParams.toString()
  const visibleFilters = React.useMemo(
    () =>
      (filters ?? []).filter(
        (filter) => filter.url_param_name !== "per_page"
      ),
    [filters]
  )
  const columnsByKey = React.useMemo(() => {
    const map = new Map<string, Column<T>>()
    columns.forEach((column) => {
      map.set(String(column.key), column)
    })
    return map
  }, [columns])

  const getCellValue = React.useCallback(
    (row: T, key: keyof T | string) => {
      const column = columnsByKey.get(String(key))
      if (column?.customValue) {
        return column.customValue(row)
      }
      return getValue(row, key)
    },
    [columnsByKey]
  )

  const getRowSelectionId = React.useCallback(
    (row: T) => {
      if (!selection) return ""
      const value = getValue(row, selection.idKey)
      return value === null || value === undefined ? "" : String(value)
    },
    [selection]
  )

  const clearSelection = React.useCallback(() => {
    setSelectedIdSet(new Set())
    setSelectionMode("visible")
  }, [])

  const getDisplayValue = React.useCallback(
    (row: T, column: Column<T>) => {
      const value = getCellValue(row, column.key)
      const type = column.type ?? "text"
      if (type === "date_time") {
        if (!value) return "-"
        return moment(String(value)).format(column.format ?? "YYYY-MM-DD HH:mm")
      }
      if (type === "count_array") {
        return Array.isArray(value) ? value.length : 0
      }
      return value
    },
    [getCellValue]
  )

  const renderValue = React.useCallback((value: unknown): React.ReactNode => {
    if (value === null || value === undefined) return "-"
    if (React.isValidElement(value)) return value
    if (["string", "number", "boolean"].includes(typeof value)) return value as React.ReactNode
    return String(value)
  }, [])

  const renderTagsValue = React.useCallback((row: T, column: Column<T>): React.ReactNode => {
    const rawValue = getCellValue(row, column.key)
    if (!Array.isArray(rawValue) || rawValue.length === 0) return "-"

    return (
      <div className="flex flex-wrap gap-1">
        {rawValue.map((tag, index) => {
          if (!tag || typeof tag !== "object") {
            return null
          }

          const tagRecord = tag as { tag_id?: unknown; name?: unknown; slug?: unknown }
          const name = typeof tagRecord.name === "string" ? tagRecord.name : ""
          if (!name) return null

          const key =
            typeof tagRecord.tag_id === "string"
              ? tagRecord.tag_id
              : typeof tagRecord.slug === "string"
                ? tagRecord.slug
                : `${name}-${index}`

          return (
            <Badge key={key} variant="secondary">
              {name}
            </Badge>
          )
        })}
      </div>
    )
  }, [getCellValue])

  const renderImageValue = React.useCallback(
    (row: T, column: Column<T>): React.ReactNode => {
      const rawValue = getCellValue(row, column.key)
      const imageUrl = typeof rawValue === "string" ? rawValue.trim() : ""
      const hrefValue = column.link ? getValue(row, column.link) : undefined
      const href =
        typeof hrefValue === "string" && hrefValue.trim().length > 0
          ? hrefValue.trim()
          : undefined
      const sizeClasses =
        column.size === "lg"
          ? "h-14 w-14"
          : column.size === "md"
            ? "h-10 w-10"
            : "h-8 w-8"
      const content = imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={column.label}
          className={cn("rounded-md object-cover border border-border", sizeClasses)}
          loading="lazy"
        />
      ) : (
        <div
          className={cn(
            "rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground inline-flex items-center justify-center",
            sizeClasses
          )}
          aria-label={`No ${column.label} available`}
        >
          <ImageIcon className="h-4 w-4" />
        </div>
      )

      if (!href) return content
      return (
        <Link href={href} className="inline-flex">
          {content}
        </Link>
      )
    },
    [getCellValue]
  )

  const getFilterValue = React.useCallback(
    (filter: Filter<T>) => {
      if (filter.url_param_name) {
        return searchParams.get(filter.url_param_name) ?? filter.value ?? ""
      }

      return filterValues[String(filter.key)] ?? filter.value ?? ""
    },
    [filterValues, searchParams]
  )

  React.useEffect(() => {
    const hasActiveUrlFilter = visibleFilters.some((filter) => {
      if (!filter.url_param_name) {
        return false
      }

      const value = searchParams.get(filter.url_param_name)
      return value !== null && value.trim() !== ""
    })

    if (hasActiveUrlFilter) {
      setShowFilters(true)
    }
  }, [searchParams, visibleFilters])

  const filtered = React.useMemo(() => {
    let result = [...data]
    if (query && searchKeys?.length) {
      const lowered = query.toLowerCase()
      result = result.filter((row) =>
        searchKeys.some((key) =>
          String(
            getDisplayValue(row, columnsByKey.get(String(key)) ?? { key, label: "" })
          )
            .toLowerCase()
            .includes(lowered)
        )
      )
    }

    if (visibleFilters.length) {
      visibleFilters.forEach((filter) => {
        if (filter.url_param_name) {
          return
        }

        const value = getFilterValue(filter)
        if (value) {
          result = result.filter(
            (row) =>
              String(
                getDisplayValue(
                  row,
                  columnsByKey.get(String(filter.key)) ?? {
                    key: filter.key,
                    label: "",
                  }
                )
              ) === value
          )
        }
      })
    }

    return result
  }, [data, query, searchKeys, visibleFilters, getFilterValue, getDisplayValue, columnsByKey])

  const rows = filtered
  const parsedLastPage = Number(meta?.last_page)
  const parsedCurrentPage = Number(meta?.current_page)
  const parsedPerPage = Number(meta?.per_page)
  const parsedTotal = Number(meta?.total)
  const lastPage =
    Number.isFinite(parsedLastPage) && parsedLastPage > 0
      ? Math.floor(parsedLastPage)
      : 1
  const unclampedCurrentPage =
    Number.isFinite(parsedCurrentPage) && parsedCurrentPage > 0
      ? Math.floor(parsedCurrentPage)
      : 1
  const currentPage = Math.min(Math.max(unclampedCurrentPage, 1), lastPage)
  const hasMeta = Boolean(meta)
  const currentPageSize =
    Number.isFinite(parsedPerPage) && parsedPerPage > 0
      ? Math.floor(parsedPerPage)
      : Math.max(rows.length, 1)
  const totalRows =
    Number.isFinite(parsedTotal) && parsedTotal >= 0
      ? Math.floor(parsedTotal)
      : rows.length
  const rangeStart =
    hasMeta && totalRows > 0 && rows.length > 0
      ? Math.min(totalRows, (currentPage - 1) * currentPageSize + 1)
      : 0
  const rangeEnd =
    hasMeta && totalRows > 0 && rows.length > 0
      ? Math.min(totalRows, rangeStart + rows.length - 1)
      : 0
  const resultCountLabel = hasMeta
    ? `Showing ${rangeStart}-${rangeEnd} of ${totalRows} results`
    : `Showing ${rows.length} ${rows.length === 1 ? "result" : "results"}`
  const rowSelectionIds = React.useMemo(
    () =>
      selection
        ? rows.map((row) => getRowSelectionId(row)).filter((id) => id.length > 0)
        : [],
    [getRowSelectionId, rows, selection]
  )
  const rowSelectionIdSignature = rowSelectionIds.join("\u001f")
  const allVisibleSelected =
    rowSelectionIds.length > 0 &&
    rowSelectionIds.every((rowId) => selectedIdSet.has(rowId))
  const someVisibleSelected =
    rowSelectionIds.length > 0 &&
    rowSelectionIds.some((rowId) => selectedIdSet.has(rowId))
  const selectedRows = React.useMemo(
    () =>
      selection
        ? rows.filter((row) => selectedIdSet.has(getRowSelectionId(row)))
        : [],
    [getRowSelectionId, rows, selectedIdSet, selection]
  )
  const selectedIds = React.useMemo(
    () => Array.from(selectedIdSet),
    [selectedIdSet]
  )
  const selectedCount =
    selectionMode === "all_filtered" ? totalRows : selectedIds.length
  const canSelectAllFiltered =
    Boolean(selection && hasMeta && allVisibleSelected && totalRows > rows.length)
  const selectionState = React.useMemo<DataTableSelectionState<T>>(
    () => ({
      mode: selectionMode,
      selectedIds,
      selectedRows,
      selectedCount,
      totalCount: totalRows,
      currentPageCount: rows.length,
      queryParams: new URLSearchParams(searchParamSignature),
      clearSelection,
    }),
    [
      clearSelection,
      rows.length,
      searchParamSignature,
      selectedCount,
      selectedIds,
      selectedRows,
      selectionMode,
      totalRows,
    ]
  )
  const pageSizeOptions = React.useMemo(() => {
    return Array.from(new Set([10, 20, 50, 100, currentPageSize])).sort(
      (a, b) => a - b
    )
  }, [currentPageSize])
  const currentSortBy = searchParams.get(sortByParam) ?? ""
  const rawSortDir = (searchParams.get(sortDirParam) ?? "").toLowerCase()
  const currentSortDir: "asc" | "desc" | "" =
    rawSortDir === "asc" || rawSortDir === "desc" ? rawSortDir : ""
  const sortableColumnSet = React.useMemo(() => {
    if (!sortableColumns?.length) return null
    return new Set(sortableColumns.map((column) => String(column)))
  }, [sortableColumns])
  const tableColumnCount =
    columns.length + (rowActions?.length ? 1 : 0) + (selection ? 1 : 0)

  React.useEffect(() => {
    clearSelection()
  }, [clearSelection, query, rowSelectionIdSignature, searchParamSignature])

  React.useEffect(() => {
    if (!selection) return

    setSelectedIdSet((previous) => {
      const visibleIdSet = new Set(rowSelectionIds)
      const next = new Set(
        Array.from(previous).filter((rowId) => visibleIdSet.has(rowId))
      )

      if (next.size === previous.size) {
        return previous
      }

      if (next.size === 0) {
        setSelectionMode("visible")
      }

      return next
    })
  }, [rowSelectionIds, selection])

  const buildPageHref = React.useCallback(
    (targetPage: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (targetPage <= 1) {
        params.delete("page")
      } else {
        params.set("page", String(targetPage))
      }
      const queryString = params.toString()
      return queryString ? `${pathname}?${queryString}` : pathname
    },
    [pathname, searchParams]
  )

  const buildPerPageHref = React.useCallback(
    (pageSize: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("per_page", String(pageSize))
      params.delete("page")
      const queryString = params.toString()
      return queryString ? `${pathname}?${queryString}` : pathname
    },
    [pathname, searchParams]
  )

  const buildSortHref = React.useCallback(
    (column: Column<T>) => {
      const params = new URLSearchParams(searchParams.toString())
      const columnKey = String(column.key)
      const sortKey = sortKeyMap?.[columnKey] ?? columnKey
      const isActive = currentSortBy === sortKey
      const nextDir = isActive && currentSortDir === "asc" ? "desc" : "asc"
      params.set(sortByParam, sortKey)
      params.set(sortDirParam, nextDir)
      params.delete("page")
      const queryString = params.toString()
      return queryString ? `${pathname}?${queryString}` : pathname
    },
    [
      pathname,
      searchParams,
      sortKeyMap,
      currentSortBy,
      currentSortDir,
      sortByParam,
      sortDirParam,
    ]
  )

  const updateFilterParam = React.useCallback(
    (filter: Filter<T>, value: string) => {
      if (!filter.url_param_name) {
        setFilterValues((prev) => ({
          ...prev,
          [String(filter.key)]: value,
        }))
        return
      }

      const params = new URLSearchParams(searchParams.toString())
      if (!value) {
        params.delete(filter.url_param_name)
      } else {
        params.set(filter.url_param_name, value)
      }
      params.delete("page")

      const queryString = params.toString()
      router.push(queryString ? `${pathname}?${queryString}` : pathname)
    },
    [pathname, router, searchParams]
  )

  const isViewActive = React.useCallback(
    (view: DataTableView) => {
      const rawHref = view.href ?? view.link
      if (!rawHref) return false

      const targetUrl = new URL(rawHref, "http://localhost")
      if (targetUrl.pathname !== pathname) {
        return false
      }

      const ignoredParams = new Set([
        "page",
        sortByParam,
        sortDirParam,
        ...(view.ignoreParams ?? []),
      ])

      const currentParams = new URLSearchParams(searchParams.toString())
      ignoredParams.forEach((param) => {
        currentParams.delete(param)
      })

      const targetParams = new URLSearchParams(targetUrl.search)
      ignoredParams.forEach((param) => {
        targetParams.delete(param)
      })

      const matchMode =
        view.match ??
        (Array.from(targetParams.keys()).length > 0 ? "subset" : "exact")

      const targetEntries = Array.from(targetParams.entries())
      const matchesTarget = targetEntries.every(
        ([key, value]) => currentParams.get(key) === value
      )

      if (!matchesTarget) {
        return false
      }

      if (matchMode === "subset") {
        return true
      }

      const currentEntries = Array.from(currentParams.entries())
      return (
        currentEntries.length === targetEntries.length &&
        currentEntries.every(([key, value]) => targetParams.get(key) === value)
      )
    },
    [pathname, searchParams, sortByParam, sortDirParam]
  )

  const renderPaginationButton = React.useCallback(
    ({
      href,
      disabled,
      label,
      className,
      children,
    }: {
      href: string
      disabled: boolean
      label: string
      className?: string
      children: React.ReactNode
    }) => {
      const content = (
        <>
          <span className="sr-only">{label}</span>
          {children}
        </>
      )

      if (disabled) {
        return (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={className}
            disabled
          >
            {content}
          </Button>
        )
      }

      return (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={className}
          asChild
        >
          <Link href={href}>{content}</Link>
        </Button>
      )
    },
    []
  )

  const toggleVisibleRows = React.useCallback(
    (checked: boolean) => {
      setSelectedIdSet((previous) => {
        const next = new Set(previous)
        rowSelectionIds.forEach((rowId) => {
          if (checked) {
            next.add(rowId)
          } else {
            next.delete(rowId)
          }
        })
        return next
      })
      setSelectionMode("visible")
    },
    [rowSelectionIds]
  )

  const toggleRowSelection = React.useCallback((rowId: string, checked: boolean) => {
    setSelectedIdSet((previous) => {
      const next = new Set(previous)
      if (checked) {
        next.add(rowId)
      } else {
        next.delete(rowId)
      }
      return next
    })
    setSelectionMode("visible")
  }, [])

  return (
    <>
      
      <div className="rounded-lg border">

        <div className="border-b px-3 py-2 flex items-center justify-between">

          <div className="flex flex-wrap gap-2 flex-row flex-1">
            {views && views.length > 0 && (
              <>
                {views.map((view) => {
                  const href = view.href ?? view.link ?? "#"
                  const active = isViewActive(view)

                  return (
                    <Link
                      key={`${view.label}-${href}`}
                      href={href}
                      className={cn(
                        "inline-flex min-h-7 items-center rounded-md px-3 text-sm transition-colors",
                        active
                          ? "bg-border font-medium text-foreground "
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      {view.label}
                    </Link>
                  )
                })}
              </>
            )}


            {show_filters && searchKeys?.length ? (
              <Input
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="max-w-sm"
              />
            ) : null}
          </div>

          <Button
            onClick={() => setShowFilters(!show_filters)}
            variant="outline" size={"sm"}
          >
            <Search className="h-4 w-4" />
            <Filter className="h-4 w-4" />
          </Button>

        </div>

        {show_filters && (
          <div className="border-b px-3 py-2">
            <div className="flex flex-wrap gap-2 items-center space-x-2">
              {visibleFilters.map((filter) => {
                if (filter.type === "date") {
                  return (
                    <DatePicker
                      key={String(filter.key)}
                      value={parseFilterDate(getFilterValue(filter))}
                      onChange={(date) =>
                        updateFilterParam(filter, date ? format(date, "yyyy-MM-dd") : "")
                      }
                      className="h-8 w-[220px] justify-start text-sm"
                      placeholder={filter.placeholder ?? filter.label}
                    />
                  )
                }

                if (filter.type === "text") {
                  return (
                    <Input
                      key={String(filter.key)}
                      value={getFilterValue(filter)}
                      onChange={(event) => updateFilterParam(filter, event.target.value)}
                      className="h-9 w-[220px] text-sm"
                      placeholder={filter.placeholder ?? filter.label}
                    />
                  )
                }

                return (
                  <Select
                    key={String(filter.key)}
                    value={getFilterValue(filter)}
                    onValueChange={(value) =>
                      updateFilterParam(filter, value === "all" ? "" : value)
                    }
                  >
                    <SelectTrigger className="h-auto! text-sm border-dashed border-border p-1! px-3!">
                      <SelectValue
                        placeholder={filter.placeholder ?? filter.label}
                      >
                        {(() => {
                          const value = getFilterValue(filter)
                          if (!value) return filter.placeholder ?? filter.label
                          const option = filter.options?.find(
                            (opt) => opt.value === value
                          )
                          if (value) {
                            return filter.label + ": " + (option ? option.label : value)
                          }
                          return option ? option.label : value
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {(filter.options ?? []).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              })}
            </div>
          </div>
        )}

        {selection && selectedCount > 0 ? (
          <div className="flex flex-col gap-2 border-b bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground text-sm">
                {selectedCount} selected
              </span>
              {canSelectAllFiltered ? (
                <Select
                  value={selectionMode}
                  onValueChange={(value) =>
                    setSelectionMode(value as DataTableSelectionMode)
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className="h-8 w-[180px]"
                    aria-label="Selection scope"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visible">Visible rows</SelectItem>
                    <SelectItem value="all_filtered">
                      All filtered results
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selection.bulkActions?.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant={action.variant ?? "outline"}
                  size="sm"
                  disabled={action.disabled?.(selectionState) ?? false}
                  onClick={() => action.onSelect(selectionState)}
                >
                  {action.label}
                </Button>
              ))}
              {selection.renderBulkActions?.(selectionState)}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearSelection}
              >
                Clear selection
              </Button>
            </div>
          </div>
        ) : null}
        
        <div className="overflow-x">

            <Table className={cn(width ? `table-fixed` : "table-auto")} style={width ? { minWidth:width } : undefined}>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  {selection ? (
                    <TableHead className="w-4">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(node) => {
                          if (node) {
                            node.indeterminate =
                              !allVisibleSelected && someVisibleSelected
                          }
                        }}
                        onChange={(event) =>
                          toggleVisibleRows(event.target.checked)
                        }
                        aria-label={`Select all ${selection.label ?? "rows"} on this page`}
                      />
                    </TableHead>
                  ) : null}
                  {columns.map((column) => (
                    <TableHead
                      key={String(column.key)}
                      className={cn(
                        "sticky top-0",
                        column.className
                      )}
                    >
                      {enableSorting &&
                        (!sortableColumnSet || sortableColumnSet.has(String(column.key))) ? (
                        (() => {
                          const columnKey = String(column.key)
                          const sortKey = sortKeyMap?.[columnKey] ?? columnKey
                          const isActive = currentSortBy === sortKey
                          return (
                            <Link
                              href={buildSortHref(column)}
                              className="inline-flex items-center gap-1 text-foreground hover:text-primary"
                            >
                              <span>{column.label}</span>
                              {isActive ? (
                                currentSortDir === "desc" ? (
                                  <ArrowDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowUp className="h-3.5 w-3.5" />
                                )
                              ) : (
                                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </Link>
                          )
                        })()
                      ) : (
                        column.label
                      )}
                    </TableHead>
                  ))}
                  {rowActions?.length ? (
                    <TableHead className="sticky top-0 right-0 z-20 bg-background" />
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading_error ? (
                  <TableRow>
                    <TableCell colSpan={tableColumnCount} className="py-10">
                      <div className="text-center text-sm text-destructive">
                        {loading_error}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tableColumnCount} className="py-10">
                      <div className="text-center text-sm text-muted-foreground">
                        {emptyMessage}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, rowIndex) => {
                    const rowSelectionId = getRowSelectionId(row)
                    const isSelected = rowSelectionId
                      ? selectedIdSet.has(rowSelectionId)
                      : false
                    return (
                      <TableRow
                        key={rowSelectionId || rowIndex}
                        data-state={isSelected ? "selected" : undefined}
                      >
                        {selection ? (
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!rowSelectionId}
                              onChange={(event) =>
                                toggleRowSelection(
                                  rowSelectionId,
                                  event.target.checked
                                )
                              }
                              aria-label={`Select ${selection.label ?? "row"}`}
                            />
                          </TableCell>
                        ) : null}
                        {columns.map((column) => (
                          <TableCell
                            key={String(column.key)}
                          >
                          {column.type === "status" ? (
                            <StatusBadge
                              status={String(getCellValue(row, column.key) ?? "")}
                            />
                          ) : column.type === "image" ? (
                            renderImageValue(row, column)
                          ) : column.type === "tags" ? (
                            renderTagsValue(row, column)
                          ) : column.type === "delivery_note_number" ? (
                            <DeliveryNoteNumberCell
                              row={row}
                              displayValue={renderValue(getDisplayValue(row, column))}
                              deliveryNoteNumber={String(getCellValue(row, column.key) ?? "")}
                            />
                          ) : column.type === "invoice_number" ? (
                            <InvoiceNumberCell
                              row={row}
                              displayValue={renderValue(getDisplayValue(row, column))}
                              invoiceNumber={String(getCellValue(row, column.key) ?? "")}
                              deliveryNoteNumber={String(getValue(row, "delivery_note_number") ?? "")}
                            />
                          ) : (
                            (() => {
                              const value = getDisplayValue(row, column)
                              if (!column.link) return renderValue(value)
                              const href = getValue(row, column.link)
                              if (typeof href === "string" && href.length > 0) {
                                return (
                                  <Link href={href} className="text-primary underline-offset-4 hover:underline">
                                    {renderValue(value)}
                                  </Link>
                                )
                              }
                              return renderValue(value)
                            })()
                          )}
                        </TableCell>
                      ))}
                      {rowActions?.length ? (
                        <TableCell
                          className={cn(
                            "sticky right-0 text-right",
                            isSelected ? "bg-muted" : "bg-background"
                          )}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background shadow-xs">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {rowActions.map((action) => {
                                const href =
                                  action.href ??
                                  (action.hrefKey
                                    ? String(getValue(row, action.hrefKey) ?? "")
                                    : "")
                                return (
                                  <DropdownMenuItem
                                    key={action.label}
                                    className={cn(
                                      action.variant === "destructive" &&
                                      "text-destructive"
                                    )}
                                    asChild={Boolean(href)}
                                  >
                                    {href ? (
                                      <Link href={href}>{action.label}</Link>
                                    ) : (
                                      action.label
                                    )}
                                  </DropdownMenuItem>
                                )
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      ) : null}
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>

        </div>
        <div className="space-y-3 border-t px-3 py-3 text-sm text-muted-foreground">
          
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>{resultCountLabel}</div>
            {hasMeta ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Rows per page</span>
                  <Select
                    value={String(currentPageSize)}
                    onValueChange={(value) => {
                      router.push(buildPerPageHref(Number(value)))
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      className="h-8 w-20"
                      aria-label="Rows per page"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {pageSizeOptions.map((pageSize) => (
                        <SelectItem key={pageSize} value={String(pageSize)}>
                          {pageSize}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="whitespace-nowrap font-medium text-foreground">
                  Page {currentPage} of {lastPage}
                </div>
                <div className="flex items-center gap-2">
                  {renderPaginationButton({
                    href: buildPageHref(1),
                    disabled: currentPage <= 1,
                    label: "Go to first page",
                    className: "hidden lg:inline-flex",
                    children: <ChevronsLeft className="h-4 w-4" />,
                  })}
                  {renderPaginationButton({
                    href: buildPageHref(currentPage - 1),
                    disabled: currentPage <= 1,
                    label: "Go to previous page",
                    children: <ChevronLeft className="h-4 w-4" />,
                  })}
                  {renderPaginationButton({
                    href: buildPageHref(currentPage + 1),
                    disabled: currentPage >= lastPage,
                    label: "Go to next page",
                    children: <ChevronRight className="h-4 w-4" />,
                  })}
                  {renderPaginationButton({
                    href: buildPageHref(lastPage),
                    disabled: currentPage >= lastPage,
                    label: "Go to last page",
                    className: "hidden lg:inline-flex",
                    children: <ChevronsRight className="h-4 w-4" />,
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
