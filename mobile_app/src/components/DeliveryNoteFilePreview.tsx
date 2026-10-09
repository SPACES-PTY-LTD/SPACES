import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { documentImportApi } from '@/src/lib/api';

/** Authenticated images and short-lived browser PDF previews. */
export function DeliveryNoteFilePreview({ importId, filename, token, openBrowser }: { importId: string; filename: string; token: string; openBrowser: (url: string) => Promise<void> }) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const active = useRef(true);
  const openingRef = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function openPdf() {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setPreviewError('');
    try {
      const { url } = await documentImportApi.pdfPreviewUrl(token, importId);
      if (!active.current) return;
      await openBrowser(url);
    } catch {
      if (active.current) setPreviewError('Could not open the PDF. Please try again.');
    } finally {
      openingRef.current = false;
      if (active.current) setOpening(false);
    }
  }
  const pdf = /\.pdf$/i.test(filename);
  const image = /\.(jpe?g|png|webp)$/i.test(filename);
  return <View style={{ gap: 8 }}>
    {image && !failed ? <View style={{ height: 180, borderRadius: 10, overflow: 'hidden', backgroundColor: dark ? '#18181b' : '#fff' }}>
      <Image source={{ uri: documentImportApi.filePreviewUrl(importId), headers: { Authorization: `Bearer ${token}` } }}
        accessibilityLabel="Preview of your unfinished delivery note" accessible contentFit="contain" cachePolicy="none"
        style={{ width: '100%', height: '100%' }} onLoad={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false); }} />
      {loading && <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Loading document preview" color="#15803d" /></View>}
    </View> : <View style={{ padding: 16, gap: 8, alignItems: 'center', borderRadius: 10, backgroundColor: dark ? '#18181b' : '#fff' }}>
      <Feather name="file-text" size={30} color={dark ? '#86efac' : '#15803d'} />
      <Text style={{ fontSize: 13, color: dark ? '#a1a1aa' : '#666', textAlign: 'center' }}>{image ? 'Preview unavailable' : pdf ? 'PDF document' : 'Document preview unavailable'}</Text>
      {pdf && <Pressable accessibilityRole="button" accessibilityLabel="Preview PDF" accessibilityState={{ disabled: opening }} disabled={opening} onPress={() => void openPdf()} hitSlop={6} style={{ minHeight: 32, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#d4d4d8', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        {opening ? <ActivityIndicator accessibilityLabel="Opening PDF preview" size="small" color="#52525b" /> : <Text style={{ fontSize: 13, fontWeight: '600', color: '#52525b' }}>Preview PDF</Text>}
      </Pressable>}
      {!!previewError && <Text accessibilityRole="alert" style={{ fontSize: 13, color: dark ? '#fde68a' : '#92400e', textAlign: 'center' }}>{previewError}</Text>}
    </View>}
    <Text style={{ fontSize: 12, lineHeight: 18, color: dark ? '#a1a1aa' : '#666' }}>{filename}</Text>
  </View>;
}
