import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { BottomSheet } from '@/component/ui/BottomSheet';
import { Text } from '@/component/ui/Text';
import { ApiRequestError, documentImportApi, ImportLocation } from '@/src/lib/api';
import { ImportButton, ImportField, importStyles as s } from '../document-import-ui';

const address = (location: ImportLocation) => location.full_address ||
  [location.address_line_1, location.address_line_2, location.city, location.province, location.post_code, location.country].filter(Boolean).join(', ');
const routable = (location: ImportLocation) => location.latitude != null && location.longitude != null;

export function FinalDestinationSheet({ token, runId, onDismiss, onSaved }: {
  token: string; runId: string; onDismiss: () => void; onSaved: () => void;
}) {
  const modal = useRef<BottomSheetModal>(null);
  const request = useRef(0);
  const submitting = useRef(false);
  const [locations, setLocations] = useState<ImportLocation[]>([]);
  const [selected, setSelected] = useState<ImportLocation>();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const errorMessage = (e: unknown) => (e as ApiRequestError).message || 'Unable to load locations. Please retry.';

  async function load(search = '') {
    const version = ++request.current;
    setLoading(true); setError('');
    try {
      const values = search.trim()
        ? await documentImportApi.searchLocations(token, search.trim())
        : (await documentImportApi.context(token)).locations;
      if (version === request.current) setLocations(values.filter(routable));
    } catch (e) { if (version === request.current) setError(errorMessage(e)); }
    finally { if (version === request.current) setLoading(false); }
  }
  useEffect(() => {
    const lifetime = request;
    const frame = requestAnimationFrame(() => modal.current?.present());
    void load();
    return () => { lifetime.current++; cancelAnimationFrame(frame); };
  }, [token, runId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!selected || submitting.current) return;
    submitting.current = true; setSaving(true); setError('');
    try {
      await documentImportApi.chooseFinalDestination(token, runId, selected.location_id);
      modal.current?.dismiss();
      onSaved();
    } catch (e) { setError(errorMessage(e)); }
    finally { submitting.current = false; setSaving(false); }
  }
  return <BottomSheet modalRef={modal} title="Choose final destination" scrollable dismissible={!saving} onDismiss={onDismiss}>
    <Text style={s.subtitle}>Where will this run end? Choose the planned final destination, even if it differs from the last delivery.</Text>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {selected ? <>
      <View style={s.card}><Text style={s.heading}>{selected.name}</Text><Text style={s.body}>{address(selected)}</Text></View>
      <ImportButton label={saving ? 'Saving…' : 'Save final destination'} disabled={saving} onPress={() => void save()} />
      <ImportButton secondary label="Choose another location" disabled={saving} onPress={() => setSelected(undefined)} />
    </> : <>
      <ImportField label="Location or address" value={query} onChange={setQuery} />
      <ImportButton secondary label="Search locations" disabled={loading || query.trim().length < 3} onPress={() => void load(query)} />
      {loading ? <ActivityIndicator accessibilityLabel="Loading locations" color="#f54a4a" /> : <>
        {!!error && <ImportButton secondary label="Retry" onPress={() => void load(query.trim().length >= 3 ? query : '')} />}
        {!error && !locations.length && <Text style={s.note}>No locations found. Try a full street address.</Text>}
        {locations.slice(0, 30).map(location => <ImportButton key={location.location_id} secondary label={`${location.name}\n${address(location)}`} onPress={() => { setSelected(location); setError(''); }} />)}
        {locations.length > 30 && <Text style={s.note}>Search to find more locations.</Text>}
      </>}
    </>}
  </BottomSheet>;
}
