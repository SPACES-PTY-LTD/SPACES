"use client"

import { ImportCsvDialog } from "@/components/common/import-csv-dialog"
import { importVehiclesCsv } from "@/lib/api/vehicles"

export function ImportVehiclesDialog({
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
      title="Import fleet via CSV"
      description="Upload a CSV or TXT file to bulk create and update fleet vehicles."
      sampleHref="/samples/vehicles-import-sample.csv"
      sampleLabel="Download fleet sample CSV"
      actionLabel="Import fleet"
      successMessage="Fleet import completed."
      accessToken={accessToken}
      merchantId={merchantId}
      lockMerchant={lockMerchant}
      onImport={importVehiclesCsv}
    />
  )
}
