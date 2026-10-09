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
