import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { documentImportApi } from '@/src/lib/api';

/** Private original images only; unsupported documents keep a readable fallback. */
export function DeliveryNoteFilePreview({ importId, filename, token }: { importId: string; filename: string; token: string }) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const image = /\.(jpe?g|png|webp)$/i.test(filename);
  return <View style={{ gap: 8 }}>
    {image && !failed ? <View style={{ height: 180, borderRadius: 10, overflow: 'hidden', backgroundColor: dark ? '#18181b' : '#fff' }}>
      <Image source={{ uri: documentImportApi.filePreviewUrl(importId), headers: { Authorization: `Bearer ${token}` } }}
        accessibilityLabel="Preview of your unfinished delivery note" accessible contentFit="contain" cachePolicy="none"
        style={{ width: '100%', height: '100%' }} onLoad={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false); }} />
      {loading && <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Loading document preview" color="#c2292e" /></View>}
    </View> : <View style={{ padding: 16, gap: 8, alignItems: 'center', borderRadius: 10, backgroundColor: dark ? '#18181b' : '#fff' }}>
      <Feather name="file-text" size={30} color={dark ? '#ff8585' : '#c2292e'} />
      <Text style={{ fontSize: 13, color: dark ? '#a1a1aa' : '#666', textAlign: 'center' }}>{image ? 'Preview unavailable' : 'Document preview unavailable'}</Text>
    </View>}
    <Text style={{ fontSize: 12, lineHeight: 18, color: dark ? '#a1a1aa' : '#666' }}>{filename}</Text>
  </View>;
}
