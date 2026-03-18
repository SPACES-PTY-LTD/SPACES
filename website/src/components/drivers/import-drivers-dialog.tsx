"use client"

import { ImportCsvDialog } from "@/components/common/import-csv-dialog"
import { importDriversCsv } from "@/lib/api/drivers"

export function ImportDriversDialog({
  accessToken,
  merchantId,
  lockMerchant = false,
}: {
  accessToken?: string
  merchantId?: string | null
  lockMerchant?: boolean
}) {
  return (
    <ImportCsvDialog
      title="Import drivers via CSV"
      description="Upload a CSV or TXT file to bulk create and update drivers."
      sampleHref="/samples/drivers-import-sample.csv"
      sampleLabel="Download sample CSV"
      actionLabel="Import drivers"
      successMessage="Driver import completed."
      accessToken={accessToken}
      merchantId={merchantId}
      lockMerchant={lockMerchant}
      onImport={importDriversCsv}
    />
  )
}
