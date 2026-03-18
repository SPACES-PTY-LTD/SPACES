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
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    <View className="flex-1 bg-[#F3EFE7]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 8, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadDocuments('refresh')} />}
        showsVerticalScrollIndicator={false}>
        <View className="rounded-[32px] bg-[#111111] px-6 py-6">
          <Text className="text-sm uppercase tracking-[3px] text-[#F54A4A]">Documents</Text>
          <Text className="mt-4 text-4xl font-semibold leading-tight text-white">Driver files</Text>
          <Text className="mt-3 text-base leading-6 text-[#C8C8C8]">
            Upload only the file types your merchant allows drivers to submit.
          </Text>

          <Pressable
            onPress={() => {
              resetUploadForm();
              setModalVisible(true);
            }}
            className="mt-6 self-start rounded-full bg-white px-5 py-3">
            <Text className="text-sm font-semibold text-[#111111]">Upload document</Text>
          </Pressable>
        </View>

        {errorMessage ? (
          <View className="mt-6 rounded-[28px] border border-[#FECACA] bg-[#FEE2E2] px-5 py-5">
            <Text className="text-base font-semibold text-[#991B1B]">{errorMessage}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View className="mt-6 items-center rounded-[28px] bg-white px-5 py-12">
            <ActivityIndicator color="#F54A4A" />
          </View>
        ) : files.length === 0 ? (
          <View className="mt-6 rounded-[28px] bg-white px-5 py-5">
            <Text className="text-lg font-semibold text-[#111111]">No uploaded files</Text>
            <Text className="mt-2 text-base leading-7 text-[#57534E]">
              Uploaded driver documents will appear here once submitted.
            </Text>
          </View>
        ) : (
          <View className="mt-6 gap-4">
            {files.map((file) => (
              <View key={file.file_id} className="rounded-[28px] bg-white px-5 py-5">
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1">
                    <Text className="text-sm uppercase tracking-[2px] text-[#78716C]">
                      {file.file_type?.name || 'Driver document'}
                    </Text>
                    <Text className="mt-2 text-xl font-semibold text-[#111111]">
                      {file.original_name || 'Unnamed file'}
                    </Text>
                    <Text className="mt-2 text-sm text-[#57534E]">
                      Uploaded {formatDate(file.created_at)} by {file.uploaded_by_user?.name || file.uploaded_by_role || 'Unknown'}
                    </Text>
                  </View>
                  <View
                    className={`rounded-full px-4 py-2 ${
                      file.is_expired ? 'bg-[#FEE2E2]' : file.expires_at ? 'bg-[#FEF3C7]' : 'bg-[#E7E5E4]'
                    }`}>
                    <Text
                      className={`text-sm font-semibold uppercase ${
                        file.is_expired ? 'text-[#B91C1C]' : file.expires_at ? 'text-[#92400E]' : 'text-[#57534E]'
                      }`}>
                      {file.is_expired ? 'Expired' : file.expires_at ? 'Has expiry' : 'No expiry'}
                    </Text>
                  </View>
                </View>

                <View className="mt-5 rounded-[24px] bg-[#F5F5F4] px-4 py-4">
                  <InfoLine label="Size" value={formatBytes(file.size_bytes)} />
                  <InfoLine label="Expiry" value={formatDate(file.expires_at)} />
                  <InfoLine label="Type" value={file.mime_type || 'Unknown'} />
                </View>

                <Pressable
                  onPress={() => handleDownload(file.file_id)}
                  className="mt-4 items-center rounded-full bg-[#111111] px-4 py-4">
                  <Text className="text-base font-semibold text-white">Download</Text>
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
        <View className="flex-1 bg-[#F3EFE7]">
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top + 16,
              paddingBottom: 32,
              paddingHorizontal: 18,
            }}
            showsVerticalScrollIndicator={false}>
            <View className="flex-row items-center justify-between">
              <Text className="text-3xl font-semibold text-[#111111]">Upload document</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Text className="text-base font-semibold text-[#F54A4A]">Close</Text>
              </Pressable>
            </View>

            <View className="mt-6 rounded-[28px] bg-white px-5 py-5">
              <Text className="text-sm uppercase tracking-[2px] text-[#78716C]">File type</Text>
              <View className="mt-4 gap-3">
                {fileTypes.map((fileType) => {
                  const isSelected = fileType.file_type_id === selectedFileTypeId;
                  return (
                    <Pressable
                      key={fileType.file_type_id}
                      onPress={() => setSelectedFileTypeId(fileType.file_type_id)}
                      className={`rounded-[22px] border px-4 py-4 ${
                        isSelected ? 'border-[#F54A4A] bg-[#FFF1F1]' : 'border-[#E7E5E4] bg-[#FAFAF9]'
                      }`}>
                      <Text className="text-base font-semibold text-[#111111]">{fileType.name}</Text>
                      {fileType.description ? (
                        <Text className="mt-1 text-sm leading-6 text-[#57534E]">{fileType.description}</Text>
                      ) : null}
                      {fileType.requires_expiry ? (
                        <Text className="mt-2 text-xs font-semibold uppercase tracking-[2px] text-[#B45309]">
                          Expiry required
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="mt-4 rounded-[28px] bg-white px-5 py-5">
              <Text className="text-sm uppercase tracking-[2px] text-[#78716C]">Selected file</Text>
              <Pressable onPress={openPicker} className="mt-4 rounded-full bg-[#111111] px-4 py-4">
                <Text className="text-center text-base font-semibold text-white">
                  {selectedDocument ? 'Choose a different file' : 'Choose file'}
                </Text>
              </Pressable>
              <Text className="mt-3 text-base text-[#57534E]">
                {selectedDocument ? selectedDocument.name : 'No file selected'}
              </Text>
            </View>

            {selectedFileType?.requires_expiry ? (
              <View className="mt-4 rounded-[28px] bg-white px-5 py-5">
                <Text className="text-sm uppercase tracking-[2px] text-[#78716C]">Expiry date</Text>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                  onChangeText={setExpiresAt}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#A8A29E"
                  value={expiresAt}
                  className="mt-4 rounded-[18px] border border-[#E7E5E4] bg-[#FAFAF9] px-4 py-4 text-base text-[#111111]"
                />
              </View>
            ) : null}

            {formError ? (
              <View className="mt-4 rounded-[24px] border border-[#FECACA] bg-[#FEE2E2] px-4 py-4">
                <Text className="text-sm font-semibold text-[#991B1B]">{formError}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={isUploading}
              onPress={handleUpload}
              className={`mt-6 items-center rounded-full px-6 py-4 ${isUploading ? 'bg-[#FCA5A5]' : 'bg-[#F54A4A]'}`}>
              {isUploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-semibold text-white">Upload</Text>
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
      <Text className="text-xs uppercase tracking-[2px] text-[#A8A29E]">{label}</Text>
      <Text className="mt-1 text-base font-medium text-[#111111]">{value}</Text>
    </View>
  );
}
