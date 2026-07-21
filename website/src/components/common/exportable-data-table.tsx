"use client"

import * as React from "react"
import { DataTable } from "@/components/common/data-table"
import { CsvExportAction } from "@/components/common/csv-export-action"
import type { LogisticsExportResource } from "@/lib/csv-export"

type Row = Record<string, unknown>
type TableProps = Omit<React.ComponentProps<typeof DataTable<Row>>, "selection">

export function ExportableDataTable({
  resource, idKey, label, accessToken, merchantId, ...tableProps
}: TableProps & {
  resource: LogisticsExportResource
  idKey: string
  label: string
  accessToken?: string
  merchantId?: string | null
}) {
  return (
    <DataTable
      {...tableProps}
      selection={{
        idKey,
        label,
        renderBulkActions: (selection) => (
          <CsvExportAction
            resource={resource}
            selection={selection}
            accessToken={accessToken}
            merchantId={merchantId}
          />
        ),
      }}
    />
  )
}
