import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/component/ui/Text';
import { BottomSheet } from '@/component/ui/BottomSheet';
import { ActionSheet, type ActionSheetRef } from '@/component/ui/ActionSheet';
import { createSheetHandoff } from '@/component/ui/sheet-handoff';
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
  const uploadSheetRef = useRef<BottomSheetModal>(null);
  const pickerHandoff = useRef<ReturnType<typeof createSheetHandoff> | null>(null);
  const sourceSheetRef = useRef<ActionSheetRef>(null);
  const resolveSource = useRef<((source?: string) => void) | null>(null);
  const [fileTypeExpanded, setFileTypeExpanded] = useState(false);
  const [isPicking, setIsPicking] = useState(false);

  useEffect(() => {
    const handoff = createSheetHandoff(
      () => uploadSheetRef.current?.dismiss(),
      () => uploadSheetRef.current?.present(),
    );
    pickerHandoff.current = handoff;
    return () => {
      handoff.dispose();
      resolveSource.current?.();
      resolveSource.current = null;
    };
  }, []);
  const [selectedFileTypeId, setSelectedFileTypeId] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const requiredSheetRef = useRef<BottomSheetModal>(null);
  const requiredRequest = useRef(0);
  const [requiredNames, setRequiredNames] = useState<string[]>([]);
  const [requirementsLoading, setRequirementsLoading] = useState(false);
  const [requirementsError, setRequirementsError] = useState<string | null>(null);

  useEffect(() => () => { requiredRequest.current++; }, []);

  const loadRequirements = async () => {
    if (!session?.token) return;
    const request = ++requiredRequest.current;
    setRequirementsLoading(true);
    setRequirementsError(null);
    try {
      const dashboard = await driverApi.dashboard(session.token);
      if (request !== requiredRequest.current) return;
      setRequiredNames(dashboard.documents.missing_required_names);
    } catch (error) {
      if (request !== requiredRequest.current) return;
      setRequirementsError((error as ApiRequestError).message || 'Unable to load required documents.');
    } finally {
      if (request === requiredRequest.current) setRequirementsLoading(false);
    }
  };

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
    setFileTypeExpanded(false);
  };

  const openPicker = async () => {
    const handoff = pickerHandoff.current;
    if (!handoff || handoff.running || isUploading) return;
    setIsPicking(true);
    setFileTypeExpanded(false);
    await handoff.run(async () => {
      try {
        const source = await new Promise<string | undefined>(resolve => {
          if (!sourceSheetRef.current) return resolve(undefined);
          resolveSource.current = resolve;
          sourceSheetRef.current.present({
            title: 'Choose file',
            actions: [
              { id: 'file', label: 'File', onPress: () => {} },
              { id: 'photo', label: 'Photo', onPress: () => {} },
              { id: 'camera', label: 'Camera', onPress: () => {} },
            ],
            onDismiss: choice => { resolveSource.current = null; resolve(choice); },
          });
        });
        if (!handoff.active || !source) return;
        let selected: DocumentPicker.DocumentPickerAsset | undefined;
        if (source === 'file') {
          const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
          if (!result.canceled) selected = result.assets[0];
        } else {
          if (source === 'camera') {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!handoff.active) return;
            if (!permission.granted) {
              setFormError('Allow camera access in device settings, or choose File or Photo.');
              return;
            }
          }
          const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9, allowsEditing: false };
          const result = source === 'camera'
            ? await ImagePicker.launchCameraAsync(options)
            : await ImagePicker.launchImageLibraryAsync(options);
          if (!result.canceled) {
            const asset = result.assets[0];
            const mimeType = asset.mimeType || 'image/jpeg';
            selected = {
              lastModified: Date.now(),
              uri: asset.uri,
              name: asset.fileName || `driver-document-${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`,
              mimeType,
              size: asset.fileSize,
            };
          }
        }
        if (handoff.active && selected) {
          setSelectedDocument(selected);
          setFormError(null);
        }
      } catch (error) {
        if (handoff.active) setFormError((error as Error).message || 'Unable to choose a file.');
      }
    });
    if (handoff.active) setIsPicking(false);
  };

  const handleUpload = async () => {
    if (!session?.token || isUploading || isPicking) {
      return;
    }

    if (!selectedFileType) {
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
      uploadSheetRef.current?.dismiss();
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
        <Pressable accessibilityRole="button" disabled={isUploading || isPicking}
          onPress={() => { resetUploadForm(); uploadSheetRef.current?.present(); }}
          style={{ backgroundColor: '#15803d', borderRadius: 24, minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>Upload document</Text>
        </Pressable>
      } />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadDocuments('refresh')} />}
        showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {requiredDocumentCount != null && requiredDocumentCount > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`${requiredDocumentCount} required uploads. View required documents`}
              onPress={() => { void loadRequirements(); requiredSheetRef.current?.present(); }}
              style={{ flexBasis: '100%', minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: isDarkMode ? '#382B13' : '#FFF4D6' }}>
              <DocumentIcon kind="required" />
              <Text style={{ fontSize: 24, lineHeight: 32, fontWeight: '700', color: isDarkMode ? '#FDE68A' : '#744700' }}>{requiredDocumentCount}</Text>
              <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', color: isDarkMode ? '#FDE68A' : '#744700' }}>Required uploads</Text>
              <DocumentIcon kind="requiredChevron" />
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

      <BottomSheet modalRef={requiredSheetRef} title="Required documents" scrollable>
        <Text className="text-muted-foreground" style={{ fontSize: 14, lineHeight: 20 }}>
          These documents still need to be added to your profile.
        </Text>
        {requirementsLoading ? (
          <View style={{ paddingVertical: 24, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color="#15803d" />
            <Text className="text-muted-foreground">Loading required documents…</Text>
          </View>
        ) : requirementsError ? (
          <View style={{ gap: 12 }}>
            <Text className="text-warning-foreground">{requirementsError}</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadRequirements()}
              style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text className="text-primary" style={{ fontWeight: '600' }}>Retry</Text>
            </Pressable>
          </View>
        ) : requiredNames.length === 0 ? (
          <Text className="text-muted-foreground">No required documents are missing.</Text>
        ) : (
          <View style={{ gap: 12 }}>
            {requiredNames.map((name, index) => (
              <View key={`${index}-${name}`} className="bg-[#F5F5F8] dark:bg-muted"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16 }}>
                <DocumentIcon kind="required" />
                <Text style={{ flex: 1, fontSize: 16, lineHeight: 24, fontWeight: '600' }}>{name}</Text>
              </View>
            ))}
          </View>
        )}
      </BottomSheet>

      <BottomSheet modalRef={uploadSheetRef} title="Upload document" scrollable
        dismissible={!isUploading} onDismiss={() => { pickerHandoff.current?.onDismiss(); setFileTypeExpanded(false); }}>
            <View style={{ gap: 4 }}>
              <Text className="text-sm font-semibold">File type</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`File type, ${selectedFileType?.name || 'not selected'}`}
                accessibilityState={{ expanded: fileTypeExpanded, disabled: isUploading || isLoading || fileTypes.length === 0 }}
                disabled={isUploading || isLoading || fileTypes.length === 0}
                onPress={() => setFileTypeExpanded(value => !value)}
                className="border-input-border bg-input mt-3 rounded-[9px] border"
                style={{ minHeight: 56, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ flex: 1, fontSize: 16 }} className={selectedFileType ? 'text-input-foreground' : 'text-muted-foreground'}>
                  {selectedFileType?.name || 'Select file type'}
                </Text>
                <Feather name={fileTypeExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={isDarkMode ? '#A1A1AA' : '#71717A'} />
              </Pressable>
              {isLoading ? <ActivityIndicator color="#15803d" /> : errorMessage ? (
                <View style={{ gap: 8, marginTop: 12 }}>
                  <Text className="text-warning-foreground">{errorMessage}</Text>
                  <Pressable accessibilityRole="button" onPress={() => void loadDocuments()} style={{ minHeight: 44, justifyContent: 'center' }}>
                    <Text className="text-primary">Retry loading file types</Text>
                  </Pressable>
                </View>
              ) : fileTypes.length === 0 ? <Text className="text-muted-foreground mt-3">No file types are available for upload.</Text> : null}
              {fileTypeExpanded && !isUploading ? (
                <View className="border-input-border bg-input mt-2 rounded-[9px] border" style={{ overflow: 'hidden' }}>
                  {fileTypes.map(fileType => (
                    <Pressable key={fileType.file_type_id} accessibilityRole="button"
                      accessibilityState={{ selected: fileType.file_type_id === selectedFileTypeId }}
                      onPress={() => { setSelectedFileTypeId(fileType.file_type_id); setExpiresAt(''); setFormError(null); setFileTypeExpanded(false); }}
                      className={fileType.file_type_id === selectedFileTypeId ? 'bg-accent' : ''}
                      style={{ minHeight: 52, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Text style={{ flex: 1, fontSize: 16 }}>{fileType.name}</Text>
                      {fileType.file_type_id === selectedFileTypeId && <Feather name="check" size={20} color="#15803d" />}
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {!!selectedFileType?.description && <Text className="text-muted-foreground mt-3 text-sm leading-5">{selectedFileType.description}</Text>}
              {selectedFileType?.requires_expiry && <Text className="text-warning-foreground mt-2 text-sm">Expiry required</Text>}
            </View>

            <View>
              <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">Selected file</Text>
              <Pressable accessibilityRole="button" disabled={isUploading || isPicking} onPress={() => void openPicker()} className="bg-secondary mt-4 rounded-full px-4 py-4">
                <Text className="text-secondary-foreground text-center text-base font-semibold">
                  {selectedDocument ? 'Choose a different file' : 'Choose file'}
                </Text>
              </Pressable>
              <Text className="text-muted-foreground mt-3 text-base">
                {selectedDocument ? selectedDocument.name : 'No file selected'}
              </Text>
            </View>

            {selectedFileType?.requires_expiry ? (
              <View>
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
              accessibilityRole="button" disabled={isUploading || isPicking || isLoading || fileTypes.length === 0}
              onPress={() => void handleUpload()}
              className={`mt-6 items-center rounded-full px-6 py-4 bg-primary disabled:opacity-50`}>
              {isUploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-primary-foreground text-base font-semibold">Upload</Text>
              )}
            </Pressable>
      </BottomSheet>
      <ActionSheet ref={sourceSheetRef} />
    </View>
  );
}
