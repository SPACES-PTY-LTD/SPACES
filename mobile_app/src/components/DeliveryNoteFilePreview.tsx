import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { documentImportApi } from '@/src/lib/api';

/** Authenticated images and short-lived browser PDF previews. */
export function DeliveryNoteFilePreview({ importId, filename, token }: { importId: string; filename: string; token: string }) {
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
      await WebBrowser.openBrowserAsync(url, { showTitle: true });
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
      {loading && <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Loading document preview" color="#c2292e" /></View>}
    </View> : <View style={{ padding: 16, gap: 8, alignItems: 'center', borderRadius: 10, backgroundColor: dark ? '#18181b' : '#fff' }}>
      <Feather name="file-text" size={30} color={dark ? '#ff8585' : '#c2292e'} />
      <Text style={{ fontSize: 13, color: dark ? '#a1a1aa' : '#666', textAlign: 'center' }}>{image ? 'Preview unavailable' : pdf ? 'PDF document' : 'Document preview unavailable'}</Text>
      {pdf && <Pressable accessibilityRole="button" accessibilityLabel="Preview PDF" accessibilityState={{ disabled: opening }} disabled={opening} onPress={() => void openPdf()} style={{ minHeight: 44, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: '#c2292e', alignItems: 'center', justifyContent: 'center' }}>
        {opening ? <ActivityIndicator accessibilityLabel="Opening PDF preview" color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Preview PDF</Text>}
      </Pressable>}
      {!!previewError && <Text accessibilityRole="alert" style={{ fontSize: 13, color: dark ? '#ff8585' : '#a32222', textAlign: 'center' }}>{previewError}</Text>}
    </View>}
    <Text style={{ fontSize: 12, lineHeight: 18, color: dark ? '#a1a1aa' : '#666' }}>{filename}</Text>
  </View>;
}
