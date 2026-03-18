import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiRequestError, DriverShipment, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

export default function ShipmentScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { shipment_id } = useLocalSearchParams<{ shipment_id: string }>();
  const { session } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [shipment, setShipment] = useState<DriverShipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isScannerArmed, setIsScannerArmed] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFlashEnabled, setIsFlashEnabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const isSubmittingRef = useRef(false);
  const lastScannedCodeRef = useRef<string | null>(null);

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
      setErrorMessage(requestError.message || 'Unable to load shipment for scanning.');
    } finally {
      setIsLoading(false);
    }
  }, [session?.token, shipment_id]);

  useFocusEffect(
    useCallback(() => {
      loadShipment();
    }, [loadShipment]),
  );

  useEffect(() => {
    if (!permission || permission.granted || permission.canAskAgain === false) {
      return;
    }

    requestPermission();
  }, [permission, requestPermission]);

  async function handleBarcodeScanned(result: BarcodeScanningResult) {
    const code = result.data?.trim().toUpperCase();

    if (!code || !shipment || !session?.token || !isScannerArmed || isSubmittingRef.current) {
      return;
    }

    if (lastScannedCodeRef.current === code) {
      return;
    }

    lastScannedCodeRef.current = code;
    isSubmittingRef.current = true;
    setIsScanning(true);
    setIsScannerArmed(false);
    setErrorMessage(null);
    setActionMessage(null);

    try {
      const response = await driverApi.scanShipment(session.token, shipment.shipment_id, {
        parcel_code: code,
      });

      setShipment(response.data);
      setActionMessage(response.meta.message || 'Parcel scan recorded.');

      if (response.meta.scan_status === 'already_scanned') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (response.meta.all_parcels_scanned) {
        router.back();
      }
    } catch (error) {
      const requestError = error as ApiRequestError;
      setErrorMessage(requestError.message || 'Unable to scan parcel.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      isSubmittingRef.current = false;
      setIsScanning(false);
      setTimeout(() => {
        lastScannedCodeRef.current = null;
      }, 1200);
    }
  }

  const scannedParcels = (shipment?.parcels || []).filter((parcel) => parcel.is_picked_up_scanned);
  const totalParcels = shipment?.total_parcel_count ?? shipment?.parcels?.length ?? 0;
  const scannedCount = shipment?.scanned_parcel_count ?? scannedParcels.length;
  const showScannedParcelsButton = scannedCount > 0 && totalParcels > 1;

  return (
    <View className="flex-1 bg-[#F3EFE7]">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-5" style={{ paddingTop: insets.top + 10 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-12 w-12 items-center justify-center rounded-full border border-[#E7E5E4] bg-[#FAF7F2]">
            <Feather name="arrow-left" size={22} color="#111111" />
          </Pressable>

          <Text className="text-[22px] font-semibold tracking-[-0.4px] text-[#111111]">Box Scan</Text>

          {showScannedParcelsButton ? (
            <Pressable
              onPress={() => bottomSheetModalRef.current?.present()}
              className="h-12 w-12 items-center justify-center rounded-full border border-[#E7E5E4] bg-[#FAF7F2]"
              accessibilityLabel="Scanned parcels">
              <Feather name="more-vertical" size={20} color="#111111" />
            </Pressable>
          ) : (
            <View className="h-12 w-12" />
          )}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F54A4A" size="large" />
        </View>
      ) : errorMessage && !shipment ? (
        <View className="flex-1 px-5 pt-8">
          <View className="rounded-[28px] border border-[#FECACA] bg-[#FEE2E2] px-5 py-5">
            <Text className="text-base font-semibold text-[#991B1B]">{errorMessage}</Text>
          </View>
        </View>
      ) : shipment ? (
        <View className="flex-1 px-5 pt-8">
          <View className="overflow-hidden rounded-[34px] bg-[#D9D2C4]">
            {permission?.granted ? (
              <CameraView
                active
                facing="back"
                animateShutter={false}
                enableTorch={isFlashEnabled}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                style={{ height: 430, width: '100%' }}
                onCameraReady={() => {
                  setIsCameraReady(true);
                  setCameraError(null);
                }}
                onMountError={({ message }) => {
                  setCameraError(message || 'Camera failed to start.');
                }}
                onBarcodeScanned={handleBarcodeScanned}
              >
                <View className="flex-1 items-center justify-center">
                  <View className="h-60 w-60 rounded-[36px] border-2 border-[#FFFFFF] bg-transparent" />
                </View>
              </CameraView>
            ) : (
              <View className="h-[430px] items-center justify-center px-8">
                <Text className="text-center text-lg font-semibold text-[#111111]">Camera access needed</Text>
                <Text className="mt-3 text-center text-base leading-6 text-[#57534E]">
                  Allow camera access to scan parcel QR codes for this shipment.
                </Text>
                <Pressable
                  onPress={requestPermission}
                  className="mt-6 rounded-full bg-[#111111] px-6 py-3">
                  <Text className="text-sm font-semibold uppercase tracking-[2px] text-white">Enable camera</Text>
                </Pressable>
              </View>
            )}
            {permission?.granted && !cameraError && !isCameraReady ? (
              <View className="absolute inset-0 items-center justify-center bg-[#D9D2C4]">
                <ActivityIndicator color="#111111" />
                <Text className="mt-4 text-sm font-medium text-[#111111]">Starting camera...</Text>
              </View>
            ) : null}

            {cameraError ? (
              <View className="absolute inset-0 items-center justify-center bg-[#D9D2C4] px-8">
                <Text className="text-center text-lg font-semibold text-[#111111]">Camera failed to start</Text>
                <Text className="mt-3 text-center text-sm leading-6 text-[#57534E]">{cameraError}</Text>
              </View>
            ) : null}
          </View>

          <View className="px-3 pt-8">
            <Text className="text-center text-[34px] font-semibold leading-[38px] tracking-[-1px] text-[#111111]">
              Scanned {scannedCount}/{totalParcels} parcels
            </Text>
            <Text className="mt-4 text-center text-lg leading-7 text-[#57534E]">
              {shipment.all_parcels_scanned
                ? 'All parcels scanned. Returning to shipment info.'
                : isScannerArmed
                  ? 'Point the camera at the parcel QR code.'
                  : 'Tap the button to scan the next parcel.'}
            </Text>

            {actionMessage ? (
              <View className="mt-5 rounded-[22px] bg-[#DCFCE7] px-4 py-4">
                <Text className="text-center text-sm font-medium text-[#166534]">{actionMessage}</Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View className="mt-5 rounded-[22px] border border-[#FECACA] bg-[#FEE2E2] px-4 py-4">
                <Text className="text-center text-sm font-medium text-[#991B1B]">{errorMessage}</Text>
              </View>
            ) : null}
          </View>

          <View className="mt-auto flex-row items-center justify-center gap-10 pb-8 pt-10">
            <Pressable
              onPress={() => setIsFlashEnabled((current) => !current)}
              className={`h-14 w-14 items-center justify-center rounded-full border ${isFlashEnabled ? 'border-[#111111] bg-[#111111]' : 'border border-[#E7E5E4] bg-[#FAF7F2]'}`}
              accessibilityLabel={isFlashEnabled ? 'Turn flash off' : 'Turn flash on'}>
              <Feather name={isFlashEnabled ? 'zap' : 'zap-off'} size={20} color={isFlashEnabled ? '#FFFFFF' : '#111111'} />
            </Pressable>
            <Pressable
              onPress={() => {
                setIsScannerArmed(true);
                setActionMessage(null);
                setErrorMessage(null);
              }}
              disabled={isScanning || shipment.all_parcels_scanned}
              className={`h-24 w-24 items-center justify-center rounded-full border-[5px] border-[#111111] ${shipment.all_parcels_scanned ? 'bg-[#BDB7AE]' : 'bg-[#111111]'}`}>
              {isScanning ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View className="h-11 w-11 items-center justify-center rounded-[18px] border-2 border-white">
                  <Feather name="maximize-2" size={20} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
            <View className="h-14 w-14" />
          </View>
        </View>
      ) : null}

      <BottomSheetModal
        ref={bottomSheetModalRef}
        snapPoints={['45%', '70%']}
        backdropComponent={(props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />}
        handleIndicatorStyle={{ backgroundColor: '#D6D3D1', width: 64 }}
        backgroundStyle={{ backgroundColor: '#FAF7F2' }}
      >
        <BottomSheetView style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 16 }}>
          <Text className="text-lg font-semibold text-[#111111]">Scanned parcels</Text>
          <Text className="mt-2 text-sm leading-6 text-[#57534E]">
            {scannedCount} of {totalParcels} scanned for this shipment.
          </Text>
          <ScrollView className="mt-5" showsVerticalScrollIndicator={false}>
            <View className="gap-3 pb-6">
              {scannedParcels.map((parcel) => (
                <View key={parcel.parcel_id} className="rounded-[22px] border border-[#E7E5E4] bg-white px-4 py-4">
                  <Text className="text-sm font-semibold uppercase tracking-[2px] text-[#57534E]">{parcel.parcel_code}</Text>
                  <Text className="mt-2 text-base font-medium text-[#111111]">
                    {parcel.contents_description || parcel.type || 'Parcel'}
                  </Text>
                  <Text className="mt-1 text-sm text-[#57534E]">{parcel.picked_up_scanned_at || 'Scanned'}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}
