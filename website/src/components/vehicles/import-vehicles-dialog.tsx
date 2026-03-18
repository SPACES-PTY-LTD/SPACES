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
      title="Import vehicles via CSV"
      description="Upload a CSV or TXT file to bulk create and update vehicles."
      sampleHref="/samples/vehicles-import-sample.csv"
      sampleLabel="Download sample CSV"
      actionLabel="Import vehicles"
      successMessage="Vehicle import completed."
      accessToken={accessToken}
      merchantId={merchantId}
      lockMerchant={lockMerchant}
      onImport={importVehiclesCsv}
    />
  )
}
