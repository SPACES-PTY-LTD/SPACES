import { Feather } from '@expo/vector-icons';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { BottomSheet } from '@/component/ui/BottomSheet';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { chatApi, type ChatReference } from '@/src/lib/api';

/** Match the location picker's native scrolling, rounded search and result cards. */
export function ChatReferenceSheet({ token, conversationId, type, onSelect, onDismiss }: {
  token: string; conversationId: string; type: ChatReference['type'];
  onSelect: (record: ChatReference) => void; onDismiss: () => void;
}) {
  const modal = useRef<BottomSheetModal>(null);
  const request = useRef(0);
  const busy = useRef(false);
  const chosen = useRef<ChatReference | null>(null);
  const nextPage = useRef<number | null>(null);
  const searched = useRef('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ChatReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  const [moreError, setMoreError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<ChatReference | null>(null);
  const dark = useColorScheme().colorScheme === 'dark';
  const ink = dark ? '#FAFAFA' : '#18181B';
  const muted = dark ? '#A1A1AA' : '#71717A';
  const border = dark ? '#3F3F46' : '#E4E4E7';
  const surface = dark ? '#24242B' : '#F5F5F8';
  const noun = type === 'run' ? 'run' : 'shipment';
  const icon = type === 'run' ? 'navigation' : 'package';

  useEffect(() => {
    const lifetime = request;
    const frame = requestAnimationFrame(() => modal.current?.present());
    return () => { cancelAnimationFrame(frame); lifetime.current++; };
  }, []);

  async function search(value: string) {
    const version = ++request.current;
    busy.current = false; nextPage.current = null; searched.current = value.trim();
    setRows([]); setError(''); setMoreError(''); setLoadingMore(false);
    setHasSearched(!!value.trim()); setLoading(!!value.trim());
    if (!value.trim()) return;
    try {
      const result = await chatApi.references(token, conversationId, type, value.trim());
      if (version !== request.current) return;
      setRows(result.data);
      nextPage.current = result.meta.current_page < result.meta.last_page ? result.meta.current_page + 1 : null;
    } catch (e) {
      if (version === request.current) setError(e instanceof Error ? e.message : `Unable to find ${noun}s.`);
    } finally { if (version === request.current) setLoading(false); }
  }
  async function more() {
    const page = nextPage.current;
    if (!page || busy.current || loading || selected) return;
    busy.current = true; setLoadingMore(true); setMoreError('');
    const version = request.current;
    try {
      const result = await chatApi.references(token, conversationId, type, searched.current, page);
      if (version !== request.current) return;
      setRows(previous => [...new Map([...previous, ...result.data].map(row => [row.id, row])).values()]);
      nextPage.current = result.meta.current_page < result.meta.last_page ? result.meta.current_page + 1 : null;
    } catch (e) {
      if (version === request.current) setMoreError(e instanceof Error ? e.message : 'Unable to load more.');
    } finally { if (version === request.current) { busy.current = false; setLoadingMore(false); } }
  }

  return <BottomSheet modalRef={modal} title={`Select ${noun}`} showHandle={false} plainScroll scrollable onDismiss={() => {
    request.current++;
    if (chosen.current) onSelect(chosen.current);
    onDismiss();
  }} onScroll={({ nativeEvent: e }) => {
    if (!moreError && e.contentOffset.y + e.layoutMeasurement.height >= e.contentSize.height - 120) void more();
  }}>
    {selected ? <>
      <Text style={[styles.heading, { color: muted }]}>SELECTED {noun.toUpperCase()}</Text>
      <View style={[styles.card, { borderColor: '#15803d', backgroundColor: dark ? '#142e20' : '#f0fdf4' }]}>
        <Feather name={icon} size={20} color="#15803d" />
        <View style={{ flex: 1, gap: 5 }}><Text style={[styles.name, { color: ink }]}>{selected.label}</Text><Text style={{ color: muted }}>{selected.subtitle}</Text></View>
        <Feather name="check-circle" size={20} color="#15803d" />
      </View>
      <Pressable accessibilityRole="button" onPress={() => { chosen.current = selected; modal.current?.dismiss(); }} style={styles.primary}><Text style={{ color: '#FFF', fontWeight: '700' }}>Attach {noun}</Text><Feather name="arrow-right" size={18} color="#FFF" /></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={styles.change}><Text style={{ color: ink }}>Choose another {noun}</Text></Pressable>
    </> : <>
      <View style={[styles.search, { backgroundColor: surface, borderColor: border }]}>
        <Feather name="search" size={19} color={muted} />
        <TextInput autoFocus accessibilityLabel={`Search ${noun}s by reference`} accessibilityHint="Press Search on the keyboard" placeholder={type === 'run' ? 'Run number or reference' : 'Shipment reference or delivery note'} placeholderTextColor={muted} value={query} onChangeText={setQuery} style={[styles.input, { color: ink }]} maxLength={255} returnKeyType="search" autoCorrect={false} onSubmitEditing={() => void search(query)} />
        {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => { setQuery(''); void search(''); }} style={styles.clear}><Feather name="x" size={18} color={muted} /></Pressable>}
      </View>
      {!!error && <><Text accessibilityRole="alert" style={{ color: dark ? '#fde68a' : '#92400e' }}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void search(query)} style={styles.change}><Text style={{ color: ink }}>Retry search</Text></Pressable></>}
      {loading ? <View style={styles.empty}><ActivityIndicator color="#15803d" /><Text style={{ color: muted }}>Finding {noun}s…</Text></View> : <>
        {!!rows.length && <Text style={[styles.heading, { color: muted }]}>SEARCH RESULTS</Text>}
        {rows.map(row => <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`${row.label}, ${row.subtitle}`} onPress={() => setSelected(row)} style={[styles.card, { borderColor: border }]}>
          <View style={[styles.icon, { backgroundColor: surface }]}><Feather name={icon} size={19} color={muted} /></View>
          <View style={{ flex: 1, gap: 5 }}><Text style={[styles.name, { color: ink }]}>{row.label}</Text><Text style={{ color: muted, fontSize: 12 }}>{row.subtitle}</Text></View><Feather name="chevron-right" size={18} color={muted} />
        </Pressable>)}
        {hasSearched && !error && !rows.length && <View style={[styles.empty, { backgroundColor: surface, borderRadius: 16 }]}><Feather name={icon} size={24} color={muted} /><Text style={[styles.name, { color: ink }]}>No {noun}s found</Text><Text style={{ color: muted, textAlign: 'center' }}>Try another reference. Only records assigned to you are available.</Text></View>}
        {!!rows.length && <View style={{ minHeight: 100, justifyContent: 'center' }}>
          {loadingMore && <ActivityIndicator accessibilityLabel="Loading more results" color="#15803d" />}
          {!!moreError && <Pressable accessibilityRole="button" onPress={() => void more()} style={styles.change}><Text style={{ color: ink }}>Unable to load more. Tap to retry.</Text></Pressable>}
        </View>}
      </>}
    </>}
  </BottomSheet>;
}
const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 999, paddingLeft: 14, minHeight: 52, gap: 10 },
  input: { flex: 1, fontSize: 15, minHeight: 52, paddingVertical: 12 },
  clear: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 10, minHeight: 70 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  primary: { backgroundColor: '#15803d', minHeight: 50, borderRadius: 14, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  change: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 24, alignItems: 'center', gap: 12 },
});
