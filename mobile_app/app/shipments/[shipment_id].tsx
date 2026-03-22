import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiRequestError, CancelReason, DriverEntityFile, DriverFileType, DriverShipment, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

const STATUS_FLOW = ['booked', 'pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed'];

export default function ShipmentDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { shipment_id } = useLocalSearchParams<{ shipment_id: string }>();
  const { session } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const [shipment, setShipment] = useState<DriverShipment | null>(null);
  const [cancelReasons, setCancelReasons] = useState<CancelReason[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<'cancel' | 'pod' | 'status' | null>(null);
  const [statusValue, setStatusValue] = useState('in_transit');
  const [statusNote, setStatusNote] = useState('');
  const [podFileKey, setPodFileKey] = useState('');
  const [podFileType, setPodFileType] = useState('image/jpeg');
  const [podSignedBy, setPodSignedBy] = useState('');
  const [cancelReasonCode, setCancelReasonCode] = useState('');
  const [cancelReasonText, setCancelReasonText] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [shipmentFiles, setShipmentFiles] = useState<DriverEntityFile[]>([]);
  const [shipmentFileTypes, setShipmentFileTypes] = useState<DriverFileType[]>([]);
  const [shipmentFilesError, setShipmentFilesError] = useState<string | null>(null);
  const [fileModalVisible, setFileModalVisible] = useState(false);
  const [selectedFileTypeId, setSelectedFileTypeId] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [fileExpiresAt, setFileExpiresAt] = useState('');
  const [fileFormError, setFileFormError] = useState<string | null>(null);

  const selectedShipmentFileType =
    shipmentFileTypes.find((item) => item.file_type_id === selectedFileTypeId) ?? null;

  const loadShipment = useCallback(async () => {
    if (!session?.token || !shipment_id) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await driverApi.getShipment(session.token, shipment_id);
      setShipment(response);
      setErrorMessage(null);
    } catch (error) {
      const requestError = error as ApiRequestError;
      setErrorMessage(requestError.message || 'Unable to load shipment.');
    } finally {
      setIsLoading(false);
    }
  }, [session?.token, shipment_id]);

  const loadShipmentFiles = useCallback(async () => {
    if (!session?.token || !shipment_id) {
      setShipmentFiles([]);
      setShipmentFileTypes([]);
      return;
    }

    try {
      const [filesResponse, typesResponse] = await Promise.all([
        driverApi.listShipmentFiles(session.token, shipment_id),
        driverApi.listFileTypes(session.token, 'shipment'),
      ]);

      setShipmentFiles(filesResponse.data);
      setShipmentFileTypes(typesResponse.data);
      setShipmentFilesError(null);
    } catch (error) {
      const requestError = error as ApiRequestError;
      setShipmentFilesError(requestError.message || 'Unable to load shipment files.');
      setShipmentFiles([]);
    }
  }, [session?.token, shipment_id]);

  useEffect(() => {
    loadShipment();
  }, [loadShipment]);

  useEffect(() => {
    loadShipmentFiles();
  }, [loadShipmentFiles]);

  useFocusEffect(
    useCallback(() => {
      loadShipment();
    }, [loadShipment]),
  );

  useFocusEffect(
    useCallback(() => {
      loadShipmentFiles();
    }, [loadShipmentFiles]),
  );

  useEffect(() => {
    async function loadCancelReasons() {
      if (!session?.token) {
        return;
      }

      try {
        const response = await driverApi.listCancelReasons(session.token);
        setCancelReasons(response.data);
        setCancelReasonCode((current) => current || response.data[0]?.code || '');
      } catch {
        setCancelReasons([]);
      }
    }

    loadCancelReasons();
  }, [session?.token]);

  useEffect(() => {
    const currentStatus = shipment?.booking?.status || shipment?.status;
    if (!currentStatus) {
      return;
    }

    const availableStatuses = getAvailableStatuses(currentStatus);
    setStatusValue((current) => (availableStatuses.includes(current) ? current : availableStatuses[0] ?? currentStatus));
    setPodSignedBy((current) => current || shipment?.dropoff_location?.name || '');
  }, [shipment]);

  async function runAction(action: (token: string) => Promise<DriverShipment>, successMessage: string) {
    if (!session?.token || !shipment_id) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setActionMessage(null);

    try {
      const response = await action(session.token);
      setShipment(response);
      setActionMessage(successMessage);
      setActiveAction(null);
    } catch (error) {
      const requestError = error as ApiRequestError;
      setErrorMessage(requestError.message || 'Unable to complete driver action.');
    } finally {
      setIsMutating(false);
    }
  }

  async function pickShipmentFile() {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return;
    }

    setSelectedDocument(result.assets[0] ?? null);
  }

  function resetShipmentFileForm() {
    setSelectedFileTypeId('');
    setSelectedDocument(null);
    setFileExpiresAt('');
    setFileFormError(null);
  }

  async function uploadShipmentFile() {
    if (!session?.token || !shipment_id) {
      return;
    }

    if (!selectedFileTypeId) {
      setFileFormError('Select a file type.');
      return;
    }

    if (!selectedDocument) {
      setFileFormError('Choose a file to upload.');
      return;
    }

    if (selectedShipmentFileType?.requires_expiry && !fileExpiresAt.trim()) {
      setFileFormError('Expiry date is required for this file type.');
      return;
    }

    setIsMutating(true);
    setFileFormError(null);

    try {
      await driverApi.uploadShipmentFile(session.token, shipment_id, {
        file_type_id: selectedFileTypeId,
        file: {
          uri: selectedDocument.uri,
          name: selectedDocument.name,
          type: selectedDocument.mimeType,
        },
        expires_at: fileExpiresAt.trim() || undefined,
      });

      resetShipmentFileForm();
      setFileModalVisible(false);
      await loadShipmentFiles();
      setActionMessage('Shipment file uploaded.');
    } catch (error) {
      const requestError = error as ApiRequestError;
      setFileFormError(requestError.message || 'Unable to upload shipment file.');
    } finally {
      setIsMutating(false);
    }
  }

  async function openShipmentFile(fileId: string) {
    if (!session?.token) {
      return;
    }

    try {
      const response = await driverApi.getFileDownloadUrl(session.token, fileId);
      await WebBrowser.openBrowserAsync(response.url);
    } catch (error) {
      const requestError = error as ApiRequestError;
      setShipmentFilesError(requestError.message || 'Unable to open shipment file.');
    }
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      <Pressable
        onPress={() => router.back()}
        className="bg-card absolute left-5 z-20 h-12 w-12 items-center justify-center rounded-full"
        style={{ top: insets.top + 10 }}>
        <Feather name="chevron-left" size={24} color={isDarkMode ? '#FFFFFF' : '#111111'} />
      </Pressable>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 72, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        <View className="bg-secondary rounded-xl px-6 py-6">
          <Text className="text-primary text-sm uppercase tracking-[3px]">Shipment detail</Text>
          <Text className="text-secondary-foreground mt-4 text-3xl font-semibold leading-tight">
            {shipment?.merchant_order_ref || shipment?.delivery_note_number || shipment_id}
          </Text>
          <Text className="text-secondary-foreground mt-3 text-base leading-6 opacity-80">
            Current status: {shipment ? formatStatus(shipment.booking?.status || shipment.status) : 'Loading'}
          </Text>
        </View>

        {isLoading ? (
          <View className="bg-card mt-6 items-center rounded-xl px-5 py-12">
            <ActivityIndicator color="#F54A4A" />
          </View>
        ) : errorMessage ? (
          <View className="border-destructive bg-destructive mt-6 rounded-xl border px-5 py-5">
            <Text className="text-destructive-foreground text-base font-semibold">{errorMessage}</Text>
          </View>
        ) : shipment ? (
          <>
            {!shipment.booking ? (
              <View className="border-warning bg-warning mt-6 rounded-xl border px-5 py-5">
                <Text className="text-warning-foreground text-base font-semibold">
                  Driver actions are unavailable because this shipment does not have a booking yet.
                </Text>
              </View>
            ) : (
              <View className="bg-card mt-6 rounded-xl px-5 py-5">
                <Text className="text-card-foreground text-lg font-semibold">Driver actions</Text>
                <Text className="text-muted-foreground mt-2 text-sm leading-6">
                  Record scans, update delivery status, attach POD details, or cancel the shipment.
                </Text>

                <View className="mt-4 flex-row flex-wrap gap-3">
                  <ActionChip label="Update status" isActive={activeAction === 'status'} onPress={() => setActiveAction(toggleAction(activeAction, 'status'))} />
                  <ActionChip label="Scan" isActive={false} onPress={() => router.push(`/shipments/${shipment.shipment_id}/scan`)} />
                  <ActionChip label="POD" isActive={activeAction === 'pod'} onPress={() => setActiveAction(toggleAction(activeAction, 'pod'))} />
                  <ActionChip label="Cancel" isActive={activeAction === 'cancel'} onPress={() => setActiveAction(toggleAction(activeAction, 'cancel'))} destructive />
                </View>

                {actionMessage ? (
                  <View className="bg-success mt-4 rounded-[20px] px-4 py-3">
                    <Text className="text-success-foreground text-sm font-medium">{actionMessage}</Text>
                  </View>
                ) : null}

                {activeAction === 'status' ? (
                  <ActionCard
                    title="Update booking status"
                    description="Choose the next shipment state available to this driver booking.">
                    <OptionRow options={getAvailableStatuses(shipment.booking.status)} selected={statusValue} onSelect={setStatusValue} />
                    <Input
                      label="Note"
                      value={statusNote}
                      onChangeText={setStatusNote}
                      placeholder="Optional status note"
                      multiline
                    />
                    <SubmitButton
                      label={isMutating ? 'Saving...' : 'Save status'}
                      disabled={isMutating}
                      onPress={() =>
                        runAction(
                          (token) => driverApi.updateShipmentStatus(token, shipment.shipment_id, { status: statusValue, note: statusNote || undefined }),
                          'Shipment status updated.',
                        )
                      }
                    />
                  </ActionCard>
                ) : null}

                {activeAction === 'pod' ? (
                  <ActionCard
                    title="Attach POD"
                    description="Save proof-of-delivery metadata against the current booking.">
                    <Input
                      label="File key"
                      value={podFileKey}
                      onChangeText={setPodFileKey}
                      placeholder="pods/shipment-proof.jpg"
                    />
                    <Input
                      label="File type"
                      value={podFileType}
                      onChangeText={setPodFileType}
                      placeholder="image/jpeg"
                    />
                    <Input
                      label="Signed by"
                      value={podSignedBy}
                      onChangeText={setPodSignedBy}
                      placeholder="Receiver name"
                    />
                    <SubmitButton
                      label={isMutating ? 'Saving...' : 'Save POD'}
                      disabled={isMutating || !podFileKey.trim()}
                      onPress={() =>
                        runAction(
                          (token) =>
                            driverApi.uploadShipmentPod(token, shipment.shipment_id, {
                              file_key: podFileKey.trim(),
                              file_type: podFileType.trim() || undefined,
                              signed_by: podSignedBy.trim() || undefined,
                            }),
                          'Proof of delivery saved.',
                        )
                      }
                    />
                  </ActionCard>
                ) : null}

                {activeAction === 'cancel' ? (
                  <ActionCard
                    title="Cancel shipment"
                    description="Choose a cancel reason and optionally provide additional detail.">
                    <OptionRow
                      options={cancelReasons.map((reason) => reason.code)}
                      selected={cancelReasonCode}
                      onSelect={setCancelReasonCode}
                      renderLabel={(value) => cancelReasons.find((reason) => reason.code === value)?.title || value}
                      emptyLabel="No cancel reasons available"
                    />
                    <Input
                      label="Reason text"
                      value={cancelReasonText}
                      onChangeText={setCancelReasonText}
                      placeholder="Required when using 'other'"
                      multiline
                    />
                    <Input
                      label="Note"
                      value={cancelNote}
                      onChangeText={setCancelNote}
                      placeholder="Optional cancellation note"
                      multiline
                    />
                    <SubmitButton
                      label={isMutating ? 'Cancelling...' : 'Cancel shipment'}
                      disabled={isMutating || !cancelReasonCode}
                      destructive
                      onPress={() =>
                        runAction(
                          (token) =>
                            driverApi.cancelShipment(token, shipment.shipment_id, {
                              reason_code: cancelReasonCode,
                              reason: cancelReasonText.trim() || undefined,
                              note: cancelNote.trim() || undefined,
                            }),
                          'Shipment cancelled.',
                        )
                      }
                    />
                  </ActionCard>
                ) : null}
              </View>
            )}

            <DetailCard
              title="Pickup"
              value={shipment.pickup_location?.full_address || 'No pickup address'}
              subtitle={shipment.pickup_instructions || shipment.pickup_location?.company || undefined}
            />
            <DetailCard
              title="Dropoff"
              value={shipment.dropoff_location?.full_address || 'No dropoff address'}
              subtitle={shipment.dropoff_instructions || shipment.dropoff_location?.company || undefined}
            />
            <DetailCard
              title="Pickup scan progress"
              value={`${shipment.scanned_parcel_count ?? 0} of ${shipment.total_parcel_count ?? shipment.parcels?.length ?? 0} parcels scanned`}
              subtitle={shipment.all_parcels_scanned ? 'All parcels scanned. Shipment is in transit.' : 'Every parcel must be scanned before pickup is complete.'}
            />
            <View className="bg-card mt-4 rounded-xl px-5 py-5">
              <Text className="text-card-foreground text-lg font-semibold">Parcels</Text>
              <View className="mt-4 gap-3">
                {(shipment.parcels || []).map((parcel) => (
                  <View key={parcel.parcel_id} className="border-border rounded-[20px] border px-4 py-4">
                    <Text className="text-muted-foreground text-sm font-semibold uppercase tracking-[2px]">{parcel.parcel_code || 'No code'}</Text>
                    <Text className="text-card-foreground mt-2 text-base font-medium">
                      {parcel.contents_description || parcel.type || 'Parcel'}
                    </Text>
                    <Text className="text-muted-foreground mt-1 text-sm">
                      {parcel.is_picked_up_scanned ? `Scanned at ${parcel.picked_up_scanned_at || 'pickup'}` : 'Pending pickup scan'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="bg-card mt-6 rounded-xl px-5 py-5">
              <View className="flex-row items-center justify-between">
                <Text className="text-card-foreground text-lg font-semibold">Shipment files</Text>
                <Pressable
                  onPress={() => {
                    resetShipmentFileForm();
                    setFileModalVisible(true);
                  }}
                  className="bg-secondary rounded-full px-4 py-3">
                  <Text className="text-secondary-foreground text-sm font-semibold">Upload</Text>
                </Pressable>
              </View>

              {shipmentFilesError ? (
                <Text className="text-destructive-foreground mt-4 text-sm font-medium">{shipmentFilesError}</Text>
              ) : shipmentFiles.length === 0 ? (
                <Text className="text-muted-foreground mt-4 text-base">No shipment files uploaded yet.</Text>
              ) : (
                <View className="mt-4 gap-3">
                  {shipmentFiles.map((file) => (
                    <Pressable
                      key={file.file_id}
                      onPress={() => openShipmentFile(file.file_id)}
                      className="border-border rounded-[20px] border px-4 py-4">
                      <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">
                        {file.file_type?.name || 'Shipment file'}
                      </Text>
                      <Text className="text-card-foreground mt-2 text-base font-medium">
                        {file.original_name || 'Unnamed file'}
                      </Text>
                      <Text className="text-muted-foreground mt-1 text-sm">
                        {file.expires_at ? `Expires ${file.expires_at.slice(0, 10)}` : 'No expiry'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View className="bg-card mt-6 rounded-xl px-5 py-5">
              <Text className="text-card-foreground text-lg font-semibold">Timeline</Text>
              <InfoRow label="Booked at" value={shipment.booking?.booked_at} />
              <InfoRow label="Collected at" value={shipment.booking?.collected_at} />
              <InfoRow label="Delivered at" value={shipment.booking?.delivered_at} />
              <InfoRow label="Returned at" value={shipment.booking?.returned_at} />
              <InfoRow label="Cancelled at" value={shipment.booking?.cancelled_at} />
            </View>

            <View className="bg-card mt-6 rounded-xl px-5 py-5">
              <Text className="text-card-foreground text-lg font-semibold">Shipment info</Text>
              <InfoRow label="Service type" value={shipment.service_type} />
              <InfoRow label="Priority" value={shipment.priority} />
              <InfoRow label="Invoice" value={shipment.invoice_number} />
              <InfoRow label="Delivery note" value={shipment.delivery_note_number} />
              <InfoRow label="Carrier job" value={shipment.booking?.carrier_job_id} />
              <InfoRow label="Run status" value={shipment.run_status} />
              <InfoRow
                label="Cancellation reason"
                value={shipment.booking?.cancel_reason || shipment.booking?.cancellation_reason_code}
              />
            </View>

            <View className="bg-card mt-6 rounded-xl px-5 py-5">
              <Text className="text-card-foreground text-lg font-semibold">Proof of delivery</Text>
              <InfoRow label="Signed by" value={shipment.booking?.pod?.signed_by} />
              <InfoRow label="File type" value={shipment.booking?.pod?.file_type} />
              <InfoRow label="Captured at" value={shipment.booking?.pod?.created_at} />
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        transparent={false}
        visible={fileModalVisible}
        onRequestClose={() => setFileModalVisible(false)}>
        <View className="flex-1 bg-background">
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}>
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground text-3xl font-semibold">Upload shipment file</Text>
              <Pressable onPress={() => setFileModalVisible(false)}>
                <Text className="text-primary text-base font-semibold">Close</Text>
              </Pressable>
            </View>

            <View className="bg-card mt-6 rounded-xl px-5 py-5">
              <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">File type</Text>
              <View className="mt-4 gap-3">
                {shipmentFileTypes.map((fileType) => {
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
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="bg-card mt-4 rounded-xl px-5 py-5">
              <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">Selected file</Text>
              <Pressable onPress={pickShipmentFile} className="bg-secondary mt-4 rounded-full px-4 py-4">
                <Text className="text-secondary-foreground text-center text-base font-semibold">
                  {selectedDocument ? 'Choose a different file' : 'Choose file'}
                </Text>
              </Pressable>
              <Text className="text-muted-foreground mt-3 text-base">
                {selectedDocument ? selectedDocument.name : 'No file selected'}
              </Text>
            </View>

            {selectedShipmentFileType?.requires_expiry ? (
              <View className="bg-card mt-4 rounded-xl px-5 py-5">
                <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">Expiry date</Text>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                  onChangeText={setFileExpiresAt}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={isDarkMode ? '#71717A' : '#A8A29E'}
                  value={fileExpiresAt}
                  className="border-input-border bg-input text-input-foreground mt-4 rounded-[18px] border px-4 py-4 text-base"
                />
              </View>
            ) : null}

            {fileFormError ? (
              <View className="border-destructive bg-destructive mt-4 rounded-[24px] border px-4 py-4">
                <Text className="text-destructive-foreground text-sm font-semibold">{fileFormError}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={isMutating}
              onPress={uploadShipmentFile}
              className={`mt-6 items-center rounded-full px-6 py-4 ${isMutating ? 'bg-destructive' : 'bg-primary'}`}>
              {isMutating ? (
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

function DetailCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <View className="bg-card mt-6 rounded-xl px-5 py-5">
      <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">{title}</Text>
      <Text className="text-card-foreground mt-2 text-lg font-semibold leading-7">{value}</Text>
      {subtitle ? <Text className="text-muted-foreground mt-2 text-base">{subtitle}</Text> : null}
    </View>
  );
}

function ActionCard({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <View className="bg-muted mt-5 rounded-[24px] px-4 py-4">
      <Text className="text-card-foreground text-base font-semibold">{title}</Text>
      <Text className="text-muted-foreground mt-1 text-sm leading-6">{description}</Text>
      <View className="mt-4 gap-4">{children}</View>
    </View>
  );
}

function ActionChip({
  destructive = false,
  isActive,
  label,
  onPress,
}: {
  destructive?: boolean;
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-4 py-3 ${isActive ? (destructive ? 'bg-destructive' : 'bg-secondary') : 'bg-muted'}`}>
      <Text className={`text-sm font-semibold ${isActive ? (destructive ? 'text-destructive-foreground' : 'text-secondary-foreground') : 'text-foreground'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="mt-4 flex-row justify-between gap-4">
      <Text className="text-muted-foreground flex-1 text-sm uppercase tracking-[2px]">{label}</Text>
      <Text className="text-card-foreground flex-1 text-right text-base font-medium">{value || 'Not available'}</Text>
    </View>
  );
}

function Input({
  label,
  multiline = false,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  multiline?: boolean;
  onChangeText: (text: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View>
      <Text className="text-muted-foreground mb-2 text-sm uppercase tracking-[2px]">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholder={placeholder}
        placeholderTextColor="#A8A29E"
        className={`bg-input text-input-foreground rounded-[18px] px-4 py-4 text-base ${multiline ? 'min-h-24' : ''}`}
      />
    </View>
  );
}

function OptionRow({
  emptyLabel,
  onSelect,
  options,
  renderLabel,
  selected,
}: {
  emptyLabel?: string;
  onSelect: (value: string) => void;
  options: string[];
  renderLabel?: (value: string) => string;
  selected: string;
}) {
  if (options.length === 0) {
    return <Text className="text-muted-foreground text-sm">{emptyLabel || 'No options available'}</Text>;
  }

  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = option === selected;

        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            className={`rounded-full px-4 py-3 ${isSelected ? 'bg-secondary' : 'bg-card'}`}>
            <Text className={`text-sm font-medium ${isSelected ? 'text-secondary-foreground' : 'text-card-foreground'}`}>
              {renderLabel ? renderLabel(option) : formatStatus(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SubmitButton({
  destructive = false,
  disabled,
  label,
  onPress,
}: {
  destructive?: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`items-center rounded-full px-5 py-4 ${disabled ? 'bg-muted' : destructive ? 'bg-destructive' : 'bg-secondary'}`}>
      <Text className={`text-base font-semibold ${disabled ? 'text-muted-foreground' : destructive ? 'text-destructive-foreground' : 'text-secondary-foreground'}`}>{label}</Text>
    </Pressable>
  );
}

function formatStatus(status: string) {
  return status.replaceAll('_', ' ');
}

function getAvailableStatuses(currentStatus: string) {
  const currentIndex = STATUS_FLOW.indexOf(currentStatus);

  if (currentIndex === -1) {
    return STATUS_FLOW;
  }

  return STATUS_FLOW.slice(currentIndex);
}

function toggleAction(
  current: 'cancel' | 'pod' | 'scan' | 'status' | null,
  next: 'cancel' | 'pod' | 'scan' | 'status',
) {
  return current === next ? null : next;
}
