/** Use known address fields only; coordinate strings are never an address. */
export function reportedAddress(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of ['full_address', 'formatted_address', 'address']) {
    if (typeof record[key] === 'string' && record[key].trim()) return record[key].trim();
  }
  const parts = ['address_line_1', 'address_line_2', 'town', 'suburb', 'city', 'province', 'state', 'post_code', 'postal_code', 'country']
    .map(key => record[key]).filter((part): part is string => typeof part === 'string' && !!part.trim()).map(part => part.trim());
  return [...new Set(parts)].join(', ') || null;
}

export function truckPositionDescription(position: {
  address?: string | null;
  geofence_location?: { name: string; address: string | null } | null;
  updated_at: string | null;
} | null): string {
  const time = position?.updated_at ? Date.parse(position.updated_at) : NaN;
  return [position?.geofence_location?.name,
    position?.geofence_location ? position.geofence_location.address : position?.address,
    Number.isFinite(time) ? `Last reported ${new Date(time).toLocaleString()}` : 'Last reported position · update time unknown',
  ].filter(Boolean).join('\n');
}
