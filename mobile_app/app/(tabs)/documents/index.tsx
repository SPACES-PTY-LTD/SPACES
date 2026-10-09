import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/component/ui/Text';
import { PageHeader } from '@/component/ui/PageHeader';
import { DateInput } from '@/component/ui/DateInput';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiRequestError, DriverEntityFile, DriverFileType, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';
import { DocumentIcon, DocumentStatus } from '@/src/components/documents/DocumentUI';
import { useRequiredDocuments } from '@/src/providers/required-documents-provider';

export default function DocumentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { count: requiredDocumentCount, expiredCount, refresh: refreshRequiredDocuments } = useRequiredDocuments();
  const { colorScheme } = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const [files, setFiles] = useState<DriverEntityFile[]>([]);
  const [fileTypes, setFileTypes] = useState<DriverFileType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFileTypeId, setSelectedFileTypeId] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const selectedFileType = useMemo(
    () => fileTypes.find((item) => item.file_type_id === selectedFileTypeId) ?? null,
    [fileTypes, selectedFileTypeId],
  );

  const loadDocuments = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!session?.token) {
        setFiles([]);
        setFileTypes([]);
        setIsLoading(false);
        return;
      }

      if (mode === 'refresh') {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const [typesResponse, filesResponse] = await Promise.all([
          driverApi.listFileTypes(session.token),
          driverApi.listFiles(session.token),
        ]);

        setFileTypes(typesResponse.data);
        setFiles(filesResponse.data);
        setErrorMessage(null);
        void refreshRequiredDocuments();
      } catch (error) {
        const requestError = error as ApiRequestError;
        setErrorMessage(requestError.message || 'Unable to load driver files.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [session, refreshRequiredDocuments],
  );

  useFocusEffect(
    useCallback(() => {
      loadDocuments();
    }, [loadDocuments]),
  );

  const resetUploadForm = () => {
    setSelectedFileTypeId('');
    setSelectedDocument(null);
    setExpiresAt('');
    setFormError(null);
  };

  const openPicker = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return;
    }

    setSelectedDocument(result.assets[0] ?? null);
  };

  const handleUpload = async () => {
    if (!session?.token) {
      return;
    }

    if (!selectedFileTypeId) {
      setFormError('Select a file type.');
      return;
    }

    if (!selectedDocument) {
      setFormError('Choose a file to upload.');
      return;
    }

    if (selectedFileType?.requires_expiry && !expiresAt.trim()) {
      setFormError('Expiry date is required for this file type.');
      return;
    }

    setIsUploading(true);
    setFormError(null);

    try {
      await driverApi.uploadFile(session.token, {
        file_type_id: selectedFileTypeId,
        file: {
          uri: selectedDocument.uri,
          name: selectedDocument.name,
          type: selectedDocument.mimeType,
        },
        expires_at: expiresAt.trim() || undefined,
      });

      resetUploadForm();
      setModalVisible(false);
      await loadDocuments();
    } catch (error) {
      const requestError = error as ApiRequestError;
      setFormError(requestError.message || 'Unable to upload file.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-[#111111]" style={{ paddingTop: insets.top }}>
      <PageHeader title="Documents" action={
        <Pressable accessibilityRole="button" onPress={() => { resetUploadForm(); setModalVisible(true); }}
          style={{ backgroundColor: '#15803d', borderRadius: 24, minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>Upload document</Text>
        </Pressable>
      } />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadDocuments('refresh')} />}
        showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {requiredDocumentCount != null && requiredDocumentCount > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`${requiredDocumentCount} required uploads. Upload document`}
              onPress={() => { resetUploadForm(); setModalVisible(true); }}
              style={{ flex: 1, minHeight: 126, padding: 16, borderRadius: 20, backgroundColor: isDarkMode ? '#382B13' : '#FFF4D6' }}>
              <DocumentIcon kind="required" />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ fontSize: 30, lineHeight: 42, fontWeight: '700', color: isDarkMode ? '#FDE68A' : '#744700' }}>{requiredDocumentCount}</Text>
                <DocumentIcon kind="requiredChevron" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: isDarkMode ? '#FDE68A' : '#744700' }}>Required uploads</Text>
            </Pressable>
          ) : null}
          {expiredCount != null && expiredCount > 0 ? (
            <View style={{ flex: 1, minHeight: 126, padding: 16, borderRadius: 20, backgroundColor: isDarkMode ? '#451a03' : '#FEF3C7' }}>
              <DocumentIcon kind="expired" />
              <Text style={{ fontSize: 30, lineHeight: 42, marginTop: 8, fontWeight: '700', color: isDarkMode ? '#fde68a' : '#92400e' }}>{expiredCount}</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: isDarkMode ? '#fde68a' : '#92400e' }}>Expired {expiredCount === 1 ? 'document' : 'documents'}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 16 }}>
          <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '700' }}>Your documents</Text>
          {!isLoading && <Text className="text-muted-foreground" style={{ fontSize: 14 }}>{files.length} {files.length === 1 ? 'file' : 'files'}</Text>}
        </View>

        {errorMessage ? (
          <View className="border-warning bg-warning mt-6 rounded-xl border px-5 py-5">
            <Text className="text-warning-foreground text-base font-semibold">{errorMessage}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View className="bg-[#F5F5F8] dark:bg-card mt-6 items-center rounded-xl px-5 py-12">
            <ActivityIndicator color="#15803d" />
          </View>
        ) : files.length === 0 ? (
          <View className="bg-[#F5F5F8] dark:bg-card rounded-[20px] px-5 py-10 items-center">
            <View className="bg-white dark:bg-muted rounded-[14px] p-4 mb-4"><DocumentIcon kind="file" /></View>
            <Text className="text-card-foreground text-lg font-semibold">No documents yet</Text>
            <Text className="text-muted-foreground mt-2 text-sm text-center leading-5">
              Your uploaded documents will appear here. Tap Upload document to add your first file.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {files.map((file) => (
              <Pressable key={file.file_id} accessibilityRole="button"
                accessibilityLabel={`${file.file_type?.name || 'Driver document'}, ${file.original_name || 'Unnamed file'}${file.is_expired ? ', expired' : ''}. View details`}
                onPress={() => router.push({ pathname: '/documents/[file_id]', params: { file_id: file.file_id } })}
                className="bg-[#F5F5F8] dark:bg-card"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 88, borderRadius: 20 }}>
                <View className="bg-white dark:bg-muted" style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}><DocumentIcon kind="file" /></View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '600' }}>{file.file_type?.name || 'Driver document'}</Text>
                  <Text numberOfLines={1} className="text-muted-foreground" style={{ fontSize: 13 }}>{file.original_name || 'Unnamed file'}</Text>
                </View>
                <DocumentStatus file={file} />
                <DocumentIcon kind="chevron" />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View className="flex-1 bg-background">
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top + 16,
              paddingBottom: 32,
              paddingHorizontal: 18,
            }}
            showsVerticalScrollIndicator={false}>
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground text-3xl font-semibold">Upload document</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Text className="text-primary text-base font-semibold">Close</Text>
              </Pressable>
            </View>

            <View className="bg-card mt-6 rounded-xl px-5 py-5">
              <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">File type</Text>
              <View className="mt-4 gap-3">
                {fileTypes.map((fileType) => {
                  const isSelected = fileType.file_type_id === selectedFileTypeId;
                  return (
                    <Pressable
                      key={fileType.file_type_id}
                      onPress={() => setSelectedFileTypeId(fileType.file_type_id)}
                      className={`rounded-[22px] border px-4 py-4 ${
                        isSelected ? 'border-primary bg-accent' : 'border-border bg-muted'
                      }`}>
                      <Text className="text-card-foreground text-base font-semibold">{fileType.name}</Text>
                      {fileType.description ? (
                        <Text className="text-muted-foreground mt-1 text-sm leading-6">{fileType.description}</Text>
                      ) : null}
                      {fileType.requires_expiry ? (
                        <Text className="text-warning-foreground mt-2 text-xs font-semibold uppercase tracking-[2px]">
                          Expiry required
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="bg-card mt-4 rounded-xl px-5 py-5">
              <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">Selected file</Text>
              <Pressable onPress={openPicker} className="bg-secondary mt-4 rounded-full px-4 py-4">
                <Text className="text-secondary-foreground text-center text-base font-semibold">
                  {selectedDocument ? 'Choose a different file' : 'Choose file'}
                </Text>
              </Pressable>
              <Text className="text-muted-foreground mt-3 text-base">
                {selectedDocument ? selectedDocument.name : 'No file selected'}
              </Text>
            </View>

            {selectedFileType?.requires_expiry ? (
              <View className="bg-card mt-4 rounded-xl px-5 py-5">
                <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">Expiry date</Text>
                <DateInput value={expiresAt} onChange={setExpiresAt} disabled={isUploading} />
              </View>
            ) : null}

            {formError ? (
              <View className="border-warning bg-warning mt-4 rounded-[24px] border px-4 py-4">
                <Text className="text-warning-foreground text-sm font-semibold">{formError}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={isUploading}
              onPress={handleUpload}
              className={`mt-6 items-center rounded-full px-6 py-4 bg-primary disabled:opacity-50`}>
              {isUploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-primary-foreground text-base font-semibold">Upload</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
