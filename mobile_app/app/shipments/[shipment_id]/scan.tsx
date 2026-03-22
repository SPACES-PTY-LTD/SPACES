import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiRequestError, DriverShipment, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

export default function ShipmentScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { shipment_id } = useLocalSearchParams<{ shipment_id: string }>();
  const { session } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
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
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-5" style={{ paddingTop: insets.top + 10 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="border-border bg-card h-12 w-12 items-center justify-center rounded-full border">
            <Feather name="arrow-left" size={22} color={isDarkMode ? '#FFFFFF' : '#111111'} />
          </Pressable>

          <Text className="text-foreground text-[22px] font-semibold tracking-[-0.4px]">Box Scan</Text>

          {showScannedParcelsButton ? (
            <Pressable
              onPress={() => bottomSheetModalRef.current?.present()}
              className="border-border bg-card h-12 w-12 items-center justify-center rounded-full border"
              accessibilityLabel="Scanned parcels">
              <Feather name="more-vertical" size={20} color={isDarkMode ? '#FFFFFF' : '#111111'} />
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
          <View className="border-destructive bg-destructive rounded-xl border px-5 py-5">
            <Text className="text-destructive-foreground text-base font-semibold">{errorMessage}</Text>
          </View>
        </View>
      ) : shipment ? (
        <View className="flex-1 px-5 pt-8">
          <View className="bg-card overflow-hidden rounded-[34px]">
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
                  <View className="border-card h-60 w-60 rounded-[36px] border-2 bg-transparent" />
                </View>
              </CameraView>
            ) : (
              <View className="h-[430px] items-center justify-center px-8">
                <Text className="text-foreground text-center text-lg font-semibold">Camera access needed</Text>
                <Text className="text-muted-foreground mt-3 text-center text-base leading-6">
                  Allow camera access to scan parcel QR codes for this shipment.
                </Text>
                <Pressable
                  onPress={requestPermission}
                  className="bg-secondary mt-6 rounded-full px-6 py-3">
                  <Text className="text-secondary-foreground text-sm font-semibold uppercase tracking-[2px]">Enable camera</Text>
                </Pressable>
              </View>
            )}
            {permission?.granted && !cameraError && !isCameraReady ? (
              <View className="bg-card absolute inset-0 items-center justify-center">
                <ActivityIndicator color={isDarkMode ? '#FFFFFF' : '#111111'} />
                <Text className="text-foreground mt-4 text-sm font-medium">Starting camera...</Text>
              </View>
            ) : null}

            {cameraError ? (
              <View className="bg-card absolute inset-0 items-center justify-center px-8">
                <Text className="text-foreground text-center text-lg font-semibold">Camera failed to start</Text>
                <Text className="text-muted-foreground mt-3 text-center text-sm leading-6">{cameraError}</Text>
              </View>
            ) : null}
          </View>

          <View className="px-3 pt-8">
            <Text className="text-foreground text-center text-[34px] font-semibold leading-[38px] tracking-[-1px]">
              Scanned {scannedCount}/{totalParcels} parcels
            </Text>
            <Text className="text-muted-foreground mt-4 text-center text-lg leading-7">
              {shipment.all_parcels_scanned
                ? 'All parcels scanned. Returning to shipment info.'
                : isScannerArmed
                  ? 'Point the camera at the parcel QR code.'
                  : 'Tap the button to scan the next parcel.'}
            </Text>

            {actionMessage ? (
              <View className="bg-success mt-5 rounded-[22px] px-4 py-4">
                <Text className="text-success-foreground text-center text-sm font-medium">{actionMessage}</Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View className="border-destructive bg-destructive mt-5 rounded-[22px] border px-4 py-4">
                <Text className="text-destructive-foreground text-center text-sm font-medium">{errorMessage}</Text>
              </View>
            ) : null}
          </View>

          <View className="mt-auto flex-row items-center justify-center gap-10 pb-8 pt-10">
            <Pressable
              onPress={() => setIsFlashEnabled((current) => !current)}
              className={`h-14 w-14 items-center justify-center rounded-full border ${isFlashEnabled ? 'border-secondary bg-secondary' : 'border-border bg-card'}`}
              accessibilityLabel={isFlashEnabled ? 'Turn flash off' : 'Turn flash on'}>
              <Feather name={isFlashEnabled ? 'zap' : 'zap-off'} size={20} color={isFlashEnabled ? (isDarkMode ? '#111111' : '#FFFFFF') : isDarkMode ? '#FFFFFF' : '#111111'} />
            </Pressable>
            <Pressable
              onPress={() => {
                setIsScannerArmed(true);
                setActionMessage(null);
                setErrorMessage(null);
              }}
              disabled={isScanning || shipment.all_parcels_scanned}
              className={`border-secondary h-24 w-24 items-center justify-center rounded-full border-[5px] ${shipment.all_parcels_scanned ? 'bg-muted' : 'bg-secondary'}`}>
              {isScanning ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View className="border-secondary-foreground h-11 w-11 items-center justify-center rounded-[18px] border-2">
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
        handleIndicatorStyle={{ backgroundColor: isDarkMode ? '#3F3F46' : '#D6D3D1', width: 64 }}
        backgroundStyle={{ backgroundColor: isDarkMode ? '#18181B' : '#FAF7F2' }}
      >
        <BottomSheetView style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 16 }}>
          <Text className="text-foreground text-lg font-semibold">Scanned parcels</Text>
          <Text className="text-muted-foreground mt-2 text-sm leading-6">
            {scannedCount} of {totalParcels} scanned for this shipment.
          </Text>
          <ScrollView className="mt-5" showsVerticalScrollIndicator={false}>
            <View className="gap-3 pb-6">
              {scannedParcels.map((parcel) => (
                <View key={parcel.parcel_id} className="border-border bg-card rounded-[22px] border px-4 py-4">
                  <Text className="text-muted-foreground text-sm font-semibold uppercase tracking-[2px]">{parcel.parcel_code}</Text>
                  <Text className="text-card-foreground mt-2 text-base font-medium">
                    {parcel.contents_description || parcel.type || 'Parcel'}
                  </Text>
                  <Text className="text-muted-foreground mt-1 text-sm">{parcel.picked_up_scanned_at || 'Scanned'}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}
