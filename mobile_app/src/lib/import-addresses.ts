/** Keep row addresses independent; absence never implies a document address. */
export function shipmentAddressDraft(row: {
  pickup_address?: Record<string, string | null> | null;
  dropoff_address?: Record<string, string | null> | null;
}) {
  return {
    pickup_address: row.pickup_address ?? {},
    dropoff_address: row.dropoff_address ?? {},
  };
}

/** Inherited collections follow the reviewed starting point; explicit row addresses stay independent. */
export function collectionFromRunStart<T extends {
  pickup_address?: Record<string, string | null> | null;
  pickup_location_id?: string | null;
  pickup_from_run_start?: boolean;
}>(row: T, origin?: { location_id: string; [key: string]: unknown }): T {
  const address = row.pickup_address ?? {};
  const hasAddress = ['full_address', 'address_line_1', 'address_line_2', 'town', 'city', 'province', 'post_code', 'country']
    .some(key => typeof address[key] === 'string' && !!address[key]?.trim());
  if (!row.pickup_from_run_start && (row.pickup_location_id || hasAddress)) return row;
  if (!origin) return row.pickup_from_run_start ? { ...row, pickup_location_id: null, pickup_address: {} } : row;
  const fields = ['name', 'full_address', 'address_line_1', 'address_line_2', 'town', 'city', 'province', 'post_code', 'country', 'company', 'first_name', 'last_name', 'phone'];
  return { ...row, pickup_from_run_start: true, pickup_location_id: origin.location_id,
    pickup_address: Object.fromEntries(fields.map(key => [key, typeof origin[key] === 'string' ? origin[key] : null])) };
}
