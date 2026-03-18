import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiRequestError, CancelReason, DriverEntityFile, DriverFileType, DriverShipment, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

const STATUS_FLOW = ['booked', 'pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed'];

export default function ShipmentDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { shipment_id } = useLocalSearchParams<{ shipment_id: string }>();
  const { session } = useAuth();
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
    <View className="flex-1 bg-[#F3EFE7]">
      <Stack.Screen options={{ headerShown: false }} />

      <Pressable
        onPress={() => router.back()}
        className="absolute left-5 z-20 h-12 w-12 items-center justify-center rounded-full bg-white"
        style={{ top: insets.top + 10 }}>
        <Feather name="chevron-left" size={24} color="#111" />
      </Pressable>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 72, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        <View className="rounded-[32px] bg-[#111111] px-6 py-6">
          <Text className="text-sm uppercase tracking-[3px] text-[#F54A4A]">Shipment detail</Text>
          <Text className="mt-4 text-3xl font-semibold leading-tight text-white">
            {shipment?.merchant_order_ref || shipment?.delivery_note_number || shipment_id}
          </Text>
          <Text className="mt-3 text-base leading-6 text-[#C8C8C8]">
            Current status: {shipment ? formatStatus(shipment.booking?.status || shipment.status) : 'Loading'}
          </Text>
        </View>

        {isLoading ? (
          <View className="mt-6 items-center rounded-[28px] bg-white px-5 py-12">
            <ActivityIndicator color="#F54A4A" />
          </View>
        ) : errorMessage ? (
          <View className="mt-6 rounded-[28px] border border-[#FECACA] bg-[#FEE2E2] px-5 py-5">
            <Text className="text-base font-semibold text-[#991B1B]">{errorMessage}</Text>
          </View>
        ) : shipment ? (
          <>
            {!shipment.booking ? (
              <View className="mt-6 rounded-[28px] border border-[#FDE68A] bg-[#FEF3C7] px-5 py-5">
                <Text className="text-base font-semibold text-[#92400E]">
                  Driver actions are unavailable because this shipment does not have a booking yet.
                </Text>
              </View>
            ) : (
              <View className="mt-6 rounded-[28px] bg-white px-5 py-5">
                <Text className="text-lg font-semibold text-[#111111]">Driver actions</Text>
                <Text className="mt-2 text-sm leading-6 text-[#57534E]">
                  Record scans, update delivery status, attach POD details, or cancel the shipment.
                </Text>

                <View className="mt-4 flex-row flex-wrap gap-3">
                  <ActionChip label="Update status" isActive={activeAction === 'status'} onPress={() => setActiveAction(toggleAction(activeAction, 'status'))} />
                  <ActionChip label="Scan" isActive={false} onPress={() => router.push(`/shipments/${shipment.shipment_id}/scan`)} />
                  <ActionChip label="POD" isActive={activeAction === 'pod'} onPress={() => setActiveAction(toggleAction(activeAction, 'pod'))} />
                  <ActionChip label="Cancel" isActive={activeAction === 'cancel'} onPress={() => setActiveAction(toggleAction(activeAction, 'cancel'))} destructive />
                </View>

                {actionMessage ? (
                  <View className="mt-4 rounded-[20px] bg-[#DCFCE7] px-4 py-3">
                    <Text className="text-sm font-medium text-[#166534]">{actionMessage}</Text>
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
            <View className="mt-4 rounded-[28px] bg-white px-5 py-5">
              <Text className="text-lg font-semibold text-[#111111]">Parcels</Text>
              <View className="mt-4 gap-3">
                {(shipment.parcels || []).map((parcel) => (
                  <View key={parcel.parcel_id} className="rounded-[20px] border border-[#E7E5E4] px-4 py-4">
                    <Text className="text-sm font-semibold uppercase tracking-[2px] text-[#57534E]">{parcel.parcel_code || 'No code'}</Text>
                    <Text className="mt-2 text-base font-medium text-[#111111]">
                      {parcel.contents_description || parcel.type || 'Parcel'}
                    </Text>
                    <Text className="mt-1 text-sm text-[#57534E]">
                      {parcel.is_picked_up_scanned ? `Scanned at ${parcel.picked_up_scanned_at || 'pickup'}` : 'Pending pickup scan'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="mt-6 rounded-[28px] bg-white px-5 py-5">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-[#111111]">Shipment files</Text>
                <Pressable
                  onPress={() => {
                    resetShipmentFileForm();
                    setFileModalVisible(true);
                  }}
                  className="rounded-full bg-[#111111] px-4 py-3">
                  <Text className="text-sm font-semibold text-white">Upload</Text>
                </Pressable>
              </View>

              {shipmentFilesError ? (
                <Text className="mt-4 text-sm font-medium text-[#B91C1C]">{shipmentFilesError}</Text>
              ) : shipmentFiles.length === 0 ? (
                <Text className="mt-4 text-base text-[#57534E]">No shipment files uploaded yet.</Text>
              ) : (
                <View className="mt-4 gap-3">
                  {shipmentFiles.map((file) => (
                    <Pressable
                      key={file.file_id}
                      onPress={() => openShipmentFile(file.file_id)}
                      className="rounded-[20px] border border-[#E7E5E4] px-4 py-4">
                      <Text className="text-sm uppercase tracking-[2px] text-[#57534E]">
                        {file.file_type?.name || 'Shipment file'}
                      </Text>
                      <Text className="mt-2 text-base font-medium text-[#111111]">
                        {file.original_name || 'Unnamed file'}
                      </Text>
                      <Text className="mt-1 text-sm text-[#57534E]">
                        {file.expires_at ? `Expires ${file.expires_at.slice(0, 10)}` : 'No expiry'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View className="mt-6 rounded-[28px] bg-white px-5 py-5">
              <Text className="text-lg font-semibold text-[#111111]">Timeline</Text>
              <InfoRow label="Booked at" value={shipment.booking?.booked_at} />
              <InfoRow label="Collected at" value={shipment.booking?.collected_at} />
              <InfoRow label="Delivered at" value={shipment.booking?.delivered_at} />
              <InfoRow label="Returned at" value={shipment.booking?.returned_at} />
              <InfoRow label="Cancelled at" value={shipment.booking?.cancelled_at} />
            </View>

            <View className="mt-6 rounded-[28px] bg-white px-5 py-5">
              <Text className="text-lg font-semibold text-[#111111]">Shipment info</Text>
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

            <View className="mt-6 rounded-[28px] bg-white px-5 py-5">
              <Text className="text-lg font-semibold text-[#111111]">Proof of delivery</Text>
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
        <View className="flex-1 bg-[#F3EFE7]">
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}>
            <View className="flex-row items-center justify-between">
              <Text className="text-3xl font-semibold text-[#111111]">Upload shipment file</Text>
              <Pressable onPress={() => setFileModalVisible(false)}>
                <Text className="text-base font-semibold text-[#F54A4A]">Close</Text>
              </Pressable>
            </View>

            <View className="mt-6 rounded-[28px] bg-white px-5 py-5">
              <Text className="text-sm uppercase tracking-[2px] text-[#78716C]">File type</Text>
              <View className="mt-4 gap-3">
                {shipmentFileTypes.map((fileType) => {
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
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="mt-4 rounded-[28px] bg-white px-5 py-5">
              <Text className="text-sm uppercase tracking-[2px] text-[#78716C]">Selected file</Text>
              <Pressable onPress={pickShipmentFile} className="mt-4 rounded-full bg-[#111111] px-4 py-4">
                <Text className="text-center text-base font-semibold text-white">
                  {selectedDocument ? 'Choose a different file' : 'Choose file'}
                </Text>
              </Pressable>
              <Text className="mt-3 text-base text-[#57534E]">
                {selectedDocument ? selectedDocument.name : 'No file selected'}
              </Text>
            </View>

            {selectedShipmentFileType?.requires_expiry ? (
              <View className="mt-4 rounded-[28px] bg-white px-5 py-5">
                <Text className="text-sm uppercase tracking-[2px] text-[#78716C]">Expiry date</Text>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                  onChangeText={setFileExpiresAt}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#A8A29E"
                  value={fileExpiresAt}
                  className="mt-4 rounded-[18px] border border-[#E7E5E4] bg-[#FAFAF9] px-4 py-4 text-base text-[#111111]"
                />
              </View>
            ) : null}

            {fileFormError ? (
              <View className="mt-4 rounded-[24px] border border-[#FECACA] bg-[#FEE2E2] px-4 py-4">
                <Text className="text-sm font-semibold text-[#991B1B]">{fileFormError}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={isMutating}
              onPress={uploadShipmentFile}
              className={`mt-6 items-center rounded-full px-6 py-4 ${isMutating ? 'bg-[#FCA5A5]' : 'bg-[#F54A4A]'}`}>
              {isMutating ? (
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

function DetailCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <View className="mt-6 rounded-[28px] bg-white px-5 py-5">
      <Text className="text-sm uppercase tracking-[2px] text-[#78716C]">{title}</Text>
      <Text className="mt-2 text-lg font-semibold leading-7 text-[#111111]">{value}</Text>
      {subtitle ? <Text className="mt-2 text-base text-[#57534E]">{subtitle}</Text> : null}
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
    <View className="mt-5 rounded-[24px] bg-[#F5F5F4] px-4 py-4">
      <Text className="text-base font-semibold text-[#111111]">{title}</Text>
      <Text className="mt-1 text-sm leading-6 text-[#57534E]">{description}</Text>
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
      className={`rounded-full px-4 py-3 ${isActive ? (destructive ? 'bg-[#FEE2E2]' : 'bg-[#111111]') : 'bg-[#F5F5F4]'}`}>
      <Text className={`text-sm font-semibold ${isActive ? (destructive ? 'text-[#B91C1C]' : 'text-white') : 'text-[#111111]'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="mt-4 flex-row justify-between gap-4">
      <Text className="flex-1 text-sm uppercase tracking-[2px] text-[#78716C]">{label}</Text>
      <Text className="flex-1 text-right text-base font-medium text-[#111111]">{value || 'Not available'}</Text>
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
      <Text className="mb-2 text-sm uppercase tracking-[2px] text-[#78716C]">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholder={placeholder}
        placeholderTextColor="#A8A29E"
        className={`rounded-[18px] bg-white px-4 py-4 text-base text-[#111111] ${multiline ? 'min-h-24' : ''}`}
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
    return <Text className="text-sm text-[#78716C]">{emptyLabel || 'No options available'}</Text>;
  }

  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = option === selected;

        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            className={`rounded-full px-4 py-3 ${isSelected ? 'bg-[#111111]' : 'bg-white'}`}>
            <Text className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-[#111111]'}`}>
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
      className={`items-center rounded-full px-5 py-4 ${disabled ? 'bg-[#D6D3D1]' : destructive ? 'bg-[#B91C1C]' : 'bg-[#111111]'}`}>
      <Text className="text-base font-semibold text-white">{label}</Text>
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
