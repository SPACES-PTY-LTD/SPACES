import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageHeader } from '@/component/ui/PageHeader';
import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DocumentIcon, DocumentStatus, formatDocumentDate, formatDocumentSize } from '@/src/components/documents/DocumentUI';
import { ApiRequestError, DriverEntityFile, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

export default function DocumentDetailsScreen() {
  const { file_id } = useLocalSearchParams<{ file_id: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const token = session?.token;
  const activeToken = useRef(token);
  useEffect(() => { activeToken.current = token; }, [token]);
  const [result, setResult] = useState<{ token: string; id: string; file?: DriverEntityFile; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const file = result && result.token === token && result.id === file_id ? result.file : undefined;
  const error = result && result.token === token && result.id === file_id ? result.error : undefined;

  useFocusEffect(useCallback(() => {
    let active = true;
    void attempt;
    if (token) {
      driverApi.listFiles(token).then(response => {
        if (!active) return;
        const found = response.data.find(item => item.file_id === file_id);
        setResult({ token, id: file_id, file: found, error: found ? undefined : 'This document is unavailable or you no longer have access.' });
      }).catch((cause: ApiRequestError) => {
        if (active) setResult({ token, id: file_id, error: cause.message || 'Unable to load this document.' });
      });
    }
    return () => { active = false; };
  }, [token, file_id, attempt]));

  const goBack = () => router.canGoBack() ? router.back() : router.replace('/documents');
  const download = async () => {
    if (!token || !file || downloading) return;
    setDownloading(true); setDownloadError(null);
    try {
      const response = await driverApi.getFileDownloadUrl(token, file.file_id);
      if (activeToken.current === token) await WebBrowser.openBrowserAsync(response.url);
    } catch (cause) {
      if (activeToken.current === token) setDownloadError((cause as ApiRequestError).message || 'Unable to download this document. Try again.');
    } finally { setDownloading(false); }
  };

  return (
    <View className="flex-1 bg-white dark:bg-[#111111]" style={{ paddingTop: insets.top }}>
      <PageHeader title="Document details" leading={
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Documents" onPress={goBack}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <DocumentIcon kind="back" />
        </Pressable>
      } />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 32 }}>
        {!token ? <Text>Please sign in to view this document.</Text> : error ? (
          <View className="bg-[#F5F5F8] dark:bg-card rounded-[20px] p-5">
            <Text accessibilityRole="alert">{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => { setResult(null); setAttempt(value => value + 1); }} style={{ paddingVertical: 16 }}><Text className="text-primary font-semibold">Retry</Text></Pressable>
          </View>
        ) : !file ? <ActivityIndicator color="#F54A4A" accessibilityLabel="Loading document" /> : (
          <>
            <View className="bg-[#F5F5F8] dark:bg-card" style={{ borderRadius: 20, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View className="bg-white dark:bg-muted" style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}><DocumentIcon kind="file" /></View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ fontSize: 17, fontWeight: '600' }}>{file.file_type?.name || 'Driver document'}</Text>
                  <Text className="text-muted-foreground" style={{ fontSize: 13 }}>{file.original_name || 'Unnamed file'}</Text>
                </View>
                <DocumentStatus file={file} />
              </View>
              <View className="bg-border" style={{ height: 1, marginVertical: 22 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text className="text-muted-foreground" style={{ fontSize: 13 }}>{file.is_expired ? 'Expired on' : 'Expiry'}</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: file.is_expired ? colorScheme === 'dark' ? '#FDA4AF' : '#A32136' : colorScheme === 'dark' ? '#FAFAFA' : '#111111' }}>{file.expires_at ? formatDocumentDate(file.expires_at) : 'No expiry'}</Text>
              </View>
              <Text className="text-muted-foreground" style={{ fontSize: 13, lineHeight: 20, marginTop: 20 }}>{file.mime_type === 'application/pdf' ? 'PDF' : file.mime_type || 'Unknown type'} · {formatDocumentSize(file.size_bytes)}{'\n'}Uploaded {formatDocumentDate(file.created_at)}</Text>
              <Text className="text-muted-foreground" style={{ fontSize: 13, marginTop: 10 }}>by {file.uploaded_by_user?.name || file.uploaded_by_role || 'Unknown'}</Text>
              {downloadError && <Text accessibilityRole="alert" className="text-destructive" style={{ marginTop: 16 }}>{downloadError}</Text>}
              <Pressable accessibilityRole="button" disabled={downloading} onPress={download} className="bg-secondary"
                style={{ minHeight: 48, borderRadius: 24, marginTop: 36, alignItems: 'center', justifyContent: 'center', opacity: downloading ? 0.6 : 1 }}>
                {downloading ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-secondary-foreground" style={{ fontSize: 16, fontWeight: '600' }}>Download</Text>}
              </Pressable>
            </View>
            {file.is_expired && <Text className="text-muted-foreground" style={{ fontSize: 15, lineHeight: 21, marginTop: 26 }}>This document has expired. Upload a current replacement from Documents.</Text>}
          </>
        )}
      </ScrollView>
    </View>
  );
}
