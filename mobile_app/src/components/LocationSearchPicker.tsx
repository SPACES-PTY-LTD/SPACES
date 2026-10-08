import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View, type ScrollViewProps } from 'react-native';
import { Text } from '@/component/ui/Text';
import { ApiRequestError, documentImportApi, ImportLocation } from '@/src/lib/api';
import { Feather } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';

const address = (location: ImportLocation) => location.full_address ||
  [location.address_line_1, location.address_line_2, location.city, location.province, location.post_code, location.country].filter(Boolean).join(', ');
const routable = (location: ImportLocation) => location.latitude != null && location.longitude != null;

export type LocationSearchPickerHandle = { onScroll: NonNullable<ScrollViewProps['onScroll']> };

/** Shared search, pagination and selection preview; callers own endpoint persistence. */
export function LocationSearchPicker({ token, onConfirm, confirmLabel, selectedLabel = 'SELECTED LOCATION', selectionIcon = 'map-pin', onBusyChange, confirmOnSelect = false, ref }: {
  token: string;
  onConfirm: (location: ImportLocation) => Promise<void> | void;
  confirmLabel: string;
  selectedLabel?: string;
  selectionIcon?: 'map-pin' | 'flag';
  onBusyChange?: (busy: boolean) => void;
  /** Draft-only pickers can accept a result directly without a selection preview. */
  confirmOnSelect?: boolean;
  ref?: Ref<LocationSearchPickerHandle>;
}) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const ink = dark ? '#fafafa' : '#18181b';
  const muted = dark ? '#a1a1aa' : '#71717a';
  const border = dark ? '#3f3f46' : '#e4e4e7';
  const surface = dark ? '#27272a' : '#f7f7f8';
  const request = useRef(0);
  const submitting = useRef(false);
  const [locations, setLocations] = useState<ImportLocation[]>([]);
  const [selected, setSelected] = useState<ImportLocation>();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');
  const nextPage = useRef<number | null>(null);
  const moreRequest = useRef<number | null>(null);
  const searchedQuery = useRef('');
  const [hasSearched, setHasSearched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const errorMessage = (e: unknown) => (e as ApiRequestError).message || 'Unable to load locations. Please retry.';

  async function load(search = '') {
    const version = ++request.current;
    nextPage.current = null; moreRequest.current = null; searchedQuery.current = search.trim();
    setLoadingMore(false); setMoreError(''); setLocations([]); setError('');
    if (!search.trim()) { setLoading(false); setHasSearched(false); return; }
    setLoading(true); setHasSearched(true);
    try {
      const result = await documentImportApi.searchLocationPage(token, search.trim());
      if (version === request.current) { setLocations(result.data.filter(routable)); nextPage.current = result.meta.next_page; }
    } catch (e) { if (version === request.current) setError(errorMessage(e)); }
    finally { if (version === request.current) setLoading(false); }
  }
  async function loadMore() {
    const page = nextPage.current;
    const version = request.current;
    if (!page || loading || moreRequest.current === version || selected) return;
    moreRequest.current = version; setLoadingMore(true); setMoreError('');
    try {
      const result = await documentImportApi.searchLocationPage(token, searchedQuery.current, page);
      if (version !== request.current) return;
      setLocations(previous => [...new Map([...previous, ...result.data.filter(routable)].map(location => [location.location_id, location])).values()]);
      nextPage.current = result.meta.next_page;
    } catch (e) { if (version === request.current) setMoreError(errorMessage(e)); }
    finally { if (version === request.current) { moreRequest.current = null; setLoadingMore(false); } }
  }

  useEffect(() => {
    const lifetime = request;
    return () => { lifetime.current++; };
  }, [token]);
  useImperativeHandle(ref, () => ({
    onScroll: ({ nativeEvent }) => {
      if (nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 120 && !moreError) void loadMore();
    },
  }));

  async function save(location = selected) {
    if (!location || submitting.current) return;
    submitting.current = true; setSaving(true); onBusyChange?.(true); setError('');
    const version = request.current;
    try {
      await onConfirm(location);
    } catch (e) { if (version === request.current) setError((e as Error).message || 'Unable to save location. Please retry.'); }
    finally { submitting.current = false; if (version === request.current) { setSaving(false); onBusyChange?.(false); } }
  }
  const searchHeader = selected ? null : (
      <View style={{ gap: 8 }}>
        <View style={[styles.search, { backgroundColor: surface, borderColor: border }]}>
          <Feather name="search" size={19} color={muted} />
          <TextInput autoFocus accessibilityLabel="Location name or address" accessibilityHint="Press Search on the keyboard to find locations" placeholder="Location name or address" placeholderTextColor={muted} value={query} onChangeText={setQuery} style={[styles.input, { color: ink }]} returnKeyType="search" autoCorrect={false} onSubmitEditing={() => void load(query)} />
          {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear location search" onPress={() => { setQuery(''); void load(); }} style={styles.clear}><Feather name="x" size={18} color={muted} /></Pressable>}
        </View>
      </View>
  );
  const content = <>

    {!!error && <View style={[styles.error, { backgroundColor: dark ? '#401e22' : '#fff1f2' }]}><Feather name="alert-circle" size={18} color="#f54a4a" /><Text accessibilityRole="alert" style={{ color: dark ? '#fda4af' : '#9f1239', flex: 1 }}>{error}</Text></View>}
    {selected ? <>
      <Text style={[styles.eyebrow, { color: muted }]}>{selectedLabel}</Text>
      <View style={[styles.location, { backgroundColor: dark ? '#342226' : '#fff5f5', borderColor: '#f54a4a' }]}>
        <View style={[styles.icon, { backgroundColor: dark ? '#502c32' : '#ffe4e6' }]}><Feather name={selectionIcon} size={20} color="#f54a4a" /></View>
        <View style={styles.details}><Text style={[styles.name, { color: ink }]}>{selected.name}</Text><Text style={[styles.address, { color: muted }]}>{address(selected)}</Text></View>
        <Feather name="check-circle" size={20} color="#f54a4a" />
      </View>
      <Pressable accessibilityRole="button" disabled={saving} accessibilityState={{ disabled: saving }} onPress={() => void save()} style={[styles.primary, { opacity: saving ? 0.65 : 1 }]}>
        {saving && <ActivityIndicator color="#fff" />}<Text style={styles.primaryText}>{saving ? 'Saving…' : confirmLabel}</Text><Feather name="arrow-right" size={18} color="#fff" />
      </Pressable>
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => setSelected(undefined)} style={styles.change}><Text style={{ color: ink, fontWeight: '600' }}>Choose another location</Text></Pressable>
    </> : <>
      {!loading && locations.length > 0 && <View style={styles.listHeading}><Text style={[styles.eyebrow, { color: muted }]}>Search results</Text></View>}
      {loading ? <View style={styles.empty}><ActivityIndicator accessibilityLabel="Loading locations" color="#f54a4a" /><Text style={{ color: muted }}>Finding locations…</Text></View> : <>
        {!!error && <Pressable accessibilityRole="button" onPress={() => void load(query)} style={[styles.retry, { borderColor: border }]}><Feather name="refresh-cw" size={16} color={ink} /><Text style={{ color: ink, fontWeight: '600' }}>Retry loading locations</Text></Pressable>}
        {hasSearched && !error && !locations.length && <View style={[styles.empty, { backgroundColor: surface, borderRadius: 16 }]}><Feather name="map-pin" size={24} color={muted} /><Text style={[styles.name, { color: ink }]}>No locations found</Text><Text style={[styles.subtitle, { color: muted, textAlign: 'center' }]}>Try another location name or a full street address.</Text></View>}
        {locations.length > 0 && <View style={{ gap: 8 }}>{locations.map(location => <Pressable key={location.location_id} accessibilityRole="button" accessibilityLabel={`${location.name}, ${address(location)}`} disabled={saving} accessibilityState={{ disabled: saving }} onPress={() => { if (confirmOnSelect) void save(location); else { setSelected(location); setError(''); } }} style={[styles.location, { borderColor: border, backgroundColor: dark ? '#18181b' : '#fff' }]}>
          <View style={[styles.icon, { backgroundColor: surface }]}><Feather name="map-pin" size={19} color={muted} /></View>
          <View style={styles.details}><Text style={[styles.name, { color: ink }]}>{location.name}</Text><Text style={[styles.address, { color: muted }]}>{address(location)}</Text></View>
          <Feather name="chevron-right" size={18} color={muted} />
        </Pressable>)}</View>}
        {locations.length > 0 && <View style={styles.paginationFooter}>
        {loadingMore && <View style={styles.empty}><ActivityIndicator color="#f54a4a" /><Text accessibilityLiveRegion="polite" style={{ color: muted }}>Loading more…</Text></View>}
        {!!moreError && <Pressable accessibilityRole="button" onPress={() => void loadMore()} style={[styles.retry, { borderColor: border }]}><Text style={{ color: ink }}>Unable to load more. Tap to retry.</Text></Pressable>}
        </View>}
      </>}
    </>}
  </>;
  return <>{searchHeader}{content}</>;
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, lineHeight: 21 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 999, paddingLeft: 14, minHeight: 52, gap: 10 },
  input: { flex: 1, fontSize: 15, minHeight: 52, paddingVertical: 12 },
  clear: { minHeight: 44, width: 44, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#f54a4a', minHeight: 50, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 10, minHeight: 70 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, gap: 5 },
  name: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  address: { fontSize: 12, lineHeight: 18 },
  paginationFooter: { minHeight: 120, paddingBottom: 16, justifyContent: 'center' },
  empty: { padding: 24, alignItems: 'center', gap: 12 },
  change: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  error: { padding: 14, borderRadius: 12, flexDirection: 'row', gap: 10, alignItems: 'center' },
  retry: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'center', gap: 10 },
});
