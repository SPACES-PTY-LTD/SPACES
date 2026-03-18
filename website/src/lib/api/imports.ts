export type ImportCsvResult = {
  processed: number
  created: number
  updated: number
  failed: number
  errors?: Array<{
    line: number
    errors: string[]
  }>
}
