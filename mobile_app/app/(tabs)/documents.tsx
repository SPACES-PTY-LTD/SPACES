import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiRequestError, DriverEntityFile, DriverFileType, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

function formatBytes(value?: number) {
  if (!value || value <= 0) {
    return '-';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'No expiry';
  }

  return value.slice(0, 10);
}

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
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
      } catch (error) {
        const requestError = error as ApiRequestError;
        setErrorMessage(requestError.message || 'Unable to load driver files.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [session?.token],
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

  const handleDownload = async (fileId: string) => {
    if (!session?.token) {
      return;
    }

    try {
      const response = await driverApi.getFileDownloadUrl(session.token, fileId);
      await WebBrowser.openBrowserAsync(response.url);
    } catch (error) {
      const requestError = error as ApiRequestError;
      setErrorMessage(requestError.message || 'Unable to open file.');
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 8, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadDocuments('refresh')} />}
        showsVerticalScrollIndicator={false}>
        <View className="bg-secondary rounded-xl px-6 py-6">
          <Text className="text-primary text-sm uppercase tracking-[3px]">Documents</Text>
          <Text className="text-secondary-foreground mt-4 text-4xl font-semibold leading-tight">Driver files</Text>
          <Text className="text-secondary-foreground mt-3 text-base leading-6 opacity-80">
            Upload only the file types your merchant allows drivers to submit.
          </Text>

          <Pressable
            onPress={() => {
              resetUploadForm();
              setModalVisible(true);
            }}
            className="bg-card mt-6 self-start rounded-full px-5 py-3">
            <Text className="text-card-foreground text-sm font-semibold">Upload document</Text>
          </Pressable>
        </View>

        {errorMessage ? (
          <View className="border-destructive bg-destructive mt-6 rounded-xl border px-5 py-5">
            <Text className="text-destructive-foreground text-base font-semibold">{errorMessage}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View className="bg-card mt-6 items-center rounded-xl px-5 py-12">
            <ActivityIndicator color="#F54A4A" />
          </View>
        ) : files.length === 0 ? (
          <View className="bg-card mt-6 rounded-xl px-5 py-5">
            <Text className="text-card-foreground text-lg font-semibold">No uploaded files</Text>
            <Text className="text-muted-foreground mt-2 text-base leading-7">
              Uploaded driver documents will appear here once submitted.
            </Text>
          </View>
        ) : (
          <View className="mt-6 gap-4">
            {files.map((file) => (
              <View key={file.file_id} className="bg-card rounded-xl px-5 py-5">
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1">
                    <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">
                      {file.file_type?.name || 'Driver document'}
                    </Text>
                    <Text className="text-card-foreground mt-2 text-xl font-semibold">
                      {file.original_name || 'Unnamed file'}
                    </Text>
                    <Text className="text-muted-foreground mt-2 text-sm">
                      Uploaded {formatDate(file.created_at)} by {file.uploaded_by_user?.name || file.uploaded_by_role || 'Unknown'}
                    </Text>
                  </View>
                  <View
                    className={`rounded-full px-4 py-2 ${
                      file.is_expired ? 'bg-destructive' : file.expires_at ? 'bg-warning' : 'bg-muted'
                    }`}>
                    <Text
                      className={`text-sm font-semibold uppercase ${
                        file.is_expired ? 'text-destructive-foreground' : file.expires_at ? 'text-warning-foreground' : 'text-muted-foreground'
                      }`}>
                      {file.is_expired ? 'Expired' : file.expires_at ? 'Has expiry' : 'No expiry'}
                    </Text>
                  </View>
                </View>

                <View className="bg-muted mt-5 rounded-[24px] px-4 py-4">
                  <InfoLine label="Size" value={formatBytes(file.size_bytes)} />
                  <InfoLine label="Expiry" value={formatDate(file.expires_at)} />
                  <InfoLine label="Type" value={file.mime_type || 'Unknown'} />
                </View>

                <Pressable
                  onPress={() => handleDownload(file.file_id)}
                  className="bg-secondary mt-4 items-center rounded-full px-4 py-4">
                  <Text className="text-secondary-foreground text-base font-semibold">Download</Text>
                </Pressable>
              </View>
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
                <TextInput
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                  onChangeText={setExpiresAt}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={isDarkMode ? '#71717A' : '#A8A29E'}
                  value={expiresAt}
                  className="border-input-border bg-input text-input-foreground mt-4 rounded-[18px] border px-4 py-4 text-base"
                />
              </View>
            ) : null}

            {formError ? (
              <View className="border-destructive bg-destructive mt-4 rounded-[24px] border px-4 py-4">
                <Text className="text-destructive-foreground text-sm font-semibold">{formError}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={isUploading}
              onPress={handleUpload}
              className={`mt-6 items-center rounded-full px-6 py-4 ${isUploading ? 'bg-destructive' : 'bg-primary'}`}>
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View className="mt-3 first:mt-0">
      <Text className="text-muted-foreground text-xs uppercase tracking-[2px]">{label}</Text>
      <Text className="text-card-foreground mt-1 text-base font-medium">{value}</Text>
    </View>
  );
}
